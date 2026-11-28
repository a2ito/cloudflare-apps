import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { addMember, createTree, loadFamily } from "@/db/queries";
import type { Tree } from "@/db/schema";
import {
  actAs,
  EDITOR,
  OWNER,
  revalidated,
  STRANGER,
} from "@/test/action-mocks";
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
  deletePersonAction,
  linkPersonsAction,
  savePersonAction,
  unlinkPersonsAction,
} = await import("./persons");

let tree: Tree;

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  actAs(OWNER);
  revalidated.length = 0;
  tree = await createTree(t.db, OWNER, "山田家");
});

/** 人物を足して id を返す */
async function add(
  name: string,
  extra: Record<string, string | number> = {},
): Promise<number> {
  const result = await savePersonAction(
    {},
    formData({ treeId: tree.id, name, ...extra }),
  );
  if (!result.personId) throw new Error(result.error ?? "追加できませんでした");
  return result.personId;
}

describe("savePersonAction", () => {
  it("人物を追加する。空欄は null で持つ", async () => {
    const result = await savePersonAction(
      {},
      formData({
        treeId: tree.id,
        name: " 山田 太郎 ",
        kana: "",
        gender: "male",
        birthDate: "1950-04",
        deathDate: "",
        note: "",
      }),
    );
    expect(result).toMatchObject({ success: "山田 太郎 を追加しました" });
    const { persons } = await loadFamily(t.db, tree.id);
    expect(persons).toMatchObject([
      {
        id: result.personId,
        name: "山田 太郎",
        kana: null,
        gender: "male",
        birthDate: "1950-04",
        deathDate: null,
        note: null,
      },
    ]);
    expect(revalidated).toContain(`/trees/${tree.id}`);
  });

  it.each([
    [{ name: " " }, "名前を入力してください"],
    [
      { birthDate: "1950/4/1" },
      "生年月日は「1950」「1950-04」「1950-04-01」のように入力してください",
    ],
    [
      { birthDate: "2000", deathDate: "1999" },
      "没年月日が生年月日より前になっています",
    ],
    [{ gender: "x" }, "性別の値が不正です"],
  ])("不正な入力 %o は保存しない", async (override, error) => {
    expect(
      await savePersonAction(
        {},
        formData({ treeId: tree.id, name: "太郎", ...override }),
      ),
    ).toEqual({ error });
    expect((await loadFamily(t.db, tree.id)).persons).toHaveLength(0);
  });

  it("personId があればその人を直す", async () => {
    const id = await add("太郎");
    await savePersonAction(
      {},
      formData({
        treeId: tree.id,
        personId: id,
        name: "太郎",
        deathDate: "2020",
      }),
    );
    expect((await loadFamily(t.db, tree.id)).persons[0]).toMatchObject({
      id,
      deathDate: "2020",
    });
  });

  it("別の家系図の人物は直せない", async () => {
    const id = await add("太郎");
    const other = await createTree(t.db, OWNER, "別の家");
    expect(
      await savePersonAction(
        {},
        formData({ treeId: other.id, personId: id, name: "書き換え" }),
      ),
    ).toEqual({ error: "人物が見つかりません" });
    expect((await loadFamily(t.db, tree.id)).persons[0].name).toBe("太郎");
  });

  it("家族として追加すると、つながりも一緒にできる", async () => {
    const taro = await add("太郎");
    const hanako = await add("花子", { relativeOf: taro, kind: "partner" });
    const father = await add("父", { relativeOf: taro, kind: "parent" });
    const child = await add("一郎", { relativeOf: taro, kind: "child" });

    const family = await loadFamily(t.db, tree.id);
    expect(family.partners).toMatchObject([
      { personAId: taro, personBId: hanako },
    ]);
    expect(family.parents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parentId: father, childId: taro }),
        expect.objectContaining({ parentId: taro, childId: child }),
      ]),
    );
  });

  it("親が 2 人いる人に、3 人目の親は足さない", async () => {
    const taro = await add("太郎");
    await add("父", { relativeOf: taro, kind: "parent" });
    await add("母", { relativeOf: taro, kind: "parent" });
    expect(
      await savePersonAction(
        {},
        formData({
          treeId: tree.id,
          name: "3 人目",
          relativeOf: taro,
          kind: "parent",
        }),
      ),
    ).toEqual({ error: "親は 2 人までです" });
    expect((await loadFamily(t.db, tree.id)).persons).toHaveLength(3);
  });

  it("別の家系図の人物の家族としては足さない", async () => {
    const taro = await add("太郎");
    const other = await createTree(t.db, OWNER, "別の家");
    expect(
      await savePersonAction(
        {},
        formData({
          treeId: other.id,
          name: "花子",
          relativeOf: taro,
          kind: "partner",
        }),
      ),
    ).toEqual({ error: "つなぐ相手が見つかりません" });
  });
});

describe("権限", () => {
  it("共有された編集者は人物を足せる", async () => {
    await addMember(t.db, tree.id, EDITOR);
    actAs(EDITOR);
    expect(await add("太郎")).toBeGreaterThan(0);
  });

  it("メンバーでない人は読むことも書くこともできない", async () => {
    const id = await add("太郎");
    actAs(STRANGER);
    const denied = {
      error: "家系図が見つからないか、操作する権限がありません",
    };
    expect(
      await savePersonAction({}, formData({ treeId: tree.id, name: "侵入" })),
    ).toEqual(denied);
    expect(
      await deletePersonAction({}, formData({ treeId: tree.id, personId: id })),
    ).toEqual(denied);
    expect(
      (await loadFamily(t.db, tree.id)).persons.map((p) => p.name),
    ).toEqual(["太郎"]);
  });
});

describe("linkPersonsAction / unlinkPersonsAction", () => {
  it("家系図にいる 2 人を親子・配偶者としてつなぎ、外せる", async () => {
    const taro = await add("太郎");
    const hanako = await add("花子");
    const ichiro = await add("一郎");

    expect(
      await linkPersonsAction(
        {},
        formData({
          treeId: tree.id,
          personId: taro,
          otherId: hanako,
          kind: "partner",
        }),
      ),
    ).toHaveProperty("success");
    // 一郎から見て太郎は親
    expect(
      await linkPersonsAction(
        {},
        formData({
          treeId: tree.id,
          personId: ichiro,
          otherId: taro,
          kind: "parent",
        }),
      ),
    ).toHaveProperty("success");

    let family = await loadFamily(t.db, tree.id);
    expect(family.partners).toHaveLength(1);
    expect(family.parents).toMatchObject([{ parentId: taro, childId: ichiro }]);

    // 配偶者はどちらの順で指定しても外せる
    await unlinkPersonsAction(
      {},
      formData({ treeId: tree.id, kind: "partner", a: hanako, b: taro }),
    );
    await unlinkPersonsAction(
      {},
      formData({ treeId: tree.id, kind: "parent", a: taro, b: ichiro }),
    );
    family = await loadFamily(t.db, tree.id);
    expect(family.partners).toHaveLength(0);
    expect(family.parents).toHaveLength(0);
  });

  it("子孫を親にするような、一周するつながりは作らない", async () => {
    const taro = await add("太郎");
    const ichiro = await add("一郎", { relativeOf: taro, kind: "child" });
    expect(
      await linkPersonsAction(
        {},
        formData({
          treeId: tree.id,
          personId: taro,
          otherId: ichiro,
          kind: "parent",
        }),
      ),
    ).toEqual({ error: "親と子が逆向きにすでにつながっています" });
  });

  it("別の家系図の人物とはつながない", async () => {
    const taro = await add("太郎");
    const other = await createTree(t.db, OWNER, "別の家");
    const saved = await savePersonAction(
      {},
      formData({ treeId: other.id, name: "よその人" }),
    );
    expect(
      await linkPersonsAction(
        {},
        formData({
          treeId: tree.id,
          personId: taro,
          otherId: saved.personId ?? 0,
          kind: "partner",
        }),
      ),
    ).toEqual({ error: "人物が見つかりません" });
  });
});

describe("deletePersonAction", () => {
  it("人物を消すと、その人のつながりも消える", async () => {
    const taro = await add("太郎");
    await add("花子", { relativeOf: taro, kind: "partner" });
    await add("一郎", { relativeOf: taro, kind: "child" });

    expect(
      await deletePersonAction(
        {},
        formData({ treeId: tree.id, personId: taro }),
      ),
    ).toEqual({ success: "削除しました" });
    const family = await loadFamily(t.db, tree.id);
    expect(family.persons.map((p) => p.name).sort()).toEqual(["一郎", "花子"]);
    expect(family.parents).toHaveLength(0);
    expect(family.partners).toHaveLength(0);
  });
});

describe("同時に操作されたとき", () => {
  it("親が 2 人そろった後に古い画面から「＋親」を送っても、3 人目は作らず人物も残さない", async () => {
    const { createRelative, addParentLink } = await import("@/db/queries");
    const taro = await add("太郎");
    await add("父", { relativeOf: taro, kind: "parent" });
    const mother = await add("母");
    // 別の人が先に母をつないだ（アプリ側の人数確認をすり抜けた状況を DB の関数で直接作る）
    expect(await addParentLink(t.db, tree.id, mother, taro)).toBe("added");

    const input = {
      name: "3 人目",
      kana: null,
      gender: "unknown" as const,
      birthDate: null,
      deathDate: null,
      note: null,
    };
    expect(
      await createRelative(t.db, tree.id, taro, "parent", input),
    ).toBeNull();
    const family = await loadFamily(t.db, tree.id);
    expect(family.persons.map((p) => p.name)).not.toContain("3 人目");
    expect(family.parents.filter((l) => l.childId === taro)).toHaveLength(2);
  });

  it("二重のつながりや 3 人目の親は、DB の段階でも入らない", async () => {
    const { addParentLink, addPartnerLink } = await import("@/db/queries");
    const taro = await add("太郎");
    const a = await add("A");
    const b = await add("B");
    const c = await add("C");
    expect(await addParentLink(t.db, tree.id, a, taro)).toBe("added");
    expect(await addParentLink(t.db, tree.id, a, taro)).toBe("duplicate");
    expect(await addParentLink(t.db, tree.id, b, taro)).toBe("added");
    expect(await addParentLink(t.db, tree.id, c, taro)).toBe(
      "too_many_parents",
    );
    expect(await addPartnerLink(t.db, tree.id, a, b)).toBe("added");
    expect(await addPartnerLink(t.db, tree.id, b, a)).toBe("duplicate");
  });

  it("別の家系図の人物とのつながりは、DB の外部キーでも弾く", async () => {
    const taro = await add("太郎");
    const other = await createTree(t.db, OWNER, "別の家");
    const saved = await savePersonAction(
      {},
      formData({ treeId: other.id, name: "よその人" }),
    );
    await expect(
      t.d1
        .prepare(
          "INSERT INTO parent_child (tree_id, parent_id, child_id) VALUES (?, ?, ?)",
        )
        .bind(tree.id, saved.personId, taro)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe("メモの改行", () => {
  it("\\r\\n は 1 文字として数え、\\n にそろえて保存する", async () => {
    const note = "あ\r\n".repeat(250).trimEnd(); // \n にすると 499 文字
    const result = await savePersonAction(
      {},
      formData({ treeId: tree.id, name: "太郎", note }),
    );
    expect(result).toHaveProperty("success");
    const [p] = (await loadFamily(t.db, tree.id)).persons;
    expect(p.note).not.toContain("\r");
    expect(p.note?.length).toBe(499);
  });
});
