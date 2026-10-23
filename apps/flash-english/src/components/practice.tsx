"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { recordReviewAction } from "@/app/actions/practice";
import type { PracticeSentence } from "@/db/queries";
import { useBooleanPreference } from "@/lib/preferences";
import { speak, stopSpeaking } from "@/lib/speech";
import { SpeakButton, useSpeechSupported } from "./speak-button";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

type Question = Pick<PracticeSentence, "id" | "ja" | "en" | "note">;

/**
 * 瞬間英作文の練習。日本文を見て英文を口に出し、答えを見て自分で○×を付ける。
 *
 * ×の文は列の最後に回して、同じ練習のうちにもう一度出す。言えるようになるまで繰り返すため。
 * 結果の「○の数」は 1 回目の答えで数える（2 回目以降は答えを見た直後なので）。
 *
 * 答えを見たら英文を読み上げる（オフにもできる）。自分の言った英文と、音で比べられるように。
 */
export function Practice({ questions }: { questions: Question[] }) {
  const [queue, setQueue] = useState(questions);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [firstTry, setFirstTry] = useState<ReadonlyMap<number, boolean>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const speechSupported = useSpeechSupported();
  const [autoSpeak, setAutoSpeak] = useBooleanPreference(
    "flash-english:auto-speak",
    true,
  );

  const current = queue[index];
  const done = current === undefined;

  // 読み上げは effect ではなく操作の中で始める。iOS はユーザー操作の中でしか音声を鳴らせないため
  const reveal = useCallback(() => {
    if (!current) return;
    setRevealed(true);
    if (autoSpeak) speak(current.en);
  }, [current, autoSpeak]);

  const grade = useCallback(
    (correct: boolean) => {
      if (!current) return;
      startTransition(async () => {
        try {
          await recordReviewAction(current.id, correct);
        } catch (e) {
          setError(e instanceof Error ? e.message : "記録に失敗しました");
        }
      });
      setFirstTry((m) =>
        m.has(current.id) ? m : new Map(m).set(current.id, correct),
      );
      stopSpeaking();
      if (!correct) setQueue((q) => [...q, current]);
      setIndex((i) => i + 1);
      setRevealed(false);
    },
    [current],
  );

  // 手を離さずに続けられるよう、キーボードでも操作できるようにする
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed && current && (e.key === "r" || e.key === "R")) {
        speak(current.en);
      } else if (revealed && e.key === "ArrowRight") {
        grade(true);
      } else if (revealed && e.key === "ArrowLeft") {
        grade(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, revealed, current, reveal, grade]);

  if (done) {
    const correctCount = [...firstTry.values()].filter(Boolean).length;
    const missed = questions.filter((q) => firstTry.get(q.id) === false);
    return (
      <section className="space-y-6">
        <div className="rounded-lg bg-indigo-50 py-6 text-center dark:bg-indigo-950/40">
          <p className="text-sm text-zinc-500">1 回目で言えた文</p>
          <p className="text-4xl font-bold tabular-nums">
            {correctCount}
            <span className="ml-1 text-base font-normal text-zinc-500">
              / {questions.length}
            </span>
          </p>
        </div>
        {missed.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold">言えなかった文</h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {missed.map((q) => (
                <li key={q.id} className="py-2">
                  <p className="text-sm text-zinc-500">{q.ja}</p>
                  <p lang="en">
                    {q.en}
                    <SpeakButton text={q.en} />
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {/* 出題の順番はサーバーで決め直すので、読み込み直す */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={primaryButtonClass}
          >
            もう一度
          </button>
          <Link href="/" className={secondaryButtonClass}>
            セット一覧へ
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 text-sm text-zinc-500">
        {speechSupported ? (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
            />
            答えを読み上げる
          </label>
        ) : (
          <span />
        )}
        <span className="tabular-nums">
          {index + 1} / {queue.length}
        </span>
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xl leading-relaxed font-semibold">{current.ja}</p>
        {revealed && (
          <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex items-start gap-2">
              <p
                lang="en"
                className="flex-1 text-xl leading-relaxed text-indigo-700 dark:text-indigo-300"
              >
                {current.en}
              </p>
              <SpeakButton
                text={current.en}
                className="flex-none rounded-md px-2 py-1 text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              />
            </div>
            {current.note && (
              <p className="text-sm text-zinc-500">{current.note}</p>
            )}
          </div>
        )}
      </div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => grade(false)}
            className="rounded-md border border-red-300 py-4 text-lg font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            × 言えなかった
            <span className="ml-1 hidden text-xs font-normal text-zinc-400 sm:inline">
              ←
            </span>
          </button>
          <button
            type="button"
            onClick={() => grade(true)}
            className="rounded-md border border-emerald-300 py-4 text-lg font-semibold text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950"
          >
            ○ 言えた
            <span className="ml-1 hidden text-xs font-normal text-zinc-400 sm:inline">
              →
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={reveal}
          className={`${primaryButtonClass} w-full py-4 text-lg`}
        >
          答えを見る
          <span className="ml-2 hidden text-xs font-normal opacity-70 sm:inline">
            Space
          </span>
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          やめる
        </Link>
      </p>
    </section>
  );
}
