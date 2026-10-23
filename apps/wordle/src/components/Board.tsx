"use client";

import { useEffect, useState, useCallback } from "react";
import Tile from "./Tile";
import Keyboard from "./Keyboard";
import ResultModal from "./ResultModal";

// const STORAGE_KEY = `wordle-${new Date().toISOString().slice(0, 10)}`;

const ROWS = 6;
const COLS = 5;

const emptyBoard: string[][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => ""),
);

const emptyStatuses: TileStatus[][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => "empty"),
);

const emptyFlippedRows: boolean[] = Array.from({ length: ROWS }, () => false);

type TileStatus = "empty" | "correct" | "present" | "absent";
type KeyStatus = "unused" | "correct" | "present" | "absent";

type SavedState = {
  board: string[][];
  statuses: TileStatus[][];
  currentRow: number;
  currentCol: number;
  flippedRows: boolean[];
  keyStatuses: Record<string, KeyStatus>;
  gameState: "playing" | "won" | "lost";
};

export default function Board() {
  //const [board, setBoard] = useState<string[][]>(
  //  Array.from({ length: ROWS }, () => Array(COLS).fill(""))
  //);
  //const [statuses, setStatuses] = useState<TileStatus[][]>(
  //  Array.from({ length: ROWS }, () => Array(COLS).fill("empty"))
  //);
  //const [flippedRows, setFlippedRows] = useState<boolean[]>(
  //  Array(ROWS).fill(false)
  //);
  //const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});
  //const [gameState, setGameState] = useState<"playing" | "won" | "lost">(
  //  "playing"
  //);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const loadSavedState = useCallback((): SavedState | null => {
    if (typeof window === "undefined") return null;
    if (!storageKey) return null;

    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  }, [storageKey]);

  const saved = loadSavedState();

  const [board, setBoard] = useState(() => saved?.board ?? emptyBoard);
  const [statuses, setStatuses] = useState(
    () => saved?.statuses ?? emptyStatuses,
  );
  const [flippedRows, setFlippedRows] = useState(
    () => saved?.flippedRows ?? emptyFlippedRows,
  );
  const [keyStatuses, setKeyStatuses] = useState(
    () => saved?.keyStatuses ?? {},
  );
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">(
    () => saved?.gameState ?? "playing",
  );

  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);

  const [answer, setAnswer] = useState<string | null>(null);

  // 旧：ANSWER の計算
  // const ANSWER = getDailyWord();

  //useEffect(() => {
  //  async function fetchWord() {
  //    const res = await fetch("/api/daily-word");
  //    const data = await res.json();
  //    setAnswer(data.word);
  //
  //    const today = new Date().toISOString().slice(0, 10);
  //    setStorageKey(`wordle-${today}`);
  //  }
  //  fetchWord();
  //}, []);
  //
  //// storageKey が決まったら localStorage から復元
  //useEffect(() => {
  //  if (!storageKey || typeof window === "undefined") return;
  //
  //  const saved = localStorage.getItem(storageKey);
  //  if (!saved) return;
  //
  //  const data: SavedState = JSON.parse(saved);
  //  setBoard(data.board);
  //  setStatuses(data.statuses);
  //  setFlippedRows(data.flippedRows);
  //  setKeyStatuses(data.keyStatuses);
  //  setGameState(data.gameState);
  //  setCurrentRow(data.currentRow);
  //  setCurrentCol(data.currentCol);
  //}, [storageKey]);

  // 2. daily word と storageKey を取得
  useEffect(() => {
    async function init() {
      const res = await fetch("/api/daily-word");
      const data = await res.json();
      setAnswer(data.word);

      const today = new Date().toISOString().slice(0, 10);
      const key = `wordle-${today}`;
      setStorageKey(key);

      // ここで localStorage から一度に state を初期化する
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed: SavedState = JSON.parse(saved);
          setBoard(parsed.board);
          setStatuses(parsed.statuses);
          setFlippedRows(parsed.flippedRows);
          setKeyStatuses(parsed.keyStatuses);
          setGameState(parsed.gameState);
          setCurrentRow(parsed.currentRow);
          setCurrentCol(parsed.currentCol);
        }
      }
    }
    init();
  }, []);

  function evaluateGuess(guess: string[], answer: string): TileStatus[] {
    const result: TileStatus[] = Array(COLS).fill("absent");
    const answerChars = answer.split("");
    const used = Array(COLS).fill(false);

    // correct
    guess.forEach((char, i) => {
      if (char === answerChars[i]) {
        result[i] = "correct";
        used[i] = true;
      }
    });

    // present
    guess.forEach((char, i) => {
      if (result[i] === "correct") return;
      const index = answerChars.findIndex((c, j) => c === char && !used[j]);
      if (index !== -1) {
        result[i] = "present";
        used[index] = true;
      }
    });

    return result;
  }

  const handleKey = useCallback(
    (key: string) => {
      if (gameState !== "playing") return;

      if (key === "enter") {
        if (currentCol !== COLS) return;

        const guess = board[currentRow];
        // const result = evaluateGuess(guess, ANSWER);
        if (!answer) return;
        const result = evaluateGuess(guess, answer);

        const nextStatuses = statuses.map((row) => [...row]);
        nextStatuses[currentRow] = result;
        setStatuses(nextStatuses);

        const nextFlipped = [...flippedRows];
        nextFlipped[currentRow] = true;
        setFlippedRows(nextFlipped);

        const nextKeyStatuses = { ...keyStatuses };
        const priority = {
          correct: 3,
          present: 2,
          absent: 1,
          unused: 0,
        } as const;

        result.forEach((status, i) => {
          if (status === "empty") return; // ★ 追加

          const letter = guess[i];
          const prev = nextKeyStatuses[letter] ?? "unused";
          if (priority[status] > priority[prev]) {
            nextKeyStatuses[letter] = status;
          }
        });

        setKeyStatuses(nextKeyStatuses);

        if (result.every((s) => s === "correct")) {
          setGameState("won");
          return;
        }

        if (currentRow === ROWS - 1) {
          setGameState("lost");
          return;
        }

        if (currentRow < ROWS - 1) {
          setCurrentRow(currentRow + 1);
          setCurrentCol(0);
        }
        return;
      }

      if (key === "backspace") {
        if (currentCol === 0) return;
        const nextBoard = board.map((row) => [...row]);
        nextBoard[currentRow][currentCol - 1] = "";
        setBoard(nextBoard);
        setCurrentCol(currentCol - 1);
        return;
      }

      if (/^[a-z]$/.test(key)) {
        if (currentCol >= COLS) return;
        const nextBoard = board.map((row) => [...row]);
        nextBoard[currentRow][currentCol] = key;
        setBoard(nextBoard);
        setCurrentCol(currentCol + 1);
      }
    },
    [
      gameState,
      board,
      statuses,
      currentRow,
      currentCol,
      flippedRows,
      keyStatuses,
      answer,
    ],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") handleKey("enter");
      else if (e.key === "Backspace") handleKey("backspace");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  //useEffect(() => {
  //  const saved = localStorage.getItem(STORAGE_KEY);
  //  if (!saved) return;
  //
  //  //const data = JSON.parse(saved);
  //  //setBoard(data.board);
  //  //setStatuses(data.statuses);
  //  //setCurrentRow(data.currentRow);
  //  //setCurrentCol(data.currentCol);
  //  //setFlippedRows(data.flippedRows);
  //  //setKeyStatuses(data.keyStatuses);
  //  //setGameState(data.gameState);
  //  restoreState(JSON.parse(saved));
  //}, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (gameState === "playing") return;

    if (!storageKey) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        board,
        statuses,
        currentRow,
        currentCol,
        flippedRows,
        keyStatuses,
        gameState,
      }),
    );
  }, [
    board,
    statuses,
    currentRow,
    currentCol,
    flippedRows,
    keyStatuses,
    gameState,
    storageKey,
  ]);

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-rows-6 gap-2">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {row.map((letter, colIndex) => (
              <Tile
                key={colIndex}
                letter={letter}
                status={statuses[rowIndex][colIndex]}
                flip={flippedRows[rowIndex]}
                delayMs={colIndex * 120}
              />
            ))}
          </div>
        ))}
      </div>

      <Keyboard onKeyPress={handleKey} keyStatuses={keyStatuses} />

      {gameState !== "playing" && answer && (
        <ResultModal state={gameState} answer={answer} onClose={() => {}} />
      )}
    </div>
  );
}
