import { describe, expect, it } from "vitest";
import { layoutFamily, type LayoutNode } from "./layout";

const people = (...ids: number[]) => ids.map((id) => ({ id }));

function yOf(nodes: LayoutNode[], personId: number): number {
  const node = nodes.find(
    (n) => n.kind === "person" && n.personId === personId,
  );
  if (!node) throw new Error(`person ${personId} が配置されていません`);
  return node.y;
}

describe("layoutFamily", () => {
  // 1 ─ 2 の夫婦の子が 3。3 ─ 4 の夫婦の子が 5。6 は 3 の子だが、もう一方の親が分からない
  const layout = layoutFamily(
    people(1, 2, 3, 4, 5, 6),
    [
      { parentId: 1, childId: 3 },
      { parentId: 2, childId: 3 },
      { parentId: 3, childId: 5 },
      { parentId: 4, childId: 5 },
      { parentId: 3, childId: 6 },
    ],
    [
      { personAId: 1, personBId: 2 },
      { personAId: 3, personBId: 4 },
    ],
  );

  it("夫婦は同じ高さに並ぶ", () => {
    expect(yOf(layout.nodes, 1)).toBe(yOf(layout.nodes, 2));
    expect(yOf(layout.nodes, 3)).toBe(yOf(layout.nodes, 4));
  });

  it("子は親より下に来る", () => {
    expect(yOf(layout.nodes, 3)).toBeGreaterThan(yOf(layout.nodes, 1));
    expect(yOf(layout.nodes, 5)).toBeGreaterThan(yOf(layout.nodes, 3));
  });

  it("親が 1 人しか分からない子も、夫婦の子と同じ世代に並ぶ", () => {
    expect(yOf(layout.nodes, 6)).toBe(yOf(layout.nodes, 5));
  });

  it("夫婦の子は夫婦ノードから、片親の子は親から直接つなぐ", () => {
    const edge = (source: string, target: string) =>
      layout.edges.find((e) => e.source === source && e.target === target);
    expect(edge("p1", "u1-2")).toMatchObject({ kind: "partner" });
    expect(edge("p2", "u1-2")).toMatchObject({ kind: "partner" });
    expect(edge("u1-2", "p3")).toMatchObject({ kind: "parent" });
    expect(edge("p1", "p3")).toBeUndefined();
    expect(edge("p3", "p6")).toMatchObject({ kind: "parent" });
  });

  it("配偶者として結ばれていない 2 人の子は、それぞれの親からつなぐ", () => {
    const l = layoutFamily(
      people(1, 2, 3),
      [
        { parentId: 1, childId: 3 },
        { parentId: 2, childId: 3 },
      ],
      [],
    );
    expect(l.edges.map((e) => `${e.source}>${e.target}`).sort()).toEqual([
      "p1>p3",
      "p2>p3",
    ]);
  });

  it("家系図にいない人物へのつながりは無視する", () => {
    const l = layoutFamily(
      people(1),
      [{ parentId: 1, childId: 99 }],
      [{ personAId: 1, personBId: 98 }],
    );
    expect(l.nodes).toHaveLength(1);
    expect(l.edges).toHaveLength(0);
  });

  it("誰もいなければ空", () => {
    expect(layoutFamily([], [], [])).toEqual({ nodes: [], edges: [] });
  });
});
