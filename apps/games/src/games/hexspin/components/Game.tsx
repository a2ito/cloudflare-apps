"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadNumber, saveNumber } from "@/lib/storage";
import {
  type Board,
  type Cell,
  type Direction,
  COLS,
  ROWS,
  TRIANGLES,
  cellCenter,
  hasMove,
  newBoard,
  pivotOf,
  resolveCascade,
  spin,
} from "../lib/game";
import { BEST_KEY } from "../lib/storage-keys";

// 色だけに頼らず見分けられるよう、色ごとに記号を重ねる
const TILES = [
  { fill: "#e5484d", symbol: "circle" },
  { fill: "#f76b15", symbol: "square" },
  { fill: "#ffc53d", symbol: "triangle" },
  { fill: "#30a46c", symbol: "diamond" },
  { fill: "#0090ff", symbol: "plus" },
  { fill: "#8e4ec6", symbol: "ring" },
] as const;

/** 描画の縮尺。ゲームの座標は辺の長さ 1 で持っている */
const S = 24;
const WIDTH = (1.5 * (COLS - 1) + 2) * S;
const HEIGHT = Math.sqrt(3) * (ROWS + 0.5) * S;

const ROTATE_MS = 140;
const CLEAR_MS = 280;
const DROP_MS = 180;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cellKey = ({ c, r }: Cell) => `${c},${r}`;

function hexPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`;
  }).join(" ");
}

function TileMark({ kind, x, y }: { kind: string; x: number; y: number }) {
  const s = S * 0.28;
  const common = { fill: "rgba(0,0,0,0.38)" };
  switch (kind) {
    case "circle":
      return <circle cx={x} cy={y} r={s} {...common} />;
    case "square":
      return (
        <rect
          x={x - s}
          y={y - s}
          width={s * 2}
          height={s * 2}
          rx={2}
          {...common}
        />
      );
    case "triangle":
      return (
        <polygon
          points={`${x},${y - s * 1.1} ${x + s},${y + s * 0.8} ${x - s},${y + s * 0.8}`}
          {...common}
        />
      );
    case "diamond":
      return (
        <polygon
          points={`${x},${y - s * 1.2} ${x + s},${y} ${x},${y + s * 1.2} ${x - s},${y}`}
          {...common}
        />
      );
    case "plus":
      return (
        <path
          d={`M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}`}
          stroke="rgba(0,0,0,0.38)"
          strokeWidth={s * 0.7}
          strokeLinecap="round"
        />
      );
    default:
      return (
        <circle
          cx={x}
          cy={y}
          r={s * 0.8}
          fill="none"
          stroke="rgba(0,0,0,0.38)"
          strokeWidth={s * 0.45}
        />
      );
  }
}

type Toast = { text: string; id: number };

// ssr: false で読み込むので、初期値の乱数や localStorage を描画中に読んでよい
export default function Game() {
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => loadNumber(BEST_KEY) ?? 0);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [clearing, setClearing] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // New Game を押したら、進行中の演出は捨てる
  const generation = useRef(0);

  const restart = useCallback(() => {
    generation.current++;
    setBoard(newBoard());
    setScore(0);
    setBusy(false);
    setOver(false);
    setSelected(null);
    setClearing(new Set());
    setToast(null);
  }, []);

  const play = useCallback(
    async (index: number, dir: Direction) => {
      if (busy || over) return;
      const gen = generation.current;
      const alive = () => generation.current === gen;
      setBusy(true);

      const result = spin(board, TRIANGLES[index], dir);
      for (const frame of result.frames) {
        setBoard(frame);
        await sleep(ROTATE_MS);
        if (!alive()) return;
      }

      let current = result.frames[result.frames.length - 1];
      let total = score;
      if (result.matched) {
        for (const step of resolveCascade(current, Math.random)) {
          setClearing(new Set(step.matches.cleared.map(cellKey)));
          const parts = [];
          if (step.matches.flowers.length > 0) parts.push("フラワー！");
          if (step.chain > 1) parts.push(`${step.chain} 連鎖`);
          parts.push(`+${step.gained}`);
          setToast({ text: parts.join(" "), id: Date.now() });
          total += step.gained;
          setScore(total);
          await sleep(CLEAR_MS);
          if (!alive()) return;
          setClearing(new Set());
          setBoard(step.after);
          current = step.after;
          await sleep(DROP_MS);
          if (!alive()) return;
        }
      }

      if (total > best) {
        setBest(total);
        saveNumber(BEST_KEY, total);
      }
      if (!hasMove(current)) setOver(true);
      setBusy(false);
    },
    [board, score, best, busy, over],
  );

  // ポインターの位置に一番近い頂点を回転の軸にする。小さな点を狙わずに済む
  const nearestPivot = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    let bestIndex: number | null = null;
    let bestDist = Infinity;
    TRIANGLES.forEach((tri, i) => {
      const { x, y } = pivotOf(tri);
      const d = (x * S - p.x) ** 2 + (y * S - p.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });
    // 盤面の外側の余白を押したときは反応しない
    return bestDist <= (S * 1.2) ** 2 ? bestIndex : null;
  }, []);

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const index = nearestPivot(e.clientX, e.clientY);
    if (index === null) return;
    if (e.pointerType === "mouse") {
      setSelected(index);
      void play(index, e.button === 2 ? "ccw" : "cw");
      return;
    }
    // タッチは 1 回目で選び、同じところをもう一度押したら時計回りに回す
    if (selected === index) void play(index, "cw");
    else setSelected(index);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  const focus = hover ?? selected;
  const focusTri = focus === null ? null : TRIANGLES[focus];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-4xl font-bold">Hexspin</h1>
        <div className="flex gap-2">
          <Stat label="スコア" value={score} />
          <Stat label="ベスト" value={best} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="opacity-70">3 枚を回して同じ色の三角形を作ろう</p>
        <button
          type="button"
          onClick={restart}
          className="shrink-0 rounded-md bg-slate-700 px-3 py-1.5 font-bold text-white hover:bg-slate-600"
        >
          New Game
        </button>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none select-none rounded-lg bg-slate-200 dark:bg-slate-800"
          role="img"
          aria-label="Hexspin の盤面"
          onPointerMove={(e) => {
            if (e.pointerType === "mouse")
              setHover(nearestPivot(e.clientX, e.clientY));
          }}
          onPointerLeave={() => setHover(null)}
          onPointerUp={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {board.map((col, c) =>
            col.map((color, r) => {
              const { x, y } = cellCenter({ c, r });
              const k = cellKey({ c, r });
              const tile = TILES[color];
              const isClearing = clearing.has(k);
              return (
                <g
                  key={k}
                  style={{
                    opacity: isClearing ? 0.25 : 1,
                    transition: "opacity 120ms",
                  }}
                >
                  <polygon
                    points={hexPoints(x * S, y * S, S * 0.94)}
                    fill={tile.fill}
                  />
                  <TileMark kind={tile.symbol} x={x * S} y={y * S} />
                </g>
              );
            }),
          )}
          {/* 選んだ 3 枚の枠は、隣のタイルに隠れないよう全タイルの上に重ねる */}
          {focusTri?.map((cell) => {
            const { x, y } = cellCenter(cell);
            return (
              <polygon
                key={cellKey(cell)}
                points={hexPoints(x * S, y * S, S * 0.94)}
                fill="none"
                stroke="#fff"
                strokeWidth={3}
                pointerEvents="none"
              />
            );
          })}
          {focusTri && (
            <circle
              pointerEvents="none"
              cx={pivotOf(focusTri).x * S}
              cy={pivotOf(focusTri).y * S}
              r={S * 0.22}
              fill="#fff"
              stroke="#0f172a"
              strokeWidth={2}
            />
          )}
        </svg>

        {toast && (
          <div
            key={toast.id}
            className="pointer-events-none absolute inset-x-0 top-3 text-center text-2xl font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
          >
            {toast.text}
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/75 dark:bg-black/65">
            <p className="text-3xl font-bold">ゲームオーバー</p>
            <p>揃えられる手がなくなりました</p>
            <p className="text-xl font-bold">スコア {score}</p>
            <button
              type="button"
              onClick={restart}
              className="rounded-md bg-slate-700 px-4 py-2 font-bold text-white hover:bg-slate-600"
            >
              もう一度
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <RotateButton
          label="↺ 反時計回り"
          disabled={selected === null || busy || over}
          onClick={() => selected !== null && void play(selected, "ccw")}
        />
        <RotateButton
          label="時計回り ↻"
          disabled={selected === null || busy || over}
          onClick={() => selected !== null && void play(selected, "cw")}
        />
      </div>

      <p className="text-center text-sm opacity-70">
        クリックで時計回り・右クリックで反時計回り。スマホはタップで選んで、もう一度タップかボタンで回す。
        周りの 6 枚を同じ色で囲むとフラワーで大きなボーナス。
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-md bg-slate-700 px-3 py-1 text-center text-white">
      <div className="text-xs">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function RotateButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md bg-slate-700 px-4 py-2 font-bold text-white hover:bg-slate-600 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
