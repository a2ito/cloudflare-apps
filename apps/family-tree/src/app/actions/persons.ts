"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addParentLink,
  addPartnerLink,
  countPersons,
  createPerson,
  createRelative,
  deletePerson,
  findPerson,
  loadFamily,
  removeParentLink,
  removePartnerLink,
  updatePerson,
} from "@/db/queries";
import { accessFromForm } from "@/lib/access";
import {
  GENDERS,
  MAX_NOTE,
  MAX_PERSON_NAME,
  MAX_PERSONS_PER_TREE,
} from "@/lib/constants";
import { type ActionState, idFromForm, parseForm } from "@/lib/form";
import { isFuzzyDate, isLifespanOrdered } from "@/lib/fuzzy-date";
import {
  checkParentLink,
  checkPartnerLink,
  MAX_PARENTS,
} from "@/lib/relations";

export type PersonActionState = ActionState & {
  /** 保存した人物。グラフでその人を選んだままにするために返す */
  personId?: number;
};

/** 空欄は null として持つ */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .pipe(z.string().max(max, message))
    .transform((s) => (s === "" ? null : s));

const optionalDate = (label: string) =>
  optionalText(10, `${label}の形式が正しくありません`).refine(
    (s) => s === null || isFuzzyDate(s),
    `${label}は「1950」「1950-04」「1950-04-01」のように入力してください`,
  );

const personSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "名前を入力してください")
      .max(MAX_PERSON_NAME, "名前が長すぎます"),
    kana: optionalText(MAX_PERSON_NAME, "よみがなが長すぎます"),
    gender: z.enum(GENDERS, { error: "性別の値が不正です" }).default("unknown"),
    birthDate: optionalDate("生年月日"),
    deathDate: optionalDate("没年月日"),
    note: optionalText(
      MAX_NOTE,
      `メモは ${MAX_NOTE} 文字以内で入力してください`,
    ),
  })
  .refine((p) => isLifespanOrdered(p.birthDate, p.deathDate), {
    message: "没年月日が生年月日より前になっています",
  });

const relativeSchema = z.object({
  relativeOf: idFromForm,
  kind: z.enum(["parent", "child", "partner"]),
});

const revalidateTree = (treeId: number) => revalidatePath(`/trees/${treeId}`);

/**
 * 人物を保存する。
 * - personId があればその人を直す
 * - relativeOf と kind があれば、新しい人を作ってその人とつなぐ（kind は新しい人から見た続柄）
 * - どちらも無ければ、つながりの無い人を作る
 */
export async function savePersonAction(
  _prev: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const r = await accessFromForm(formData);
  if ("error" in r) return { error: r.error };
  const { db, tree } = r.access;

  const parsed = parseForm(personSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const input = parsed.data;

  if (formData.get("personId")) {
    const personId = idFromForm.safeParse(formData.get("personId"));
    if (!personId.success) return { error: "人物の ID が不正です" };
    if (!(await updatePerson(db, tree.id, personId.data, input)))
      return { error: "人物が見つかりません" };
    revalidateTree(tree.id);
    return { success: `${input.name} を保存しました`, personId: personId.data };
  }

  if ((await countPersons(db, tree.id)) >= MAX_PERSONS_PER_TREE)
    return {
      error: `1 つの家系図に載せられるのは ${MAX_PERSONS_PER_TREE} 人までです`,
    };

  if (formData.get("relativeOf")) {
    const rel = relativeSchema.safeParse({
      relativeOf: formData.get("relativeOf"),
      kind: formData.get("kind"),
    });
    if (!rel.success) return { error: "続柄の指定が不正です" };
    const { relativeOf, kind } = rel.data;
    if (!(await findPerson(db, tree.id, relativeOf)))
      return { error: "つなぐ相手が見つかりません" };
    if (kind === "parent") {
      const { parents } = await loadFamily(db, tree.id);
      if (parents.filter((l) => l.childId === relativeOf).length >= MAX_PARENTS)
        return { error: `親は ${MAX_PARENTS} 人までです` };
    }
    const person = await createRelative(db, tree.id, relativeOf, kind, input);
    revalidateTree(tree.id);
    return { success: `${input.name} を追加しました`, personId: person.id };
  }

  const person = await createPerson(db, tree.id, input);
  revalidateTree(tree.id);
  return { success: `${input.name} を追加しました`, personId: person.id };
}

export async function deletePersonAction(
  _prev: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const r = await accessFromForm(formData);
  if ("error" in r) return { error: r.error };
  const personId = idFromForm.safeParse(formData.get("personId"));
  if (!personId.success) return { error: "人物の ID が不正です" };

  const { db, tree } = r.access;
  if (!(await deletePerson(db, tree.id, personId.data)))
    return { error: "人物が見つかりません" };
  revalidateTree(tree.id);
  return { success: "削除しました" };
}

const linkSchema = z.object({
  personId: idFromForm,
  otherId: idFromForm,
  /** other が person から見て何にあたるか */
  kind: z.enum(["parent", "child", "partner"], {
    error: "続柄を選んでください",
  }),
});

/** 家系図にいる 2 人をつなぐ */
export async function linkPersonsAction(
  _prev: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const r = await accessFromForm(formData);
  if ("error" in r) return { error: r.error };
  const parsed = linkSchema.safeParse({
    personId: formData.get("personId"),
    otherId: formData.get("otherId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: "つなぐ相手を選んでください" };
  const { personId, otherId, kind } = parsed.data;

  const { db, tree } = r.access;
  const family = await loadFamily(db, tree.id);
  const ids = new Set(family.persons.map((p) => p.id));
  if (!ids.has(personId) || !ids.has(otherId))
    return { error: "人物が見つかりません" };

  if (kind === "partner") {
    const check = checkPartnerLink(
      family.parents,
      family.partners,
      personId,
      otherId,
    );
    if (!check.ok) return { error: check.error };
    await addPartnerLink(db, tree.id, personId, otherId);
  } else {
    const [parentId, childId] =
      kind === "parent" ? [otherId, personId] : [personId, otherId];
    const check = checkParentLink(
      family.parents,
      family.partners,
      parentId,
      childId,
    );
    if (!check.ok) return { error: check.error };
    await addParentLink(db, tree.id, parentId, childId);
  }
  revalidateTree(tree.id);
  return { success: "つなぎました", personId };
}

const unlinkSchema = z.object({
  kind: z.enum(["parent", "partner"]),
  /** parent のときは親、partner のときはどちらか一方 */
  a: idFromForm,
  /** parent のときは子、partner のときはもう一方 */
  b: idFromForm,
});

export async function unlinkPersonsAction(
  _prev: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const r = await accessFromForm(formData);
  if ("error" in r) return { error: r.error };
  const parsed = unlinkSchema.safeParse({
    kind: formData.get("kind"),
    a: formData.get("a"),
    b: formData.get("b"),
  });
  if (!parsed.success) return { error: "つながりの指定が不正です" };
  const { kind, a, b } = parsed.data;

  const { db, tree } = r.access;
  const removed =
    kind === "parent"
      ? await removeParentLink(db, tree.id, a, b)
      : await removePartnerLink(db, tree.id, a, b);
  if (!removed) return { error: "つながりが見つかりません" };
  revalidateTree(tree.id);
  return { success: "つながりを外しました" };
}
