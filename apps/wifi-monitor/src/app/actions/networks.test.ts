import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ensureNetworks, getNetwork, upsertUser } from "@/db/queries";
import { revalidated } from "@/test/action-mocks";
import { createTestEnv, formData, type TestEnv } from "@/test/d1";

let t: TestEnv;
vi.mock("@/lib/auth", async () => ({
  requireUser: async () => (await import("@/test/action-mocks")).fakeUser,
}));
vi.mock("@/lib/cloudflare", () => ({ getEnv: () => Promise.resolve(t.env) }));
vi.mock("next/cache", async () => {
  const { revalidated } = await import("@/test/action-mocks");
  return { revalidatePath: (p: string) => void revalidated.push(p) };
});
const { renameNetworkAction } = await import("./networks");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());

let mine: number;
let theirs: number;
beforeEach(async () => {
  await t.truncate();
  // fakeUser（id 1）と、もう 1 人
  await upsertUser(t.db, {
    email: "tester@example.com",
    name: null,
    image: null,
  });
  const other = await upsertUser(t.db, {
    email: "other@example.com",
    name: null,
    image: null,
  });
  mine = (await ensureNetworks(t.db, 1, ["home-5G"])).get("home-5G")!;
  theirs = (await ensureNetworks(t.db, other.id, ["home-5G"])).get("home-5G")!;
  revalidated.length = 0;
});

describe("renameNetworkAction", () => {
  it("自分のネットワークの名前を変え、SSID はそのまま残す", async () => {
    expect(
      await renameNetworkAction(
        { status: "idle" },
        formData({ id: mine, name: "  自宅  " }),
      ),
    ).toEqual({ status: "saved", name: "自宅" });
    expect(await getNetwork(t.db, 1, mine)).toMatchObject({
      name: "自宅",
      ssid: "home-5G",
    });
    expect(revalidated).toEqual(["/", `/networks/${mine}`, "/devices/[id]"]);
  });

  it.each([
    ["   ", "名前を入力してください"],
    ["x".repeat(41), "名前は 40 文字以内で入力してください"],
  ])("名前 %j は受け付けない", async (name, error) => {
    expect(
      await renameNetworkAction(
        { status: "idle" },
        formData({ id: mine, name }),
      ),
    ).toEqual({ status: "error", error });
  });

  it("他人のネットワークの ID を送られても変えない", async () => {
    expect(
      await renameNetworkAction(
        { status: "idle" },
        formData({ id: theirs, name: "乗っ取り" }),
      ),
    ).toEqual({ status: "error", error: "ネットワークが見つかりません" });
  });
});
