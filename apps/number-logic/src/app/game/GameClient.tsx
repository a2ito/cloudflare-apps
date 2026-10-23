"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { updateHighScore } from "@/lib/highscore";

/* =====================
   Types
===================== */
type Cell = {
  value: number | null;
  fixed: boolean;
};

type Board = Cell[][];
type Difficulty = "easy" | "normal" | "hard";

/* =====================
   Utils
===================== */
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* =====================
   Solution Generator
===================== */
const BASE_SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function generateSolution(): number[][] {
  const rows = shuffle([0, 1, 2]).flatMap((b) =>
    shuffle([0, 1, 2]).map((r) => b * 3 + r),
  );
  const cols = shuffle([0, 1, 2]).flatMap((b) =>
    shuffle([0, 1, 2]).map((c) => b * 3 + c),
  );
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  return rows.map((r) => cols.map((c) => nums[BASE_SOLUTION[r][c] - 1]));
}

/* =====================
   Solver (unique check)
===================== */
function isValid(
  board: (number | null)[][],
  r: number,
  c: number,
  n: number,
): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === n) return false;
    if (board[i][c] === n) return false;
  }

  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[br + i][bc + j] === n) return false;
    }
  }

  return true;
}

function countSolutions(board: (number | null)[][], limit = 2): number {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === null) {
        let count = 0;
        for (let n = 1; n <= 9; n++) {
          if (isValid(board, r, c, n)) {
            board[r][c] = n;
            count += countSolutions(board, limit);
            board[r][c] = null;
            if (count >= limit) return count;
          }
        }
        return count;
      }
    }
  }
  return 1;
}

/* =====================
   Puzzle Generator
===================== */
const REMOVE_COUNT: Record<Difficulty, number> = {
  easy: 35,
  normal: 45,
  hard: 55,
};

function generatePuzzleUnique(
  solution: number[][],
  difficulty: Difficulty,
): (number | null)[][] {
  const puzzle: (number | null)[][] = solution.map((row) => row.map((v) => v));
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let remove = REMOVE_COUNT[difficulty];

  for (const idx of cells) {
    if (remove <= 0) break;

    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const backup = puzzle[r][c];

    puzzle[r][c] = null;
    const copy = puzzle.map((row) => [...row]);

    if (countSolutions(copy) !== 1) {
      puzzle[r][c] = backup;
    } else {
      remove--;
    }
  }

  return puzzle;
}

function createBoard(puzzle: (number | null)[][]): Board {
  return puzzle.map((row) =>
    row.map((v) => ({
      value: v,
      fixed: v !== null,
    })),
  );
}

/* =====================
   Page
===================== */
export default function GamePage() {
  const searchParams = useSearchParams();
  const difficulty = (searchParams.get("difficulty") ?? "normal") as
    "easy" | "normal" | "hard";

  const [solution, setSolution] = useState<number[][]>([]);
  const [board, setBoard] = useState<Board>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [isCleared, setIsCleared] = useState(false);

  /* 初期化 & 難易度変更 */
  useEffect(() => {
    const sol = generateSolution();
    const puzzle = generatePuzzleUnique(sol, difficulty);

    setSolution(sol);
    setBoard(createBoard(puzzle));
    setSelected(null);
    setSeconds(0);
    setCompleted(false);
  }, [difficulty]);

  /* Timer */
  useEffect(() => {
    if (completed) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [completed]);

  /* Clear check */
  useEffect(() => {
    if (!solution.length) return;

    const ok = board.every((row, r) =>
      row.every((cell, c) => cell.value === solution[r][c]),
    );

    if (ok && !completed) {
      setCompleted(true);
      onGameClear(seconds);
    }
  }, [board, completed, seconds, solution]);

  const inputNumber = (n: number) => {
    if (!selected) return;
    const [r, c] = selected;
    if (board[r][c].fixed) return;

    setBoard((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].value = n;
      return next;
    });
  };

  const clearCell = () => {
    if (!selected) return;
    const [r, c] = selected;
    if (board[r][c].fixed) return;

    setBoard((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].value = null;
      return next;
    });
  };

  const onGameClear = (time: number) => {
    const isNew = updateHighScore(difficulty, time);

    setIsCleared(true);
    setMessage(isNew ? "🎉 New High Score!" : "🎊 Clear!");
  };

  return (
    <main className="min-h-screen flex flex-col items-center gap-5 py-6">
      <header className="flex items-center gap-4">
        <Link href="/" className="text-sm underline opacity-70">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Number Logic</h1>
        <span className="text-sm opacity-80">⏱ {seconds}s</span>
      </header>

      {/* Difficulty */}
      <div className="flex gap-2">
        <h2 className="text-lg text-gray-800 dark:text-gray-100 mb-4">
          Difficulty: {difficulty}
        </h2>
      </div>

      {/* Board */}
      <div className="grid grid-cols-9 gap-[2px] bg-black p-[2px] rounded">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const selectedCell = selected?.[0] === r && selected?.[1] === c;
            const wrong =
              cell.value !== null && cell.value !== solution[r]?.[c];

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => !cell.fixed && setSelected([r, c])}
                className={`
    w-10 h-10 flex items-center justify-center
    text-lg font-semibold

    bg-white dark:bg-slate-800
    ${cell.fixed ? "font-bold text-gray-800 dark:text-gray-200" : ""}
    ${selectedCell ? "ring-2 ring-blue-500" : ""}
    ${wrong ? "text-red-500" : ""}

    border border-gray-400 dark:border-gray-600

    ${r % 3 === 0 ? "border-t-2 border-t-black dark:border-t-gray-300" : ""}
    ${c % 3 === 0 ? "border-l-2 border-l-black dark:border-l-gray-300" : ""}
    ${r === 8 ? "border-b-2 border-b-black dark:border-b-gray-300" : ""}
    ${c === 8 ? "border-r-2 border-r-black dark:border-r-gray-300" : ""}
  `}
              >
                {cell.value ?? ""}
              </button>
            );
          }),
        )}
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => inputNumber(n)}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {n}
          </button>
        ))}
        <button
          onClick={clearCell}
          className="col-span-2 px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600"
        >
          Clear
        </button>
      </div>

      {completed && (
        <div className="text-green-500 font-semibold">
          🎉 Completed in {seconds}s!
        </div>
      )}

      {message && (
        <div
          className="
      mt-4 p-4 rounded-lg text-center font-bold
      bg-gradient-to-r from-green-400 to-blue-500
      text-white
      animate-bounce
    "
        >
          {message}
        </div>
      )}

      {isCleared && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl text-center space-y-4">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {message}
            </p>

            <button
              onClick={() => (location.href = "/")}
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
