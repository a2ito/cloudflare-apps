import { describe, expect, it } from "vitest";
import {
  type Layout,
  type LayoutNode,
  layoutFamily,
  PERSON_HEIGHT,
  PERSON_WIDTH,
} from "./layout";

const people = (...ids: number[]) => ids.map((id) => ({ id }));

function nodeOf(nodes: LayoutNode[], personId: number): LayoutNode {
  const node = nodes.find((n) => n.personId === personId);
  if (!node) throw new Error(`person ${personId} が配置されていません`);
  return node;
}

const edgeOf = (layout: Layout, id: string) => {
  const edge = layout.edges.find((e) => e.id === id);
  if (!edge) throw new Error(`線 ${id} がありません`);
  return edge;
};

/** 線が、どこかの人物の箱の内側を通っていないか（端で触れるのはよい） */
function crossesAnyBox(layout: Layout): string[] {
  const hits: string[] = [];
  for (const e of layout.edges) {
    for (let i = 1; i < e.points.length; i++) {
      const [a, b] = [e.points[i - 1], e.points[i]];
      for (const n of layout.nodes) {
        const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
        const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
        const inside =
          x1 > n.x &&
          x0 < n.x + PERSON_WIDTH &&
          y1 > n.y &&
          y0 < n.y + PERSON_HEIGHT &&
          // 線分は縦か横なので、幅 0 の向きは箱の内側に厳密に入っているかで見る
          (x0 === x1 ? x0 > n.x && x0 < n.x + PERSON_WIDTH : true) &&
          (y0 === y1 ? y0 > n.y && y0 < n.y + PERSON_HEIGHT : true);
        if (inside) hits.push(`${e.id} が ${n.id} を通る`);
      }
    }
  }
  return hits;
}

/** どの線も縦か横の線分だけでできているか */
function isOrthogonal(layout: Layout): boolean {
  return layout.edges.every((e) =>
    e.points.every(
      (b, i) =>
        i === 0 || e.points[i - 1].x === b.x || e.points[i - 1].y === b.y,
    ),
  );
}

/** 線の最後の線分が、子の真上から下向きに入っているか */
function entersFromAbove(layout: Layout, edgeId: string, child: number) {
  const e = edgeOf(layout, edgeId);
  const n = nodeOf(layout.nodes, child);
  const [a, b] = e.points.slice(-2);
  return (
    b.x === n.x + PERSON_WIDTH / 2 && b.y === n.y && a.x === b.x && a.y < b.y
  );
}

describe("layoutFamily", () => {
  // 1 ─ 2 の夫婦の子が 3 と 7。3 ─ 4 の夫婦の子が 5。6 は 3 の子だが、もう一方の親が分からない
  const layout = layoutFamily(
    people(1, 2, 3, 4, 5, 6, 7),
    [
      { parentId: 1, childId: 3 },
      { parentId: 2, childId: 3 },
      { parentId: 1, childId: 7 },
      { parentId: 2, childId: 7 },
      { parentId: 3, childId: 5 },
      { parentId: 4, childId: 5 },
      { parentId: 3, childId: 6 },
    ],
    [
      { personAId: 1, personBId: 2 },
      { personAId: 3, personBId: 4 },
    ],
  );
  const node = (id: number) => nodeOf(layout.nodes, id);

  it("夫婦は同じ高さに隣り合わせで並ぶ", () => {
    expect(node(1).y).toBe(node(2).y);
    expect(node(3).y).toBe(node(4).y);
    const gap = Math.abs(node(1).x - node(2).x) - PERSON_WIDTH;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(PERSON_WIDTH);
  });

  it("子は親より下に来る", () => {
    expect(node(3).y).toBeGreaterThan(node(1).y);
    expect(node(5).y).toBeGreaterThan(node(3).y);
  });

  it("親が 1 人しか分からない子も、夫婦の子と同じ世代に並ぶ", () => {
    expect(node(6).y).toBe(node(5).y);
  });

  it("どの線も縦か横の線分だけでできていて、人物の箱を通らない", () => {
    expect(isOrthogonal(layout)).toBe(true);
    expect(crossesAnyBox(layout)).toEqual([]);
  });

  it("夫婦は 2 人の間を横線で結ぶ", () => {
    const line = edgeOf(layout, "m1-2");
    expect(line.kind).toBe("partner");
    const [l, r] = [node(1), node(2)].sort((a, b) => a.x - b.x);
    expect(line.points).toEqual([
      { x: l.x + PERSON_WIDTH, y: l.y + PERSON_HEIGHT / 2 },
      { x: r.x, y: l.y + PERSON_HEIGHT / 2 },
    ]);
  });

  it("夫婦の子は横線の真ん中から下りて、子の真上から入る", () => {
    const [l, r] = [node(1), node(2)].sort((a, b) => a.x - b.x);
    const middle = (l.x + PERSON_WIDTH + r.x) / 2;
    for (const child of [3, 7]) {
      const line = edgeOf(layout, `u1-2-p${child}`);
      expect(line.points[0]).toEqual({ x: middle, y: l.y + PERSON_HEIGHT / 2 });
      expect(line.points.at(-1)).toEqual({
        x: node(child).x + PERSON_WIDTH / 2,
        y: node(child).y,
      });
    }
  });

  it("兄弟は同じ高さの横線でまとまる", () => {
    const busY = (id: string) => edgeOf(layout, id).points[1].y;
    expect(busY("u1-2-p3")).toBe(busY("u1-2-p7"));
    expect(busY("u1-2-p3")).toBeGreaterThan(node(1).y + PERSON_HEIGHT);
    expect(busY("u1-2-p3")).toBeLessThan(node(3).y);
  });

  it("片親の子は、親の下端から下ろす", () => {
    const line = edgeOf(layout, "s3-p6");
    expect(line.points[0]).toEqual({
      x: node(3).x + PERSON_WIDTH / 2,
      y: node(3).y + PERSON_HEIGHT,
    });
  });

  it("夫婦の左右は、それぞれの親の側に寄せる", () => {
    // 3 の親（1・2）は上にいて、4 には親がいない。3 が 4 より親に近い側に来る
    const parentsX = (node(1).x + node(2).x) / 2;
    expect(Math.abs(node(3).x - parentsX)).toBeLessThan(
      Math.abs(node(4).x - parentsX),
    );
  });

  it("再婚も一列に並べ、配偶者どうしを隣にする", () => {
    // 1 ─ 2 ─ 3（2 が再婚）
    const l = layoutFamily(
      people(1, 2, 3),
      [],
      [
        { personAId: 1, personBId: 2 },
        { personAId: 2, personBId: 3 },
      ],
    );
    const xs = [1, 2, 3].map((id) => nodeOf(l.nodes, id).x);
    expect(new Set(l.nodes.map((n) => n.y)).size).toBe(1);
    expect(xs[1]).toBe([...xs].sort((a, b) => a - b)[1]);
  });

  it("3 人以上と結婚した人でも、配偶者の線と子への線は間の人を通らない", () => {
    // 1 が 2・3・4 と結婚し、5 は 1 と 4 の子
    const l = layoutFamily(
      people(1, 2, 3, 4, 5),
      [
        { parentId: 1, childId: 5 },
        { parentId: 4, childId: 5 },
      ],
      [
        { personAId: 1, personBId: 2 },
        { personAId: 1, personBId: 3 },
        { personAId: 1, personBId: 4 },
      ],
    );
    expect(isOrthogonal(l)).toBe(true);
    expect(crossesAnyBox(l)).toEqual([]);
    expect(entersFromAbove(l, "u1-4-p5", 5)).toBe(true);
  });

  it("子が親と同じまとまりにいても、子の真上から入る", () => {
    // 1 ─ 2 夫婦、3 は 1 の子で、2 の再婚相手
    const l = layoutFamily(
      people(1, 2, 3),
      [{ parentId: 1, childId: 3 }],
      [
        { personAId: 1, personBId: 2 },
        { personAId: 2, personBId: 3 },
      ],
    );
    expect(isOrthogonal(l)).toBe(true);
    expect(crossesAnyBox(l)).toEqual([]);
    expect(entersFromAbove(l, "s1-p3", 3)).toBe(true);
  });

  it("まとまりの間で一周しても、子の真上から入る", () => {
    // 1 ─ 2 と 3 ─ 4 の夫婦。1 → 3、4 → 2 の親子（父と息子が、母と娘とそれぞれ結婚した場合など）
    const l = layoutFamily(
      people(1, 2, 3, 4),
      [
        { parentId: 1, childId: 3 },
        { parentId: 4, childId: 2 },
      ],
      [
        { personAId: 1, personBId: 2 },
        { personAId: 3, personBId: 4 },
      ],
    );
    expect(isOrthogonal(l)).toBe(true);
    expect(entersFromAbove(l, "s1-p3", 3)).toBe(true);
    expect(entersFromAbove(l, "s4-p2", 2)).toBe(true);
  });

  it("兄弟の横線が左右に重なる家族は、高さをずらし、子の箱には届かない", () => {
    // 1 ─ 2 ─ 3 の再婚の連なり。1・2 の子 4 と、2・3 の子 5、片親 1 の子 6、片親 3 の子 7
    const l = layoutFamily(
      people(1, 2, 3, 4, 5, 6, 7),
      [
        { parentId: 1, childId: 4 },
        { parentId: 2, childId: 4 },
        { parentId: 2, childId: 5 },
        { parentId: 3, childId: 5 },
        { parentId: 1, childId: 6 },
        { parentId: 3, childId: 7 },
      ],
      [
        { personAId: 1, personBId: 2 },
        { personAId: 2, personBId: 3 },
      ],
    );
    const busYs = l.edges
      .filter((e) => e.kind === "parent")
      .map((e) => e.points[1].y);
    expect(new Set(busYs).size).toBeGreaterThan(1);
    const childTop = Math.min(
      ...[4, 5, 6, 7].map((id) => nodeOf(l.nodes, id).y),
    );
    expect(Math.max(...busYs)).toBeLessThan(childTop);
    expect(isOrthogonal(l)).toBe(true);
    expect(crossesAnyBox(l)).toEqual([]);
  });

  it("配偶者として結ばれていない 2 人の子は、それぞれの親から下ろす", () => {
    const l = layoutFamily(
      people(1, 2, 3),
      [
        { parentId: 1, childId: 3 },
        { parentId: 2, childId: 3 },
      ],
      [],
    );
    expect(l.edges.map((e) => e.id).sort()).toEqual(["s1-p3", "s2-p3"]);
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
