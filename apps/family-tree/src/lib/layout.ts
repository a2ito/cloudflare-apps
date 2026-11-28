import { graphlib, layout as runDagre } from "@dagrejs/dagre";
import type { ParentLink, PartnerLink } from "./relations";

/**
 * 家系図のグラフの配置と線の形を決める。
 *
 * 紙の家系図と同じ形にする。
 * - 夫婦は同じ段に隣り合わせで並べ、2 人の間を横線で結ぶ
 * - 子への線は、夫婦の横線の真ん中から真下へ下り、兄弟をまとめる横線を通って各自の真上から入る
 * - 親が 1 人しか分からない子（または 2 人の親が配偶者として結ばれていない子）は、親の下端から同じ形で下ろす
 *
 * dagre には「配偶者でつながった人たち」を 1 つの横長の箱として渡し、段と左右の並びだけを決めさせる。
 * 1 人ずつ渡すと夫婦が隣に来る保証が無く、線も dagre 任せで曲がってしまうため。
 * 線は直角に折れる折れ線として自分で計算し、React Flow にはその点の並びを渡して描かせる。
 */

export const PERSON_WIDTH = 168;
export const PERSON_HEIGHT = 60;
/** 夫婦の間をあける幅。ここに横線を引く */
const PARTNER_GAP = 40;
/** 段と段の間。兄弟をまとめる横線をこの真ん中あたりに引く */
const RANK_GAP = 64;
/** 同じ段で兄弟の横線が左右に重なるときに、下へずらす幅と回数の上限（子の箱に届かないように） */
const BUS_STAGGER = 8;
const MAX_BUS_LEVEL = 3;
/** 隣に並ばない夫婦を段の下で結ぶ線の間隔と本数の上限（兄弟の横線より上に収める） */
const UNDER_LINE_STEP = 6;
const MAX_UNDER_LINES = 3;
/** 親より上か同じ段にいる子へ、箱の外を回って入るときの余白 */
const DETOUR_GAP = 12;

export type LayoutPerson = { id: number };

export type LayoutNode = {
  id: string;
  personId: number;
  x: number;
  y: number;
};

export type Point = { x: number; y: number };

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  kind: "partner" | "parent";
  /** 直角に折れる折れ線の点。始点から終点まで */
  points: Point[];
};

export type Layout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
};

export const personNodeId = (id: number) => `p${id}`;

/** 配偶者でつながった人たちのまとまり（再婚もあるので 3 人以上もある） */
type Block = { id: string; members: number[] };

/** 子をまとめて下ろす単位。夫婦なら 2 人の横線の真ん中から、片親なら下端から下ろす */
type Family = { key: string; parents: number[]; children: number[] };

const partnerKey = (a: number, b: number) =>
  a < b ? `${a}-${b}` : `${b}-${a}`;

const blockWidth = (n: number) => n * PERSON_WIDTH + (n - 1) * PARTNER_GAP;

function connectedFrom(
  start: number,
  adjacent: ReadonlyMap<number, readonly number[]>,
): number[] {
  const found = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacent.get(queue[i]) ?? []) {
      if (!found.has(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return [...found].sort((x, y) => x - y);
}

/** 配偶者のつながりで人をまとまりに分ける。並びは配偶者どうしが隣り合うようにたどる */
function groupByPartners(
  personIds: readonly number[],
  partners: readonly PartnerLink[],
): Block[] {
  const adjacent = new Map<number, number[]>(personIds.map((id) => [id, []]));
  for (const { personAId: a, personBId: b } of partners) {
    adjacent.get(a)?.push(b);
    adjacent.get(b)?.push(a);
  }
  for (const list of adjacent.values()) list.sort((x, y) => x - y);

  const seen = new Set<number>();
  const blocks: Block[] = [];
  for (const start of personIds) {
    if (seen.has(start)) continue;
    const component = connectedFrom(start, adjacent);
    // 配偶者が 1 人だけの人から始めると、再婚の連なり（A─B─C）を一列にたどれる
    const first =
      component.find((id) => (adjacent.get(id)?.length ?? 0) <= 1) ??
      component[0];
    const members: number[] = [];
    const stack = [first];
    while (stack.length > 0) {
      const id = stack.pop() as number;
      if (seen.has(id)) continue;
      seen.add(id);
      members.push(id);
      for (const next of [...(adjacent.get(id) ?? [])].reverse()) {
        if (!seen.has(next)) stack.push(next);
      }
    }
    blocks.push({ id: `b${members[0]}`, members });
  }
  return blocks;
}

export function layoutFamily(
  persons: readonly LayoutPerson[],
  parents: readonly ParentLink[],
  partners: readonly PartnerLink[],
): Layout {
  const known = new Set(persons.map((p) => p.id));
  const validPartners = partners.filter(
    (p) => known.has(p.personAId) && known.has(p.personBId),
  );
  const validParents = parents.filter(
    (p) => known.has(p.parentId) && known.has(p.childId),
  );

  const blocks = groupByPartners(
    persons.map((p) => p.id),
    validPartners,
  );
  const blockOf = new Map<number, Block>();
  for (const block of blocks) {
    for (const id of block.members) blockOf.set(id, block);
  }

  const g = new graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 32,
    ranksep: RANK_GAP,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const block of blocks) {
    g.setNode(block.id, {
      width: blockWidth(block.members.length),
      height: PERSON_HEIGHT,
    });
  }
  for (const { parentId, childId } of validParents) {
    const from = blockOf.get(parentId);
    const to = blockOf.get(childId);
    // 同じまとまりの中の親子（親の再婚相手と子が結ばれた場合など）は段を分けられないので渡さない
    if (from && to && from !== to) g.setEdge(from.id, to.id, { minlen: 1 });
  }
  runDagre(g);

  const blockCenter = (block: Block) => g.node(block.id) as Point;

  // 夫婦の左右は、それぞれの親が居る側に寄せる。逆だと親からの線が夫婦の上で交差する
  const parentXOf = (personId: number): number | undefined => {
    const xs = validParents
      .filter((p) => p.childId === personId)
      .flatMap((p) => {
        const b = blockOf.get(p.parentId);
        return b ? [blockCenter(b).x] : [];
      });
    return xs.length > 0
      ? xs.reduce((a, b) => a + b, 0) / xs.length
      : undefined;
  };
  const shouldReverse = (members: number[], centerX: number): boolean => {
    if (members.length < 2) return false;
    const first = parentXOf(members[0]);
    const last = parentXOf(members[members.length - 1]);
    if (first !== undefined && last !== undefined) return first > last;
    if (first !== undefined) return first > centerX;
    if (last !== undefined) return last < centerX;
    return false;
  };

  const position = new Map<number, Point>();
  for (const block of blocks) {
    const c = blockCenter(block);
    const order = shouldReverse(block.members, c.x)
      ? [...block.members].reverse()
      : block.members;
    const left = c.x - blockWidth(order.length) / 2;
    order.forEach((id, i) => {
      position.set(id, {
        x: left + i * (PERSON_WIDTH + PARTNER_GAP),
        y: c.y - PERSON_HEIGHT / 2,
      });
    });
  }
  const at = (id: number) => position.get(id) as Point;

  const nodes: LayoutNode[] = persons.map((p) => ({
    id: personNodeId(p.id),
    personId: p.id,
    ...at(p.id),
  }));

  const edges: LayoutEdge[] = [];

  // 夫婦の線と、その夫婦の子へ線を下ろす起点
  const coupleAnchor = new Map<string, Point>();
  const underLinesByRow = new Map<number, number>();
  for (const { personAId, personBId } of validPartners) {
    const key = partnerKey(personAId, personBId);
    const [l, r] = [at(personAId), at(personBId)].sort((a, b) => a.x - b.x);
    const adjacent = r.x - l.x === PERSON_WIDTH + PARTNER_GAP;
    let points: Point[];
    if (adjacent) {
      // 隣どうしは、左の人の右端から右の人の左端まで横線で結び、その真ん中から子へ下ろす
      const y = l.y + PERSON_HEIGHT / 2;
      points = [
        { x: l.x + PERSON_WIDTH, y },
        { x: r.x, y },
      ];
      coupleAnchor.set(key, { x: (l.x + PERSON_WIDTH + r.x) / 2, y });
    } else {
      // 3 人以上と結婚した人の配偶者は隣に並びきらない。間の人の上を横切ると、その人と夫婦に見えるので、
      // 2 人の下端から下ろして段の下で結ぶ。片親の子の線（下端の真ん中）と重ならないよう、端は中央から外す
      const count = Math.min(
        (underLinesByRow.get(l.y) ?? 0) + 1,
        MAX_UNDER_LINES,
      );
      underLinesByRow.set(l.y, count);
      const bottom = l.y + PERSON_HEIGHT;
      const y = bottom + count * UNDER_LINE_STEP;
      const lx = l.x + PERSON_WIDTH * 0.75;
      const rx = r.x + PERSON_WIDTH * 0.25;
      points = [
        { x: lx, y: bottom },
        { x: lx, y },
        { x: rx, y },
        { x: rx, y: bottom },
      ];
      coupleAnchor.set(key, { x: (lx + rx) / 2, y });
    }
    edges.push({
      id: `m${key}`,
      source: personNodeId(personAId),
      target: personNodeId(personBId),
      kind: "partner",
      points,
    });
  }

  // 子を、どこから線を下ろすか（夫婦か片親か）で分ける
  const parentsOf = new Map<number, number[]>();
  for (const { parentId, childId } of validParents) {
    parentsOf.set(childId, [...(parentsOf.get(childId) ?? []), parentId]);
  }
  const families = new Map<string, Family>();
  const addChild = (key: string, ps: number[], child: number) => {
    const f = families.get(key) ?? { key, parents: ps, children: [] };
    f.children.push(child);
    families.set(key, f);
  };
  for (const [childId, ps] of parentsOf) {
    const sorted = [...ps].sort((x, y) => x - y);
    const couple =
      sorted.length === 2 ? partnerKey(sorted[0], sorted[1]) : undefined;
    if (couple && coupleAnchor.has(couple)) {
      addChild(`u${couple}`, sorted, childId);
    } else {
      for (const parentId of sorted) {
        addChild(`s${parentId}`, [parentId], childId);
      }
    }
  }

  // 兄弟の横線が同じ段で左右に重なると、別の家族の子とつながって見える。重なるものは少しずつ下げる
  const busesByRow = new Map<
    number,
    { from: number; to: number; level: number }[]
  >();

  for (const f of families.values()) {
    const top = at(f.parents[0]).y;
    const anchor: Point =
      f.parents.length === 2
        ? (coupleAnchor.get(partnerKey(f.parents[0], f.parents[1])) as Point)
        : {
            x: at(f.parents[0]).x + PERSON_WIDTH / 2,
            y: top + PERSON_HEIGHT,
          };

    const childTops = f.children.map((id) => ({
      id,
      x: at(id).x + PERSON_WIDTH / 2,
      y: at(id).y,
    }));
    const from = Math.min(anchor.x, ...childTops.map((c) => c.x));
    const to = Math.max(anchor.x, ...childTops.map((c) => c.x));

    const used = busesByRow.get(top) ?? [];
    let level = 0;
    while (
      level < MAX_BUS_LEVEL &&
      used.some((b) => b.level === level && b.from <= to && from <= b.to)
    ) {
      level += 1;
    }
    used.push({ from, to, level });
    busesByRow.set(top, used);
    // 最初の 1 本は段の間の真ん中より少し上に引き、重なった分を下へずらす（子の箱には届かない範囲で）
    const busY = top + PERSON_HEIGHT + RANK_GAP / 2 + (level - 1) * BUS_STAGGER;

    for (const c of childTops) {
      const points: Point[] = [anchor, { x: anchor.x, y: busY }];
      if (c.y > busY) {
        if (c.x !== anchor.x) points.push({ x: c.x, y: busY });
      } else {
        // 子が親と同じ段か上の段にいる（配偶者のまとまりや一周するつながりのため）。そのまま上へ戻すと
        // 子から親へ下りる線に見えるので、子の箱の右を回って真上から入れる
        const side = c.x + PERSON_WIDTH / 2 + DETOUR_GAP;
        const above = c.y - DETOUR_GAP;
        points.push(
          { x: side, y: busY },
          { x: side, y: above },
          { x: c.x, y: above },
        );
      }
      points.push({ x: c.x, y: c.y });
      edges.push({
        id: `${f.key}-${personNodeId(c.id)}`,
        source: personNodeId(f.parents[0]),
        target: personNodeId(c.id),
        kind: "parent",
        points,
      });
    }
  }

  return { nodes, edges };
}

/** 折れ線を SVG の path にする */
export function polylinePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}
