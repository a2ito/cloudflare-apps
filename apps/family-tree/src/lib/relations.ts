/**
 * 親子・配偶者のつながりを足してよいかの判定。DB に触らない純粋関数にしておき、
 * サーバーアクションは家系図 1 枚ぶんのつながりを読んでからここで確かめる。
 */

export type ParentLink = { parentId: number; childId: number };
export type PartnerLink = { personAId: number; personBId: number };

export const MAX_PARENTS = 2;

export type RelationCheck = { ok: true } | { ok: false; error: string };

const ok: RelationCheck = { ok: true };
const ng = (error: string): RelationCheck => ({ ok: false, error });

/** from から子の向きにたどって to に着くか（to が from の子孫か） */
export function isDescendant(
  links: readonly ParentLink[],
  from: number,
  to: number,
): boolean {
  const children = new Map<number, number[]>();
  for (const l of links) {
    const list = children.get(l.parentId) ?? [];
    list.push(l.childId);
    children.set(l.parentId, list);
  }
  const seen = new Set<number>();
  const stack = [...(children.get(from) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as number;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return false;
}

export function checkParentLink(
  links: readonly ParentLink[],
  partners: readonly PartnerLink[],
  parentId: number,
  childId: number,
): RelationCheck {
  if (parentId === childId) return ng("自分自身を親にはできません");
  if (links.some((l) => l.parentId === parentId && l.childId === childId))
    return ng("すでに親子としてつながっています");
  if (links.some((l) => l.parentId === childId && l.childId === parentId))
    return ng("親と子が逆向きにすでにつながっています");
  if (links.filter((l) => l.childId === childId).length >= MAX_PARENTS)
    return ng(`親は ${MAX_PARENTS} 人までです`);
  // 子孫を親にすると、たどったときに一周してしまう
  if (isDescendant(links, childId, parentId))
    return ng("子孫を親にはできません");
  if (isPartnered(partners, parentId, childId))
    return ng("配偶者どうしを親子にはできません");
  return ok;
}

function isPartnered(
  partners: readonly PartnerLink[],
  a: number,
  b: number,
): boolean {
  const [x, y] = orderPair(a, b);
  return partners.some((p) => p.personAId === x && p.personBId === y);
}

export function checkPartnerLink(
  links: readonly ParentLink[],
  partners: readonly PartnerLink[],
  a: number,
  b: number,
): RelationCheck {
  if (a === b) return ng("自分自身を配偶者にはできません");
  if (isPartnered(partners, a, b))
    return ng("すでに配偶者としてつながっています");
  if (isDescendant(links, a, b) || isDescendant(links, b, a))
    return ng("先祖・子孫とは配偶者にできません");
  return ok;
}

/** 配偶者は id の小さい方を person_a に入れる（schema の partnerships を参照） */
export function orderPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}
