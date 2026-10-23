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
  createExercise,
  createMenu,
  listExercises,
  listMenus,
  upsertUser,
} from "@/db/queries";
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
const {
  addExercise,
  addMenu,
  addMenuItemAction,
  deleteExerciseAction,
  deleteMenuAction,
  removeMenuItemAction,
  updateExerciseAction,
} = await import("./plan");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  await upsertUser(t.db, {
    email: "tester@example.com",
    name: "Tester",
    image: null,
  });
  revalidated.length = 0;
});

const validExercise = {
  name: "ベンチプレス",
  targetSets: "3",
  targetReps: "10",
  weight: "60",
  increment: "2.5",
};
const benchInput = {
  name: "ベンチプレス",
  targetSets: 3,
  targetReps: 10,
  weight: 60,
  increment: 2.5,
};

describe("addExercise", () => {
  it("種目と目標を自分のものとして保存する", async () => {
    expect(await addExercise({}, formData(validExercise))).toEqual({
      success: "ベンチプレス を追加しました",
    });
    expect(await listExercises(t.db, 1)).toMatchObject([
      { userId: 1, ...benchInput },
    ]);
    expect(revalidated).toEqual(expect.arrayContaining(["/plan", "/"]));
  });

  it("自重種目として 0kg・上げ幅 0 を通す", async () => {
    expect(
      await addExercise(
        {},
        formData({ ...validExercise, weight: "0", increment: "0" }),
      ),
    ).toHaveProperty("success");
  });

  it.each([
    [{ name: " " }, "種目名を入力してください"],
    [{ targetSets: "" }, "セット数を入力してください"],
    [{ targetSets: "0" }, "セット数は 1 以上で入力してください"],
    [{ targetSets: "11" }, "セット数は 10 以下で入力してください"],
    [{ targetReps: "8.5" }, "回数は整数で入力してください"],
    [{ weight: "abc" }, "重量は数値で入力してください"],
    [{ weight: "60.1" }, "重量は 0〜500kg を 0.25kg 刻みで入力してください"],
    [{ increment: "25" }, "上げ幅は 0〜20kg を 0.25kg 刻みで入力してください"],
  ])("不正な入力 %o は保存しない", async (override, error) => {
    expect(
      await addExercise({}, formData({ ...validExercise, ...override })),
    ).toEqual({ error });
    expect(await listExercises(t.db, 1)).toHaveLength(0);
  });
});

describe("updateExerciseAction", () => {
  it("自分の種目の目標を書き換える", async () => {
    const bench = await createExercise(t.db, 1, benchInput);
    const result = await updateExerciseAction(
      {},
      formData({ ...validExercise, id: bench.id, weight: "55" }),
    );
    expect(result).toEqual({ success: "ベンチプレス を更新しました" });
    expect((await listExercises(t.db, 1))[0]?.weight).toBe(55);
  });

  it("他人の種目は書き換えない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const theirs = await createExercise(t.db, other.id, benchInput);
    expect(
      await updateExerciseAction(
        {},
        formData({ ...validExercise, id: theirs.id, weight: "10" }),
      ),
    ).toEqual({
      error: "種目が見つかりません",
    });
    expect((await listExercises(t.db, other.id))[0]?.weight).toBe(60);
  });
});

describe("menus", () => {
  it("メニューを作り、種目を入れて外せる", async () => {
    const bench = await createExercise(t.db, 1, benchInput);
    expect(await addMenu({}, formData({ name: "A" }))).toEqual({
      success: "A を追加しました",
    });
    const [menu] = await listMenus(t.db, 1);
    if (!menu) throw new Error("メニューが作られていない");

    expect(
      await addMenuItemAction(
        {},
        formData({ menuId: menu.id, exerciseId: bench.id }),
      ),
    ).toEqual({ success: "種目を入れました" });
    expect(
      await addMenuItemAction(
        {},
        formData({ menuId: menu.id, exerciseId: bench.id }),
      ),
    ).toEqual({
      error: "この種目はすでに入っています",
    });
    const [withItem] = await listMenus(t.db, 1);
    expect(withItem?.exercises.map((e) => e.name)).toEqual(["ベンチプレス"]);

    await removeMenuItemAction(
      formData({ id: withItem?.exercises[0]?.itemId }),
    );
    expect((await listMenus(t.db, 1))[0]?.exercises).toEqual([]);
  });

  it("他人の種目は自分のメニューに入れられない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const theirs = await createExercise(t.db, other.id, benchInput);
    const menu = await createMenu(t.db, 1, "A");
    expect(
      await addMenuItemAction(
        {},
        formData({ menuId: menu.id, exerciseId: theirs.id }),
      ),
    ).toHaveProperty("error");
    expect((await listMenus(t.db, 1))[0]?.exercises).toEqual([]);
  });

  it("他人のメニューの種目は外せない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const theirs = await createExercise(t.db, other.id, benchInput);
    const theirMenu = await createMenu(t.db, other.id, "A");
    const { addMenuItem } = await import("@/db/queries");
    await addMenuItem(t.db, other.id, theirMenu.id, theirs.id);
    const [menu] = await listMenus(t.db, other.id);

    await removeMenuItemAction(formData({ id: menu?.exercises[0]?.itemId }));
    expect((await listMenus(t.db, other.id))[0]?.exercises).toHaveLength(1);
  });

  it("種目を消すとメニューからも外れる。メニューを消しても種目は残る", async () => {
    const bench = await createExercise(t.db, 1, benchInput);
    const squat = await createExercise(t.db, 1, {
      ...benchInput,
      name: "スクワット",
    });
    const menu = await createMenu(t.db, 1, "A");
    await addMenuItemAction(
      {},
      formData({ menuId: menu.id, exerciseId: bench.id }),
    );
    await addMenuItemAction(
      {},
      formData({ menuId: menu.id, exerciseId: squat.id }),
    );

    await deleteExerciseAction(formData({ id: bench.id }));
    expect((await listMenus(t.db, 1))[0]?.exercises.map((e) => e.name)).toEqual(
      ["スクワット"],
    );

    await deleteMenuAction(formData({ id: menu.id }));
    expect(await listMenus(t.db, 1)).toEqual([]);
    expect((await listExercises(t.db, 1)).map((e) => e.name)).toEqual([
      "スクワット",
    ]);
  });
});
