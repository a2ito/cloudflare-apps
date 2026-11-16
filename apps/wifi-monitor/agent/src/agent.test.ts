import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SampleInput } from "../../src/lib/sample-schema";
import { createState, runOnce, type AgentDeps } from "./agent";
import { interpretPing, measureDownload } from "./collect";
import { parseConfig } from "./config";
import {
  acquireLock,
  appendToQueue,
  capQueue,
  loadQueue,
  saveQueue,
} from "./queue";
import { createSender, flushQueue, type SendOutcome } from "./sender";

const sample = (i: number): SampleInput => ({
  measuredAt: new Date(Date.UTC(2026, 10, 15, 0, i)).toISOString(),
  latencyMs: 10,
});

const tmp = () => mkdtemp(join(tmpdir(), "wifi-monitor-agent-"));

describe("flushQueue", () => {
  it("300 件ずつ、古い順に送る", async () => {
    const batches: number[] = [];
    const result = await flushQueue(
      Array.from({ length: 650 }, (_, i) => sample(i)),
      async (batch) => {
        batches.push(batch.length);
        return { kind: "ok" };
      },
    );
    expect(batches).toEqual([300, 300, 50]);
    expect(result).toMatchObject({ remaining: [], sent: 650, dropped: 0 });
  });

  it("1 回に送るまとまりの数には上限があり、残りは次の回に回す", async () => {
    const queue = Array.from({ length: 1000 }, (_, i) => sample(i % 1440));
    const result = await flushQueue(queue, async () => ({ kind: "ok" }), 2);
    expect(result.sent).toBe(600);
    expect(result.remaining).toHaveLength(400);
  });

  it("回線断・5xx なら、そこで止めて残りを貯めておく", async () => {
    const outcomes: SendOutcome[] = [
      { kind: "ok" },
      { kind: "retry", message: "fetch failed" },
    ];
    const queue = Array.from({ length: 650 }, (_, i) => sample(i));
    const result = await flushQueue(queue, async () => outcomes.shift()!);
    expect(result.sent).toBe(300);
    expect(result.remaining).toEqual(queue.slice(300));
    expect(result.unauthorized).toBe(false);
  });

  it("400 ならそのまとまりだけ捨てて、次のまとまりを送る（同じまとまりで止まり続けない）", async () => {
    const outcomes: SendOutcome[] = [
      { kind: "rejected", status: 400, message: "bad" },
      { kind: "ok" },
    ];
    const result = await flushQueue(
      Array.from({ length: 400 }, (_, i) => sample(i)),
      async () => outcomes.shift()!,
    );
    expect(result).toMatchObject({ remaining: [], sent: 100, dropped: 300 });
    expect(result.logs[0]).toContain("捨てました");
  });

  it("401 なら止めて、キューは全部残す", async () => {
    const queue = [sample(0), sample(1)];
    const result = await flushQueue(queue, async () => ({
      kind: "unauthorized",
      message: "トークンが正しくありません",
    }));
    expect(result).toMatchObject({ remaining: queue, unauthorized: true });
  });
});

describe("createSender", () => {
  const send = (impl: () => Promise<Response>) =>
    createSender({
      url: "https://example.test",
      token: "wfm_x",
      fetch: vi.fn(impl) as unknown as typeof fetch,
    })([sample(0)]);

  it.each([
    [200, "ok"],
    [400, "rejected"],
    [413, "rejected"],
    [401, "unauthorized"],
    [403, "retry"],
    [404, "retry"],
    [429, "retry"],
    [500, "retry"],
    [503, "retry"],
  ])("応答 %i は %s", async (status, kind) => {
    expect(
      await send(async () => new Response("{}", { status })),
    ).toMatchObject({ kind });
  });

  it("通信そのものが失敗したら retry", async () => {
    expect(
      await send(async () => {
        throw new TypeError("fetch failed");
      }),
    ).toEqual({ kind: "retry", message: "fetch failed" });
  });

  it("トークンを Authorization に載せて /api/samples に送る", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    await createSender({
      url: "https://example.test",
      token: "wfm_x",
      fetch: fetchMock as unknown as typeof fetch,
    })([sample(0)]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://example.test/api/samples");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer wfm_x",
    );
    expect(JSON.parse(init.body as string)).toEqual({ samples: [sample(0)] });
  });
});

describe("queue", () => {
  it("書き直し・追記したものを読み戻せる。壊れた行は飛ばす", async () => {
    const file = join(await tmp(), "nested", "queue.jsonl");
    await saveQueue(file, [sample(0)]);
    await appendToQueue(file, sample(1));
    await writeFile(
      file,
      (await readFile(file, "utf8")) + "{broken\n" + '{"measuredAt":"x"}\n',
    );
    expect(await loadQueue(file)).toEqual([sample(0), sample(1)]);
  });

  it("ファイルは本人だけが読める権限で作る（SSID と時刻は居場所の手がかりになる）", async () => {
    const dir = join(await tmp(), "state");
    const appended = join(dir, "a.jsonl");
    const saved = join(dir, "s.jsonl");
    await appendToQueue(appended, sample(0));
    await saveQueue(saved, [sample(0)]);
    expect((await stat(appended)).mode & 0o777).toBe(0o600);
    expect((await stat(saved)).mode & 0o777).toBe(0o600);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
  });

  it("ファイルが無ければ空", async () => {
    expect(await loadQueue(join(await tmp(), "none.jsonl"))).toEqual([]);
  });

  it("上限を超えたら古い方から捨てる", () => {
    expect(capQueue([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(capQueue([1, 2], 5)).toEqual([1, 2]);
  });

  it("同じキューのロックは 1 つしか取れず、外せばまた取れる", async () => {
    const file = join(await tmp(), "queue.jsonl");
    const release = await acquireLock(file);
    await expect(acquireLock(file)).rejects.toThrow(/別のエージェント/);
    await release();
    const again = await acquireLock(file);
    await again();
  });

  it("落ちたプロセスのロックが残っていても取り直せる", async () => {
    const file = join(await tmp(), "queue.jsonl");
    // 使われていない大きな pid を書いておく
    await writeFile(`${file}.lock`, "99999999");
    const release = await acquireLock(file);
    await release();
  });
});

describe("interpretPing", () => {
  it("要約が無く 0 以外で終わった（Network is unreachable など）なら損失 100", () => {
    expect(
      interpretPing("connect: Network is unreachable\n", "failed"),
    ).toEqual({ latencyMs: null, packetLossPct: 100 });
  });

  it("要約があればそれを使う", () => {
    expect(
      interpretPing(
        "3 packets transmitted, 0 packets received, 100.0% packet loss\n",
        "failed",
      ),
    ).toEqual({ latencyMs: null, packetLossPct: 100 });
  });

  it("時間切れで要約も無いときは分からないので null", () => {
    expect(interpretPing("", "timeout")).toEqual({
      latencyMs: null,
      packetLossPct: null,
    });
  });
});

describe("measureDownload", () => {
  it("最初のデータを受け取ってからの時間で Mbps を出す（接続にかかった時間は入れない）", async () => {
    // 1MB ずつ 11 回届く。1 回目を受け取った時点から数え、残りの 10MB を 2 秒で受け取った
    const times = [1000, 3000];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 11; i++) {
          controller.enqueue(new Uint8Array(1_000_000));
        }
        controller.close();
      },
    });
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    expect(
      await measureDownload(
        11_000_000,
        fetchMock as unknown as typeof fetch,
        () => times.shift()!,
      ),
    ).toBe(40);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://speed.cloudflare.com/__down?bytes=11000000",
    );
  });

  it("失敗したら null", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await measureDownload(1_000_000, failing)).toBeNull();
    const notOk = vi.fn(
      async () => new Response("", { status: 500 }),
    ) as unknown as typeof fetch;
    expect(await measureDownload(1_000_000, notOk)).toBeNull();
  });
});

describe("runOnce", () => {
  function setup(overrides: Partial<AgentDeps> = {}) {
    const appended: SampleInput[] = [];
    const saves: SampleInput[][] = [];
    const sent: SampleInput[][] = [];
    const logs: string[] = [];
    const order: string[] = [];
    let clock = Date.UTC(2026, 10, 15, 3, 0);
    let mono = 0;
    const deps: AgentDeps = {
      now: () => new Date(clock),
      monotonic: () => mono,
      collectWifi: async () => ({
        value: { ssid: "home-5G", rssi: -55, noise: -92, txRateMbps: 866 },
        issues: [],
      }),
      measurePing: async () => {
        order.push("ping");
        return { value: { latencyMs: 12.3, packetLossPct: 0 }, issues: [] };
      },
      measureDownload: vi.fn(async () => {
        order.push("download");
        return 321.5;
      }),
      appendToQueue: async (s) => void appended.push(s),
      saveQueue: async (s) => void saves.push([...s]),
      send: async (batch) => {
        sent.push([...batch]);
        return { kind: "ok" };
      },
      log: (m) => void logs.push(m),
      ...overrides,
    };
    return {
      deps,
      appended,
      saves,
      sent,
      logs,
      order,
      advance: (ms: number) => {
        clock += ms;
        mono += ms;
      },
      jumpWallClock: (ms: number) => {
        clock += ms;
      },
    };
  }

  it("計測を 1 件作って追記してから送り、送れたらキューを空にする", async () => {
    const t = setup();
    const state = await runOnce(createState([]), t.deps, {
      speedIntervalMs: 3_600_000,
    });
    const expected = {
      measuredAt: "2026-11-15T03:00:00.000Z",
      ssid: "home-5G",
      rssi: -55,
      noise: -92,
      txRateMbps: 866,
      latencyMs: 12.3,
      packetLossPct: 0,
      downloadMbps: 321.5,
    };
    expect(t.appended).toEqual([expected]);
    expect(t.sent).toEqual([[expected]]);
    expect(t.saves).toEqual([[]]);
    expect(state.queue).toEqual([]);
  });

  it("ダウンロードは ping が終わってから計る（並べると遅延が水増しされる）", async () => {
    const t = setup();
    await runOnce(createState([]), t.deps, { speedIntervalMs: 3_600_000 });
    expect(t.order).toEqual(["ping", "download"]);
  });

  it("ダウンロード速度は間隔ごとにしか計らない。0 なら計らない", async () => {
    const t = setup();
    let state = await runOnce(createState([]), t.deps, {
      speedIntervalMs: 3_600_000,
    });
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 3_600_000 });
    t.advance(3_600_000);
    await runOnce(state, t.deps, { speedIntervalMs: 3_600_000 });
    expect(t.deps.measureDownload).toHaveBeenCalledTimes(2);
    expect(t.sent.map((b) => b[0]!.downloadMbps)).toEqual([321.5, null, 321.5]);

    const off = setup();
    await runOnce(createState([]), off.deps, { speedIntervalMs: 0 });
    expect(off.deps.measureDownload).not.toHaveBeenCalled();
  });

  it("壁時計が戻っても、速度計測の間隔は単調な時計で判定する", async () => {
    const t = setup();
    const state = await runOnce(createState([]), t.deps, {
      speedIntervalMs: 3_600_000,
    });
    t.jumpWallClock(-3_600_000); // NTP で 1 時間戻った
    t.advance(3_600_000);
    await runOnce(state, t.deps, { speedIntervalMs: 3_600_000 });
    expect(t.deps.measureDownload).toHaveBeenCalledTimes(2);
  });

  it("送れなかったら貯めておき（書き直しはしない）、次の回にまとめて送る", async () => {
    let online = false;
    const t = setup({
      send: async (batch) => {
        if (!online) return { kind: "retry", message: "offline" };
        t.sent.push([...batch]);
        return { kind: "ok" };
      },
    });
    let state = await runOnce(createState([]), t.deps, { speedIntervalMs: 0 });
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(state.queue).toHaveLength(2);
    expect(t.appended).toHaveLength(2);
    expect(t.saves).toEqual([]);

    online = true;
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toHaveLength(3);
    expect(state.queue).toEqual([]);
    expect(t.saves).toEqual([[]]);
  });

  it("401 のあとは送らずに貯め続ける", async () => {
    const send = vi.fn(async (): Promise<SendOutcome> => ({
      kind: "unauthorized",
      message: "",
    }));
    const t = setup({ send });
    let state = await runOnce(createState([]), t.deps, { speedIntervalMs: 0 });
    expect(state.unauthorized).toBe(true);
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(state.queue).toHaveLength(2);
  });

  it("計測の問題（コマンドが無いなど）は、変わったときだけログに出す", async () => {
    let issues = ["iw が見つかりません（PATH を確かめてください）"];
    const t = setup({
      collectWifi: async () => ({
        value: { ssid: null, rssi: null, noise: null, txRateMbps: null },
        issues,
      }),
    });
    let state = await runOnce(createState([]), t.deps, { speedIntervalMs: 0 });
    state = await runOnce(state, t.deps, { speedIntervalMs: 0 });
    issues = [];
    await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(t.logs).toEqual([
      "一部の値を計測できませんでした: iw が見つかりません（PATH を確かめてください）",
      "計測の問題が解消しました",
    ]);
  });

  it("範囲外の値（受信強度 +10 dBm など）の計測はその 1 件だけ捨てる", async () => {
    const t = setup({
      collectWifi: async () => ({
        value: { ssid: "home-5G", rssi: 10, noise: null, txRateMbps: null },
        issues: [],
      }),
    });
    await runOnce(createState([]), t.deps, { speedIntervalMs: 0 });
    expect(t.sent).toEqual([]);
    expect(t.logs[0]).toContain("捨てました");
  });
});

describe("parseConfig", () => {
  const base = {
    WIFI_MONITOR_URL: "https://wifi-monitor.example.test/",
    WIFI_MONITOR_TOKEN: "wfm_abc",
  };

  it("既定値を埋め、URL の末尾の / を落とす", () => {
    expect(parseConfig(base, "/tmp/q.jsonl")).toEqual({
      url: "https://wifi-monitor.example.test",
      token: "wfm_abc",
      intervalMs: 60_000,
      pingHost: "1.1.1.1",
      pingCount: 5,
      speedIntervalMs: 3_600_000,
      speedBytes: 10_000_000,
      interfaceName: undefined,
      queueFile: "/tmp/q.jsonl",
    });
  });

  it("空欄は書いていないものとして既定値にする。0 分なら速度を計らない", () => {
    expect(
      parseConfig(
        {
          ...base,
          WIFI_MONITOR_INTERFACE: "",
          WIFI_MONITOR_SPEED_INTERVAL_MINUTES: "0",
        },
        "/tmp/q.jsonl",
      ),
    ).toMatchObject({ interfaceName: undefined, speedIntervalMs: 0 });
  });

  it("http は localhost だけ許す（トークンを平文で流さない）", () => {
    expect(
      parseConfig({ ...base, WIFI_MONITOR_URL: "http://localhost:3100" }, "/q")
        .url,
    ).toBe("http://localhost:3100");
    expect(() =>
      parseConfig(
        { ...base, WIFI_MONITOR_URL: "http://wifi-monitor.example.test" },
        "/q",
      ),
    ).toThrow(/https/);
  });

  it("ping の宛先が - で始まる（オプションとして読まれる）なら弾く", () => {
    expect(() =>
      parseConfig({ ...base, WIFI_MONITOR_PING_HOST: "-f" }, "/q"),
    ).toThrow(/WIFI_MONITOR_PING_HOST/);
  });

  it("URL やトークンが無い・形が違えば、どこが悪いかを書いて投げる", () => {
    expect(() => parseConfig({}, "/q")).toThrow(/WIFI_MONITOR_URL/);
    expect(() =>
      parseConfig({ ...base, WIFI_MONITOR_TOKEN: "abc" }, "/q"),
    ).toThrow(/WIFI_MONITOR_TOKEN/);
  });
});
