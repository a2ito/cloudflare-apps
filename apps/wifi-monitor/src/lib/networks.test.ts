import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDevice,
  ensureNetworks,
  getNetwork,
  getSeries,
  listNetworksWithStats,
  renameNetwork,
  upsertUser,
} from "@/db/queries";
import { createTestEnv, type TestEnv } from "@/test/d1";
import { authenticateDevice, ingestSamples } from "./ingest";
import { hashToken } from "./token";

let t: TestEnv;
beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());

const now = new Date("2026-11-15T03:00:00.000Z");
let me: number;
let other: number;

beforeEach(async () => {
  await t.truncate();
  me = (
    await upsertUser(t.db, { email: "me@example.com", name: null, image: null })
  ).id;
  other = (
    await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    })
  ).id;
  await createDevice(t.db, me, {
    name: "Mac",
    tokenHash: await hashToken("wfm_mac"),
  });
  await createDevice(t.db, me, {
    name: "Pi",
    tokenHash: await hashToken("wfm_pi"),
  });
  await createDevice(t.db, other, {
    name: "他人の",
    tokenHash: await hashToken("wfm_other"),
  });
});

async function send(token: string, samples: Record<string, unknown>[]) {
  const auth = await authenticateDevice(t.db, `Bearer ${token}`);
  if (!auth.ok) throw new Error(auth.error);
  return ingestSamples(t.db, { device: auth.device, body: { samples }, now });
}

async function networkIdsOfSamples(): Promise<(number | null)[]> {
  const { results } = await t.d1
    .prepare("SELECT network_id FROM samples ORDER BY measured_at")
    .all<{ network_id: number | null }>();
  return results.map((r: { network_id: number | null }) => r.network_id);
}

describe("受信時のネットワークの自動登録", () => {
  it("初めて見た SSID をネットワークとして作り、計測をひも付ける", async () => {
    await send("wfm_mac", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home" },
      { measuredAt: "2026-11-15T02:01:00Z", ssid: "office" },
      { measuredAt: "2026-11-15T02:02:00Z" }, // SSID が取れなかった計測
    ]);

    const networks = await listNetworksWithStats(t.db, me);
    expect(networks.map((n) => [n.ssid, n.name])).toEqual([
      ["office", "office"],
      ["home", "home"],
    ]);
    const ids = new Map(networks.map((n) => [n.ssid, n.id]));
    expect(await networkIdsOfSamples()).toEqual([
      ids.get("home"),
      ids.get("office"),
      null,
    ]);
  });

  it("同じ持ち主の別の端末からの同じ SSID は、同じネットワークにまとめる", async () => {
    await send("wfm_mac", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home" },
    ]);
    await send("wfm_pi", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home" },
    ]);

    const networks = await listNetworksWithStats(t.db, me);
    expect(networks).toHaveLength(1);
    expect(networks[0]).toMatchObject({ ssid: "home" });
    expect(new Set(await networkIdsOfSamples())).toEqual(
      new Set([networks[0]!.id]),
    );
  });

  it("別の人の同じ SSID は別のネットワークにし、互いに見えない", async () => {
    await send("wfm_mac", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home" },
    ]);
    await send("wfm_other", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home" },
    ]);

    const mine = await listNetworksWithStats(t.db, me);
    const theirs = await listNetworksWithStats(t.db, other);
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);
    expect(mine[0]!.id).not.toBe(theirs[0]!.id);
    expect(await getNetwork(t.db, me, theirs[0]!.id)).toBeNull();
  });

  it("名前を付け替えても、同じ SSID の計測は同じネットワークに入り続ける", async () => {
    await send("wfm_mac", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home" },
    ]);
    const [net] = await listNetworksWithStats(t.db, me);
    expect(await renameNetwork(t.db, me, net!.id, "自宅")).toBe(true);

    await send("wfm_mac", [
      { measuredAt: "2026-11-15T02:01:00Z", ssid: "home" },
    ]);
    const networks = await listNetworksWithStats(t.db, me);
    expect(networks).toHaveLength(1);
    expect(networks[0]).toMatchObject({ name: "自宅", ssid: "home" });
    expect(await networkIdsOfSamples()).toEqual([net!.id, net!.id]);
  });
});

describe("SSID が多い受信", () => {
  it("1 回の受信の SSID が 40 種類あっても受け付ける（D1 のバインドの上限に当たらない）", async () => {
    const samples = Array.from({ length: 40 }, (_, i) => ({
      measuredAt: new Date(now.getTime() - (i + 1) * 60_000).toISOString(),
      ssid: `hotel-${i}`,
    }));
    expect(await send("wfm_mac", samples)).toEqual({
      ok: true,
      accepted: 40,
      skipped: 0,
    });
    expect(await listNetworksWithStats(t.db, me)).toHaveLength(40);
    expect((await networkIdsOfSamples()).every((id) => id !== null)).toBe(true);
  });
});

describe("ensureNetworks", () => {
  it("空白だけの SSID はネットワークを作らず、計測はネットワーク無しで入る", async () => {
    await send("wfm_mac", [{ measuredAt: "2026-11-15T02:00:00Z", ssid: null }]);
    expect(await listNetworksWithStats(t.db, me)).toHaveLength(0);
    // 空文字・空白だけは受信の形の検査で弾く（エージェントは null を送る）
    await expect(
      send("wfm_mac", [{ measuredAt: "2026-11-15T02:01:00Z", ssid: "   " }]),
    ).resolves.toMatchObject({ ok: false, status: 400 });
  });

  it("SSID が無ければ何もしない", async () => {
    expect(await ensureNetworks(t.db, me, [])).toEqual(new Map());
  });
});

describe("renameNetwork", () => {
  it("他人のネットワークの名前は変えない", async () => {
    const ids = await ensureNetworks(t.db, other, ["home"]);
    expect(await renameNetwork(t.db, me, ids.get("home")!, "乗っ取り")).toBe(
      false,
    );
    expect((await getNetwork(t.db, other, ids.get("home")!))?.name).toBe(
      "home",
    );
  });
});

describe("listNetworksWithStats", () => {
  it("最近計測した順に並べ、計測の無いネットワークは後ろにする", async () => {
    await ensureNetworks(t.db, me, ["old-empty"]);
    await send("wfm_mac", [
      { measuredAt: "2026-11-15T01:00:00Z", ssid: "earlier" },
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "later" },
    ]);
    const networks = await listNetworksWithStats(t.db, me);
    expect(networks.map((n) => [n.ssid, n.lastMeasuredAt])).toEqual([
      ["later", "2026-11-15T02:00:00.000Z"],
      ["earlier", "2026-11-15T01:00:00.000Z"],
      ["old-empty", null],
    ]);
  });
});

describe("getSeries（ネットワーク単位）", () => {
  it("そのネットワークにつないだ端末の計測をまとめて平均する", async () => {
    await send("wfm_mac", [
      { measuredAt: "2026-11-15T02:00:00Z", ssid: "home", latencyMs: 10 },
      { measuredAt: "2026-11-15T02:01:00Z", ssid: "office", latencyMs: 99 },
    ]);
    await send("wfm_pi", [
      { measuredAt: "2026-11-15T02:02:00Z", ssid: "home", latencyMs: 30 },
    ]);
    const [home] = (await listNetworksWithStats(t.db, me)).filter(
      (n) => n.ssid === "home",
    );
    const series = await getSeries(
      t.db,
      { networkId: home!.id },
      "2026-11-15T01:00:00.000Z",
      300,
    );
    expect(series).toEqual([
      expect.objectContaining({ count: 2, latencyMs: 20 }),
    ]);
  });
});
