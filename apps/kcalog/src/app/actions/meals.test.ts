import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createMeal, listMealsOn, upsertUser } from "@/db/queries";
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
const { addMeal, deleteMealAction } = await import("./meals");

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

const valid = {
  eatenOn: "2026-09-25",
  foodName: "おにぎり（鮭）",
  kcal: "180",
};

describe("addMeal", () => {
  it("食品名とカロリーを自分の記録として保存する", async () => {
    const result = await addMeal({}, formData(valid));
    expect(result).toEqual({ success: "おにぎり（鮭） を記録しました" });

    const rows = await listMealsOn(t.db, 1, "2026-09-25");
    expect(rows).toMatchObject([
      {
        userId: 1,
        eatenOn: "2026-09-25",
        foodName: "おにぎり（鮭）",
        kcal: 180,
      },
    ]);
    expect(revalidated).toContain("/");
  });

  it("0 kcal は記録できる（お茶など）", async () => {
    expect(await addMeal({}, formData({ ...valid, kcal: "0" }))).toHaveProperty(
      "success",
    );
  });

  it.each([
    [{ foodName: "  " }, "食品名を入力してください"],
    [{ kcal: "" }, "カロリーを入力してください"],
    [{ kcal: "abc" }, "カロリーは数値で入力してください"],
    [{ kcal: "12.5" }, "カロリーは整数で入力してください"],
    [{ kcal: "-1" }, "カロリーは 0 以上で入力してください"],
    [{ kcal: "10000" }, "カロリーは 9999 以下で入力してください"],
    [{ eatenOn: "2026-02-30" }, "日付の形式が不正です"],
  ])("不正な入力 %o は保存しない", async (override, error) => {
    expect(await addMeal({}, formData({ ...valid, ...override }))).toEqual({
      error,
    });
    expect(await listMealsOn(t.db, 1, valid.eatenOn)).toHaveLength(0);
  });
});

describe("deleteMealAction", () => {
  it("自分の記録を消す", async () => {
    const meal = await createMeal(t.db, 1, {
      eatenOn: "2026-09-25",
      foodName: "ラーメン",
      kcal: 600,
    });
    await deleteMealAction(formData({ id: meal.id }));
    expect(await listMealsOn(t.db, 1, "2026-09-25")).toHaveLength(0);
  });

  it("他人の記録は消さない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const meal = await createMeal(t.db, other.id, {
      eatenOn: "2026-09-25",
      foodName: "カレー",
      kcal: 800,
    });
    await deleteMealAction(formData({ id: meal.id }));
    expect(await listMealsOn(t.db, other.id, "2026-09-25")).toHaveLength(1);
  });
});

describe("listMealsOn", () => {
  it("持ち主とその日の記録だけを返す", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    await createMeal(t.db, 1, {
      eatenOn: "2026-09-25",
      foodName: "朝",
      kcal: 300,
    });
    await createMeal(t.db, 1, {
      eatenOn: "2026-09-24",
      foodName: "前日",
      kcal: 500,
    });
    await createMeal(t.db, other.id, {
      eatenOn: "2026-09-25",
      foodName: "他人",
      kcal: 700,
    });
    expect(
      (await listMealsOn(t.db, 1, "2026-09-25")).map((m) => m.foodName),
    ).toEqual(["朝"]);
  });
});
