import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SampleInput } from "../../src/lib/sample-schema";
import { initialState, runOnce, type AgentDeps } from "./agent";
import { parseConfig } from "./config";
import { capQueue, loadQueue, saveQueue } from "./queue";
import { createSender, flushQueue, type SendOutcome } from "./sender";

const sample = (i: number): SampleInput => ({
  measuredAt: new Date(Date.UTC(2026, 10, 15, 0, i)).toISOString(),
  latencyMs: 10,
});

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
    [500, "retry"],
    [503, "retry"],
  ])("応答 %i は %s", async (status, kind) => {
    expect(
      await send(async () => new Response("{}", { status })),
    ).toMatchObject({
      kind,
    });
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
  it("保存したものを読み戻せる。壊れた行は飛ばす", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wifi-monitor-queue-"));
    const file = join(dir, "nested", "queue.jsonl");
    await saveQueue(file, [sample(0), sample(1)]);
    await writeFile(
      file,
      (await readFile(file, "utf8")) + "{broken\n" + '{"measuredAt":"x"}\n',
    );
    expect(await loadQueue(file)).toEqual([sample(0), sample(1)]);
  });

  it("ファイルが無ければ空", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wifi-monitor-queue-"));
    expect(await loadQueue(join(dir, "none.jsonl"))).toEqual([]);
  });

  it("上限を超えたら古い方から捨てる", () => {
    expect(capQueue([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(capQueue([1, 2], 5)).toEqual([1, 2]);
  });
});

describe("runOnce", () => {
  function setup(overrides: Partial<AgentDeps> = {}) {
    let stored: SampleInput[] = [];
    const sent: SampleInput[][] = [];
    const logs: string[] = [];
    let clock = Date.UTC(2026, 10, 15, 3, 0);
    const deps: AgentDeps = {
      now: () => new Date(clock),
      collectWifi: async () => ({
        ssid: "home-5G",
        rssi: -55,
        noise: -92,
        txRateMbps: 866,
      }),
      measurePing: async () => ({ latencyMs: 12.3, packetLossPct: 0 }),
      measureDownload: vi.fn(async () => 321.5),
      loadQueue: async () => [...stored],
      saveQueue: async (s) => {
        stored = [...s];
      },
      send: async (batch) => {
        sent.push([...batch]);
        return { kind: "ok" };
      },
      log: (m) => void logs.push(m),
      ...overrides,
    };
    return {
      deps,
      sent,
      logs,
      stored: () => stored,
      advance: (ms: number) => {
        clock += ms;
      },
    };
  }

  it("計測を 1 件作って送り、送れたらキューを空にする", async () => {
    const t = setup();
    await runOnce(initialState, t.deps, { speedIntervalMs: 3_600_000 });
    expect(t.sent).toEqual([
      [
        {
          measuredAt: "2026-11-15T03:00:00.000Z",
          ssid: "home-5G",
          rssi: -55,
          noise: -92,
          txRateMbps: 866,
          latencyMs: 12.3,
          packetLossPct: 0,
          downloadMbps: 321.5,
        },
      ],
    ]);
    expect(t.stored()).toEqual([]);
  });

  it("ダウンロード速度は間隔ごとにしか計らない。0 なら計らない", async () => {
    const t = setup();
    let state = await runOnce(initialState, t.deps, {
      speedIntervalMs: 3_600_000,
    });
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 3_600_000 });
    t.advance(3_600_000);
    await runOnce(state, t.deps, { speedIntervalMs: 3_600_000 });
    expect(t.deps.measureDownload).toHaveBeenCalledTimes(2);
    expect(t.sent.map((b) => b[0]!.downloadMbps)).toEqual([321.5, null, 321.5]);

    const off = setup();
    await runOnce(initialState, off.deps, { speedIntervalMs: 0 });
    expect(off.deps.measureDownload).not.toHaveBeenCalled();
  });

  it("送れなかったら貯めておき、次の回にまとめて送る", async () => {
    let online = false;
    const t = setup({
      send: async (batch) => {
        if (!online) return { kind: "retry", message: "offline" };
        t.sent.push([...batch]);
        return { kind: "ok" };
      },
    });
    let state = await runOnce(initialState, t.deps, { speedIntervalMs: 0 });
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(t.stored()).toHaveLength(2);

    online = true;
    t.advance(60_000);
    await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toHaveLength(3);
    expect(t.stored()).toEqual([]);
  });

  it("401 のあとは送らずに貯め続ける", async () => {
    const send = vi.fn(async (): Promise<SendOutcome> => ({
      kind: "unauthorized",
      message: "",
    }));
    const t = setup({ send });
    let state = await runOnce(initialState, t.deps, { speedIntervalMs: 0 });
    expect(state.unauthorized).toBe(true);
    t.advance(60_000);
    state = await runOnce(state, t.deps, { speedIntervalMs: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(t.stored()).toHaveLength(2);
  });

  it("範囲外の値（受信強度 +10 dBm など）の計測はその 1 件だけ捨てる", async () => {
    const t = setup({
      collectWifi: async () => ({
        ssid: "home-5G",
        rssi: 10,
        noise: null,
        txRateMbps: null,
      }),
    });
    await runOnce(initialState, t.deps, { speedIntervalMs: 0 });
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

  it("URL やトークンが無い・形が違えば、どこが悪いかを書いて投げる", () => {
    expect(() => parseConfig({}, "/q")).toThrow(/WIFI_MONITOR_URL/);
    expect(() =>
      parseConfig({ ...base, WIFI_MONITOR_TOKEN: "abc" }, "/q"),
    ).toThrow(/WIFI_MONITOR_TOKEN/);
  });
});

describe("measureDownload", () => {
  it("落とした量とかかった時間から Mbps を出す", async () => {
    const { measureDownload } = await import("./collect");
    const times = [0, 2000]; // 2 秒
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(10_000_000), { status: 200 }),
    );
    expect(
      await measureDownload(
        10_000_000,
        fetchMock as unknown as typeof fetch,
        () => times.shift()!,
      ),
    ).toBe(40);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://speed.cloudflare.com/__down?bytes=10000000",
    );
  });

  it("失敗したら null", async () => {
    const { measureDownload } = await import("./collect");
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
