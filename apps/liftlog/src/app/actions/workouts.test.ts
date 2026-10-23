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
  addMenuItem,
  createExercise,
  createMenu,
  latestWorkout,
  listExercises,
  listWorkouts,
  upsertUser,
} from "@/db/queries";
import { repsField, weightField } from "@/lib/workout-form";
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
const { deleteWorkoutAction, recordWorkout } = await import("./workouts");

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

/** ベンチプレス 60kg × 10 回 × 2 セットだけが入ったメニュー A を作る */
async function setupMenu() {
  const bench = await createExercise(t.db, 1, {
    name: "ベンチプレス",
    targetSets: 2,
    targetReps: 10,
    weight: 60,
    increment: 2.5,
  });
  const menu = await createMenu(t.db, 1, "A");
  await addMenuItem(t.db, 1, menu.id, bench.id);
  return { bench, menu };
}

function sets(exerciseId: number, done: [weight: string, reps: string][]) {
  return Object.fromEntries(
    done.flatMap(([w, r], i) => [
      [weightField(exerciseId, i + 1), w],
      [repsField(exerciseId, i + 1), r],
    ]),
  );
}

describe("recordWorkout", () => {
  it("実績を保存し、全セットで目標回数に届いたら次回の重量を上げる", async () => {
    const { bench, menu } = await setupMenu();
    const fd = formData({
      menuId: menu.id,
      performedOn: "2026-09-25",
      ...sets(bench.id, [
        ["60", "10"],
        ["60", "11"],
      ]),
    });

    expect(await recordWorkout({}, fd)).toEqual({
      success: "A を記録しました",
    });

    const [workout] = await listWorkouts(t.db, 1, 10);
    expect(workout).toMatchObject({
      menuId: menu.id,
      menuName: "A",
      performedOn: "2026-09-25",
    });
    expect(workout?.sets).toMatchObject([
      {
        exerciseName: "ベンチプレス",
        setNumber: 1,
        weight: 60,
        reps: 10,
        targetReps: 10,
      },
      {
        exerciseName: "ベンチプレス",
        setNumber: 2,
        weight: 60,
        reps: 11,
        targetReps: 10,
      },
    ]);
    expect((await listExercises(t.db, 1))[0]?.weight).toBe(62.5);
    expect(revalidated).toEqual(
      expect.arrayContaining(["/", "/history", "/plan"]),
    );
  });

  it("届かなかったセットがあれば重量は据え置く", async () => {
    const { bench, menu } = await setupMenu();
    const fd = formData({
      menuId: menu.id,
      performedOn: "2026-09-25",
      ...sets(bench.id, [
        ["60", "10"],
        ["60", "7"],
      ]),
    });
    await recordWorkout({}, fd);
    expect((await listExercises(t.db, 1))[0]?.weight).toBe(60);
  });

  it("入力が不正なら何も保存しない", async () => {
    const { bench, menu } = await setupMenu();
    const fd = formData({
      menuId: menu.id,
      performedOn: "2026-09-25",
      ...sets(bench.id, [["60", "abc"]]),
    });
    expect(await recordWorkout({}, fd)).toEqual({
      error:
        "ベンチプレス の 1 セット目: 回数は 0〜100 の整数で入力してください",
    });
    expect(await latestWorkout(t.db, 1)).toBeUndefined();
  });

  it("1 セットも入っていなければ保存せず、ローテーションも進めない", async () => {
    const { menu } = await setupMenu();
    expect(
      await recordWorkout(
        {},
        formData({ menuId: menu.id, performedOn: "2026-09-25" }),
      ),
    ).toEqual({
      error: "1 セット以上入力してください",
    });
    expect(await latestWorkout(t.db, 1)).toBeUndefined();
  });

  it("他人のメニューには記録できない", async () => {
    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const menu = await createMenu(t.db, other.id, "他人の A");
    expect(
      await recordWorkout(
        {},
        formData({ menuId: menu.id, performedOn: "2026-09-25" }),
      ),
    ).toEqual({
      error: "メニューが見つかりません",
    });
  });

  it("種目やメニューを消しても、履歴は記録したときの名前で残る", async () => {
    const { bench, menu } = await setupMenu();
    await recordWorkout(
      {},
      formData({
        menuId: menu.id,
        performedOn: "2026-09-25",
        ...sets(bench.id, [["60", "10"]]),
      }),
    );
    await t.d1.batch([
      t.d1.prepare("DELETE FROM exercises"),
      t.d1.prepare("DELETE FROM menus"),
    ]);

    const [workout] = await listWorkouts(t.db, 1, 10);
    expect(workout).toMatchObject({ menuId: null, menuName: "A" });
    expect(workout?.sets).toMatchObject([
      { exerciseId: null, exerciseName: "ベンチプレス", weight: 60, reps: 10 },
    ]);
  });

  it("日付が不正なら保存しない", async () => {
    const { bench, menu } = await setupMenu();
    const fd = formData({
      menuId: menu.id,
      performedOn: "2026-02-30",
      ...sets(bench.id, [["60", "10"]]),
    });
    expect(await recordWorkout({}, fd)).toEqual({
      error: "日付の形式が不正です",
    });
  });
});

describe("deleteWorkoutAction", () => {
  it("自分の記録を消す。他人の記録は消さない", async () => {
    const { bench, menu } = await setupMenu();
    await recordWorkout(
      {},
      formData({
        menuId: menu.id,
        performedOn: "2026-09-25",
        ...sets(bench.id, [["60", "10"]]),
      }),
    );
    const mine = await latestWorkout(t.db, 1);

    const other = await upsertUser(t.db, {
      email: "other@example.com",
      name: null,
      image: null,
    });
    const otherMenu = await createMenu(t.db, other.id, "B");
    const otherBench = await createExercise(t.db, other.id, {
      name: "スクワット",
      targetSets: 1,
      targetReps: 5,
      weight: 80,
      increment: 2.5,
    });
    await addMenuItem(t.db, other.id, otherMenu.id, otherBench.id);
    const { saveWorkout } = await import("@/db/queries");
    const theirs = await saveWorkout(t.db, other.id, {
      menu: otherMenu,
      performedOn: "2026-09-25",
      entries: [
        {
          exerciseId: otherBench.id,
          sets: [{ setNumber: 1, weight: 80, reps: 5 }],
        },
      ],
    });

    await deleteWorkoutAction(formData({ id: theirs.id }));
    await deleteWorkoutAction(formData({ id: mine?.id }));
    expect(await listWorkouts(t.db, 1, 10)).toHaveLength(0);
    expect(await listWorkouts(t.db, other.id, 10)).toHaveLength(1);
  });
});
