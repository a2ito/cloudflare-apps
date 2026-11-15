import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createDevice,
  findDeviceByTokenHash,
  listDevicesWithLatest,
  upsertUser,
} from "@/db/queries";
import { MAX_DEVICES_PER_USER } from "@/lib/limits";
import { hashToken } from "@/lib/token";
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
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
const { createDeviceAction, deleteDeviceAction } = await import("./devices");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());

let otherUserId: number;
beforeEach(async () => {
  await t.truncate();
  // fakeUser（id 1）と、もう 1 人
  await upsertUser(t.db, {
    email: "tester@example.com",
    name: "Tester",
    image: null,
  });
  otherUserId = (
    await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    })
  ).id;
  revalidated.length = 0;
});

describe("createDeviceAction", () => {
  it("端末を登録し、トークンを 1 回だけ返す（DB にはハッシュだけ残す）", async () => {
    const result = await createDeviceAction(
      { status: "idle" },
      formData({ name: "  書斎の Mac  " }),
    );
    if (result.status !== "created")
      throw new Error(`登録に失敗: ${JSON.stringify(result)}`);
    expect(result.name).toBe("書斎の Mac");

    const device = await findDeviceByTokenHash(
      t.db,
      await hashToken(result.token),
    );
    expect(device).toMatchObject({ userId: 1, name: "書斎の Mac" });
    expect(device?.tokenHash).not.toContain(result.token);
    expect(revalidated).toContain("/");
  });

  it.each([
    ["", "端末名を入力してください"],
    ["   ", "端末名を入力してください"],
    ["x".repeat(41), "端末名は 40 文字以内で入力してください"],
  ])("端末名 %j は登録しない", async (name, error) => {
    expect(
      await createDeviceAction({ status: "idle" }, formData({ name })),
    ).toEqual({
      status: "error",
      error,
    });
    expect(await listDevicesWithLatest(t.db, 1)).toHaveLength(0);
  });

  it(`${MAX_DEVICES_PER_USER} 台を超えては登録できない`, async () => {
    for (let i = 0; i < MAX_DEVICES_PER_USER; i++) {
      await createDevice(t.db, 1, { name: `d${i}`, tokenHash: `h${i}` });
    }
    expect(
      await createDeviceAction(
        { status: "idle" },
        formData({ name: "もう 1 台" }),
      ),
    ).toMatchObject({ status: "error" });
  });
});

describe("deleteDeviceAction", () => {
  it("自分の端末を計測ごと消す", async () => {
    const device = await createDevice(t.db, 1, {
      name: "Mac",
      tokenHash: "h1",
    });
    await t.d1
      .prepare("INSERT INTO samples (device_id, measured_at) VALUES (?, ?)")
      .bind(device.id, "2026-11-15T00:00:00.000Z")
      .run();

    await expect(
      deleteDeviceAction(formData({ id: device.id })),
    ).rejects.toThrow("redirect:/");
    expect(await listDevicesWithLatest(t.db, 1)).toHaveLength(0);
    const left = await t.d1
      .prepare("SELECT count(*) AS n FROM samples")
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("他人の端末の ID を送られても消さない", async () => {
    const other = await createDevice(t.db, otherUserId, {
      name: "他人の",
      tokenHash: "h2",
    });
    await expect(
      deleteDeviceAction(formData({ id: other.id })),
    ).rejects.toThrow("redirect:/");
    expect(await listDevicesWithLatest(t.db, otherUserId)).toHaveLength(1);
  });
});

describe("listDevicesWithLatest", () => {
  it("自分の端末だけを、計測時刻が最新の計測つきで返す", async () => {
    const mine = await createDevice(t.db, 1, { name: "Mac", tokenHash: "h1" });
    await createDevice(t.db, otherUserId, { name: "他人の", tokenHash: "h2" });
    // 後から届いた古い計測（id は大きいが計測時刻は古い）を最新と取り違えない
    for (const at of ["2026-11-15T02:00:00.000Z", "2026-11-15T01:00:00.000Z"]) {
      await t.d1
        .prepare("INSERT INTO samples (device_id, measured_at) VALUES (?, ?)")
        .bind(mine.id, at)
        .run();
    }

    const devices = await listDevicesWithLatest(t.db, 1);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      name: "Mac",
      latest: { measuredAt: "2026-11-15T02:00:00.000Z" },
    });
  });
});
