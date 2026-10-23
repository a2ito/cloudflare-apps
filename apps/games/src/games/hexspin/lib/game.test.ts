import { describe, expect, it } from "vitest";
import {
  type Board,
  type Cell,
  COLOR_COUNT,
  COLS,
  ROWS,
  TRIANGLES,
  dropAndFill,
  findMatches,
  hasMatch,
  hasMove,
  neighbors,
  newBoard,
  resolveCascade,
  rotate,
  spin,
} from "./game";

/** 種を固定した乱数（mulberry32） */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 三角形も花もできない盤面。どの 3 枚の組にも 2 色以上が混ざり、
 * どの外周 6 枚にも 2 色以上が混ざる並べ方を 3 色で作る
 */
function quietBoard(): Board {
  return Array.from({ length: COLS }, (_, c) =>
    Array.from({ length: ROWS }, (_, r) => (c + 2 * r + 3 * (c % 2)) % 3),
  );
}

function paint(board: Board, cells: readonly Cell[], color: number): Board {
  const next = board.map((col) => [...col]);
  for (const { c, r } of cells) next[c][r] = color;
  return next;
}

const key = ({ c, r }: Cell) => `${c},${r}`;

describe("盤面の形", () => {
  it("隣り合う関係は対称になっている", () => {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        for (const n of neighbors({ c, r })) {
          expect(neighbors(n).map(key)).toContain(key({ c, r }));
        }
      }
    }
  });

  it("端に接していないタイルは周りに 6 枚あり、6 つの組に入る", () => {
    const cell = { c: 4, r: 4 };
    expect(neighbors(cell)).toHaveLength(6);
    const count = TRIANGLES.filter((t) => t.some((x) => key(x) === key(cell)));
    expect(count).toHaveLength(6);
  });

  it("組の 3 枚は互いに隣り合う", () => {
    for (const tri of TRIANGLES) {
      for (const a of tri) {
        const ns = neighbors(a).map(key);
        for (const b of tri) if (b !== a) expect(ns).toContain(key(b));
      }
    }
  });

  // 隣り合う 2 列はジグザグに 2×ROWS 枚の帯になり、連続する 3 枚ごとに組ができる
  it("組の数は (列 - 1) × (段 - 1) × 2 になる", () => {
    expect(TRIANGLES).toHaveLength((COLS - 1) * (ROWS - 1) * 2);
  });
});

describe("回転", () => {
  const board = newBoard(seeded(1));
  const tri = TRIANGLES[10];

  it("同じ向きに 3 回回すと元に戻る", () => {
    let b = board;
    for (let i = 0; i < 3; i++) b = rotate(b, tri, "cw");
    expect(b).toEqual(board);
  });

  it("時計回りと反時計回りは打ち消し合う", () => {
    expect(rotate(rotate(board, tri, "cw"), tri, "ccw")).toEqual(board);
  });

  it("時計回りでは各タイルが次の位置へ移る", () => {
    const b = paint(
      paint(paint(quietBoard(), [tri[0]], 0), [tri[1]], 1),
      [tri[2]],
      2,
    );
    const after = rotate(b, tri, "cw");
    expect(tri.map(({ c, r }) => after[c][r])).toEqual([2, 0, 1]);
  });

  it("組の外は変えない", () => {
    const after = rotate(board, tri, "cw");
    const inTri = new Set(tri.map(key));
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (!inTri.has(key({ c, r }))) expect(after[c][r]).toBe(board[c][r]);
  });
});

describe("揃った判定", () => {
  it("並べ方を工夫した盤面には揃いが無い", () => {
    expect(hasMatch(quietBoard())).toBe(false);
  });

  it("同じ色の 3 枚の組を見つける", () => {
    const tri = TRIANGLES[20];
    const m = findMatches(paint(quietBoard(), tri, 5));
    expect(m.triangles).toBe(1);
    expect(m.cleared.map(key).sort()).toEqual(tri.map(key).sort());
    expect(m.flowers).toHaveLength(0);
  });

  it("周りの 6 枚が同じ色ならフラワーになり、外周だけが消える", () => {
    const center = { c: 4, r: 4 };
    const ring = neighbors(center);
    const m = findMatches(paint(quietBoard(), ring, 5));
    expect(m.flowers.map(key)).toEqual([key(center)]);
    expect(m.cleared.map(key).sort()).toEqual(ring.map(key).sort());
  });
});

describe("落下と補充", () => {
  it("消えた分だけ上から詰め、列の中の順番は保つ", () => {
    const board = quietBoard();
    const before = board[3];
    const after = dropAndFill(
      board,
      [
        { c: 3, r: 5 },
        { c: 3, r: 2 },
      ],
      () => 0.99,
    );
    const kept = before.filter((_, r) => r !== 5 && r !== 2);
    expect(after[3].slice(2)).toEqual(kept);
    expect(after[3].slice(0, 2)).toEqual([COLOR_COUNT - 1, COLOR_COUNT - 1]);
    expect(after[2]).toEqual(board[2]);
  });
});

describe("連鎖", () => {
  it("揃わなくなるまで続き、段が進むほど倍率が上がる", () => {
    const tri = TRIANGLES[30];
    const steps = resolveCascade(paint(quietBoard(), tri, 5), seeded(7));
    expect(steps.length).toBeGreaterThanOrEqual(1);
    steps.forEach((s, i) => expect(s.chain).toBe(i + 1));
    expect(hasMatch(steps[steps.length - 1].after)).toBe(false);
    expect(steps[0].gained).toBe(3 * 10);
  });

  it("フラワーには大きなボーナスが付く", () => {
    const ring = neighbors({ c: 4, r: 4 });
    const [first] = resolveCascade(paint(quietBoard(), ring, 5), seeded(3));
    expect(first.gained).toBe(6 * 10 + 500);
  });
});

describe("回す手", () => {
  it("揃ったところで止まる", () => {
    const board = newBoard(seeded(11));
    for (const tri of TRIANGLES) {
      const s = spin(board, tri, "cw");
      if (!s.matched) continue;
      expect(s.frames.length).toBeLessThanOrEqual(3);
      expect(hasMatch(s.frames[s.frames.length - 1])).toBe(true);
      s.frames.slice(0, -1).forEach((f) => expect(hasMatch(f)).toBe(false));
      return;
    }
    throw new Error("揃う手が 1 つも見つからない");
  });

  it("揃わなければ 3 回回って元に戻る", () => {
    const board = quietBoard();
    const s = TRIANGLES.map((tri) => spin(board, tri, "cw")).find(
      (x) => !x.matched,
    );
    if (!s) throw new Error("揃わない組が 1 つも見つからない");
    expect(s.frames).toHaveLength(3);
    expect(s.frames[2]).toEqual(board);
  });
});

describe("新しい盤面", () => {
  it("揃ったものが無く、揃えられる手がある", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const board = newBoard(seeded(seed));
      expect(hasMatch(board)).toBe(false);
      expect(hasMove(board)).toBe(true);
      expect(board).toHaveLength(COLS);
      board.forEach((col) => expect(col).toHaveLength(ROWS));
    }
  });
});
