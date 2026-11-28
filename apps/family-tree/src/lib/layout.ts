import { graphlib, layout as runDagre } from "@dagrejs/dagre";
import type { ParentLink, PartnerLink } from "./relations";

/**
 * 家系図のグラフの配置を決める。
 *
 * 夫婦の間に小さな「夫婦ノード」を置き、2 人 → 夫婦ノード → 子 とつなぐ。こうすると
 * 子の線が 2 人の間から下りる、見慣れた家系図の形になる。親が 1 人しか分からない子や、
 * 2 人の親が配偶者として結ばれていない子は、親から直接つなぐ。
 *
 * 世代を揃えるため、親から子への直接の線は 2 段ぶん（夫婦ノードを経由したときと同じ長さ）にする。
 */

export const PERSON_WIDTH = 168;
export const PERSON_HEIGHT = 60;
export const UNION_SIZE = 10;

export type LayoutPerson = { id: number };

export type LayoutNode =
  | { kind: "person"; id: string; personId: number; x: number; y: number }
  | { kind: "union"; id: string; x: number; y: number };

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  kind: "partner" | "parent";
};

export type Layout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
};

export const personNodeId = (id: number) => `p${id}`;
const unionNodeId = (a: number, b: number) => `u${a}-${b}`;

export function layoutFamily(
  persons: readonly LayoutPerson[],
  parents: readonly ParentLink[],
  partners: readonly PartnerLink[],
): Layout {
  const g = new graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 32,
    ranksep: 36,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const known = new Set(persons.map((p) => p.id));
  for (const p of persons) {
    g.setNode(personNodeId(p.id), {
      width: PERSON_WIDTH,
      height: PERSON_HEIGHT,
    });
  }

  const edges: LayoutEdge[] = [];
  const unions = new Map<string, { a: number; b: number }>();
  for (const { personAId: a, personBId: b } of partners) {
    if (!known.has(a) || !known.has(b)) continue;
    const id = unionNodeId(a, b);
    unions.set(id, { a, b });
    g.setNode(id, { width: UNION_SIZE, height: UNION_SIZE });
    for (const person of [a, b]) {
      g.setEdge(personNodeId(person), id, { minlen: 1 });
      edges.push({
        id: `${personNodeId(person)}-${id}`,
        source: personNodeId(person),
        target: id,
        kind: "partner",
      });
    }
  }

  const parentsOf = new Map<number, number[]>();
  for (const { parentId, childId } of parents) {
    if (!known.has(parentId) || !known.has(childId)) continue;
    parentsOf.set(childId, [...(parentsOf.get(childId) ?? []), parentId]);
  }

  for (const [childId, ps] of parentsOf) {
    const child = personNodeId(childId);
    const sorted = [...ps].sort((x, y) => x - y);
    const union =
      sorted.length === 2 ? unionNodeId(sorted[0], sorted[1]) : undefined;
    if (union && unions.has(union)) {
      g.setEdge(union, child, { minlen: 1 });
      edges.push({
        id: `${union}-${child}`,
        source: union,
        target: child,
        kind: "parent",
      });
      continue;
    }
    for (const parentId of sorted) {
      const parent = personNodeId(parentId);
      g.setEdge(parent, child, { minlen: 2 });
      edges.push({
        id: `${parent}-${child}`,
        source: parent,
        target: child,
        kind: "parent",
      });
    }
  }

  runDagre(g);

  // dagre は中心の座標を返す。React Flow は左上で置くのでずらす
  const nodes: LayoutNode[] = g.nodes().map((id) => {
    const n = g.node(id);
    if (unions.has(id)) {
      return {
        kind: "union",
        id,
        x: n.x - UNION_SIZE / 2,
        y: n.y - UNION_SIZE / 2,
      };
    }
    return {
      kind: "person",
      id,
      personId: Number(id.slice(1)),
      x: n.x - PERSON_WIDTH / 2,
      y: n.y - PERSON_HEIGHT / 2,
    };
  });

  return { nodes, edges };
}
