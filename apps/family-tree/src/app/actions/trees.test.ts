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
  createPerson,
  createTree,
  listMembers,
  listTreesFor,
  loadFamily,
} from "@/db/queries";
import {
  actAs,
  EDITOR,
  OWNER,
  RedirectError,
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
vi.mock("next/navigation", async () => {
  const { RedirectError } = await import("@/test/action-mocks");
  return {
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
  };
});
const {
  addMemberAction,
  createTreeAction,
  deleteTreeAction,
  removeMemberAction,
  renameTreeAction,
} = await import("./trees");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());
beforeEach(async () => {
  await t.truncate();
  actAs(OWNER);
  revalidated.length = 0;
});

async function redirectOf(p: Promise<unknown>): Promise<string> {
  const error = await p.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof RedirectError))
    throw new Error("redirect されませんでした");
  return error.url;
}

describe("createTreeAction", () => {
  it("家系図を作り、作った人を持ち主にして開く", async () => {
    const url = await redirectOf(
      createTreeAction({}, formData({ name: " 山田家 " })),
    );
    const [tree] = await listTreesFor(t.db, OWNER);
    expect(tree).toMatchObject({
      name: "山田家",
      role: "owner",
      personCount: 0,
    });
    expect(url).toBe(`/trees/${tree.id}`);
  });

  it("名前が空なら作らない", async () => {
    expect(await createTreeAction({}, formData({ name: "  " }))).toEqual({
      error: "家系図の名前を入力してください",
    });
    expect(await listTreesFor(t.db, OWNER)).toHaveLength(0);
  });

  it("1 人で何枚でも持てる", async () => {
    await redirectOf(createTreeAction({}, formData({ name: "父方" })));
    await redirectOf(createTreeAction({}, formData({ name: "母方" })));
    expect((await listTreesFor(t.db, OWNER)).map((x) => x.name)).toEqual([
      "父方",
      "母方",
    ]);
  });
});

describe("共有", () => {
  it("持ち主はメールで共有でき、共有された人の一覧に出る", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    expect(
      await addMemberAction(
        {},
        formData({ treeId: tree.id, email: " Editor@Example.com " }),
      ),
    ).toEqual({ success: `${EDITOR} と共有しました` });
    expect(await listTreesFor(t.db, EDITOR)).toMatchObject([
      { id: tree.id, role: "editor" },
    ]);
  });

  it("同じ人を二重に共有しない", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    await addMemberAction({}, formData({ treeId: tree.id, email: EDITOR }));
    expect(
      await addMemberAction({}, formData({ treeId: tree.id, email: EDITOR })),
    ).toEqual({ error: "すでに共有しています" });
  });

  it("メールの形でなければ弾く", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    expect(
      await addMemberAction(
        {},
        formData({ treeId: tree.id, email: "not-mail" }),
      ),
    ).toEqual({ error: "メールアドレスの形式が正しくありません" });
  });

  it("編集者は共有を増やせない", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    await addMemberAction({}, formData({ treeId: tree.id, email: EDITOR }));
    actAs(EDITOR);
    expect(
      await addMemberAction({}, formData({ treeId: tree.id, email: STRANGER })),
    ).toEqual({ error: "この操作は家系図の持ち主しかできません" });
  });

  it("持ち主は編集者を外せるが、持ち主自身は外せない", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    await addMemberAction({}, formData({ treeId: tree.id, email: EDITOR }));

    expect(
      await removeMemberAction({}, formData({ treeId: tree.id, email: OWNER })),
    ).toEqual({ error: "外せるのは編集者だけです" });
    expect(
      await removeMemberAction(
        {},
        formData({ treeId: tree.id, email: EDITOR }),
      ),
    ).toHaveProperty("success");
    expect((await listMembers(t.db, tree.id)).map((m) => m.email)).toEqual([
      OWNER,
    ]);
  });

  it("メンバーでない人には、家系図があることも教えない", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    actAs(STRANGER);
    expect(
      await addMemberAction({}, formData({ treeId: tree.id, email: STRANGER })),
    ).toEqual({ error: "家系図が見つからないか、操作する権限がありません" });
    expect(await listMembers(t.db, tree.id)).toHaveLength(1);
  });
});

describe("renameTreeAction", () => {
  it("持ち主は名前を変えられる", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    expect(
      await renameTreeAction(
        {},
        formData({ treeId: tree.id, name: "山田家（本家）" }),
      ),
    ).toHaveProperty("success");
    expect((await listTreesFor(t.db, OWNER))[0].name).toBe("山田家（本家）");
  });

  it("編集者は変えられない", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    await addMemberAction({}, formData({ treeId: tree.id, email: EDITOR }));
    actAs(EDITOR);
    expect(
      await renameTreeAction(
        {},
        formData({ treeId: tree.id, name: "乗っ取り" }),
      ),
    ).toHaveProperty("error");
    expect((await listTreesFor(t.db, OWNER))[0].name).toBe("山田家");
  });
});

describe("deleteTreeAction", () => {
  it("名前を打てば、人物ごと消して一覧へ戻る", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    await createPerson(t.db, tree.id, {
      name: "太郎",
      kana: null,
      gender: "male",
      birthDate: null,
      deathDate: null,
      note: null,
    });
    const url = await redirectOf(
      deleteTreeAction({}, formData({ treeId: tree.id, confirm: "山田家" })),
    );
    expect(url).toBe("/");
    expect(await listTreesFor(t.db, OWNER)).toHaveLength(0);
    expect((await loadFamily(t.db, tree.id)).persons).toHaveLength(0);
  });

  it("名前が違えば消さない", async () => {
    const tree = await createTree(t.db, OWNER, "山田家");
    expect(
      await deleteTreeAction(
        {},
        formData({ treeId: tree.id, confirm: "山田" }),
      ),
    ).toEqual({ error: "確認のため、家系図の名前を正しく入力してください" });
    expect(await listTreesFor(t.db, OWNER)).toHaveLength(1);
  });
});
