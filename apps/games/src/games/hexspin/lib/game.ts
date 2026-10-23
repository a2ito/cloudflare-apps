// Hexspin のルール。React から切り離し、盤面を受け取って新しい盤面を返す純粋関数だけで書く。
//
// 盤面は頂点が左右を向いた六角形を縦の列に積み、奇数列を半マス下げて敷き詰める。
// 列の中ではタイルがまっすぐ縦に並ぶので、消えたあとの落下は列ごとに閉じる。
// そのため盤面は board[列][段] の列優先で持つ。段は上から 0。

export const COLS = 10;
export const ROWS = 9;
export const COLOR_COUNT = 6;

export type Color = number;
export type Board = readonly (readonly Color[])[];
export type Cell = { readonly c: number; readonly r: number };
/** 1 つの頂点で接する 3 枚。画面上で時計回りの順に並ぶ */
export type Triangle = readonly [Cell, Cell, Cell];
export type Direction = "cw" | "ccw";
/** 0 以上 1 未満を返す乱数。テストでは種を固定したものを渡す */
export type Rng = () => number;

const SQRT3 = Math.sqrt(3);

/** 辺の長さを 1 としたときのタイル中心の座標。y は下向き */
export function cellCenter({ c, r }: Cell): { x: number; y: number } {
  return {
    x: 1 + 1.5 * c,
    y: (SQRT3 / 2) * (1 + 2 * r + (c % 2)),
  };
}

export function inBounds({ c, r }: Cell): boolean {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

// 奇数列は半マス下がっているので、左右の列で隣になる段が偶数列と奇数列で 1 つずれる
const EVEN_COL_OFFSETS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
] as const;
const ODD_COL_OFFSETS = [
  [0, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
] as const;

/** 周りの 6 枚。上から時計回りに並ぶ。盤面の外は含めない */
export function neighbors(cell: Cell): Cell[] {
  const offsets = cell.c % 2 === 0 ? EVEN_COL_OFFSETS : ODD_COL_OFFSETS;
  return offsets
    .map(([dc, dr]) => ({ c: cell.c + dc, r: cell.r + dr }))
    .filter(inBounds);
}

function isAdjacent(a: Cell, b: Cell): boolean {
  return neighbors(a).some((n) => n.c === b.c && n.r === b.r);
}

const cellKey = ({ c, r }: Cell): string => `${c},${r}`;

/** 3 枚の中心の重心。3 枚が接する頂点と一致し、回転の軸になる */
export function pivotOf(tri: Triangle): { x: number; y: number } {
  const ps = tri.map(cellCenter);
  return {
    x: (ps[0].x + ps[1].x + ps[2].x) / 3,
    y: (ps[0].y + ps[1].y + ps[2].y) / 3,
  };
}

function orderClockwise(cells: Cell[]): Triangle {
  const ps = cells.map(cellCenter);
  const cx = (ps[0].x + ps[1].x + ps[2].x) / 3;
  const cy = (ps[0].y + ps[1].y + ps[2].y) / 3;
  // y が下向きなので、atan2 の昇順が画面上の時計回りになる
  const sorted = cells
    .map((cell, i) => ({ cell, a: Math.atan2(ps[i].y - cy, ps[i].x - cx) }))
    .sort((p, q) => p.a - q.a)
    .map((p) => p.cell);
  return [sorted[0], sorted[1], sorted[2]];
}

/** 盤面にあるすべての 3 枚の組。互いに隣り合う 3 枚を総当たりで数える */
function enumerateTriangles(): Triangle[] {
  const seen = new Set<string>();
  const result: Triangle[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const a = { c, r };
      const ns = neighbors(a);
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          if (!isAdjacent(ns[i], ns[j])) continue;
          const cells = [a, ns[i], ns[j]];
          const key = cells.map(cellKey).sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          result.push(orderClockwise(cells));
        }
      }
    }
  }
  return result;
}

export const TRIANGLES: readonly Triangle[] = enumerateTriangles();

const colorAt = (board: Board, { c, r }: Cell): Color => board[c][r];

function withCells(board: Board, updates: readonly [Cell, Color][]): Board {
  const next = board.map((col) => [...col]);
  for (const [{ c, r }, color] of updates) next[c][r] = color;
  return next;
}

/** 3 枚を 120° 回す。時計回りなら各タイルが次の位置へ移る */
export function rotate(board: Board, tri: Triangle, dir: Direction): Board {
  const colors = tri.map((cell) => colorAt(board, cell));
  const shift = dir === "cw" ? 2 : 1;
  return withCells(
    board,
    tri.map((cell, i): [Cell, Color] => [cell, colors[(i + shift) % 3]]),
  );
}

export type Matches = {
  /** 消えるタイル。三角形の 3 枚とフラワーの外周 6 枚 */
  readonly cleared: readonly Cell[];
  /** 揃った三角形の数 */
  readonly triangles: number;
  /** 周りの 6 枚が同じ色になった中心のタイル。中心自身は消えない */
  readonly flowers: readonly Cell[];
};

export function findMatches(board: Board): Matches {
  const cleared = new Map<string, Cell>();
  let triangles = 0;
  for (const tri of TRIANGLES) {
    const color = colorAt(board, tri[0]);
    if (tri.every((cell) => colorAt(board, cell) === color)) {
      triangles++;
      for (const cell of tri) cleared.set(cellKey(cell), cell);
    }
  }

  const flowers: Cell[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const ring = neighbors({ c, r });
      if (ring.length < 6) continue;
      const color = colorAt(board, ring[0]);
      if (ring.every((cell) => colorAt(board, cell) === color)) {
        flowers.push({ c, r });
        for (const cell of ring) cleared.set(cellKey(cell), cell);
      }
    }
  }

  return { cleared: [...cleared.values()], triangles, flowers };
}

export const hasMatch = (board: Board): boolean =>
  findMatches(board).cleared.length > 0;

const randomColor = (rng: Rng): Color => Math.floor(rng() * COLOR_COUNT);

/** 消えたタイルの上にあるものを列の中で下へ詰め、空いた上側を新しいタイルで埋める */
export function dropAndFill(
  board: Board,
  cleared: readonly Cell[],
  rng: Rng,
): Board {
  const gone = new Set(cleared.map(cellKey));
  return board.map((col, c) => {
    const kept = col.filter((_, r) => !gone.has(cellKey({ c, r })));
    const fresh = Array.from({ length: ROWS - kept.length }, () =>
      randomColor(rng),
    );
    return [...fresh, ...kept];
  });
}

export const TILE_POINTS = 10;
export const FLOWER_POINTS = 500;

export type CascadeStep = {
  /** 消える直前の盤面 */
  readonly before: Board;
  readonly matches: Matches;
  /** 1 から始まる連鎖の段数。得点の倍率になる */
  readonly chain: number;
  readonly gained: number;
  /** 落下と補充のあとの盤面 */
  readonly after: Board;
};

/** 揃ったものを消し、落として補充し、また揃えば続ける。揃わなくなったところで止まる */
export function resolveCascade(board: Board, rng: Rng): CascadeStep[] {
  const steps: CascadeStep[] = [];
  let current = board;
  for (let chain = 1; ; chain++) {
    const matches = findMatches(current);
    if (matches.cleared.length === 0) return steps;
    const gained =
      (matches.cleared.length * TILE_POINTS +
        matches.flowers.length * FLOWER_POINTS) *
      chain;
    const after = dropAndFill(current, matches.cleared, rng);
    steps.push({ before: current, matches, chain, gained, after });
    current = after;
  }
}

export type Spin = {
  /** 120° ごとの盤面。揃わなければ 3 回回って元に戻る */
  readonly frames: readonly Board[];
  readonly matched: boolean;
};

/** 揃うまで最大 3 回回す。1 周しても揃わなければその手は空振りになる */
export function spin(board: Board, tri: Triangle, dir: Direction): Spin {
  const frames: Board[] = [];
  let current = board;
  for (let i = 0; i < 3; i++) {
    current = rotate(current, tri, dir);
    frames.push(current);
    if (hasMatch(current)) return { frames, matched: true };
  }
  return { frames, matched: false };
}

/** どこかを回せば揃う手が残っているか。無くなったらゲームオーバー */
export function hasMove(board: Board): boolean {
  return TRIANGLES.some((tri) => {
    const once = rotate(board, tri, "cw");
    return hasMatch(once) || hasMatch(rotate(once, tri, "cw"));
  });
}

/** 揃ったものが無く、かつ揃えられる手が 1 つはある盤面を作る */
export function newBoard(rng: Rng = Math.random): Board {
  for (;;) {
    let board: Board = Array.from({ length: COLS }, () =>
      Array.from({ length: ROWS }, () => randomColor(rng)),
    );
    // 最初から揃っている所は、揃わなくなるまで塗り直す
    for (
      let m = findMatches(board);
      m.cleared.length > 0;
      m = findMatches(board)
    ) {
      board = withCells(
        board,
        m.cleared.map((cell): [Cell, Color] => [cell, randomColor(rng)]),
      );
    }
    if (hasMove(board)) return board;
  }
}
