"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  DEFAULT_LAST_FROZEN,
  FROZEN_MAX_RATIO,
  frozenOffsets,
  toggleFrozen,
} from "@/lib/frozen-columns";

/** 何列目まで固定するかは画面の広さで合う値が変わるので、列幅と同じく端末（ブラウザ）ごとに覚える */
function storageKey(categoryId: number): string {
  return `spec-compare:frozen-columns:${categoryId}`;
}

/** 同じ画面のピンと表に変更を知らせるイベント */
const CHANGE_EVENT = "spec-compare:frozen-columns";

function loadLast(categoryId: number): string {
  try {
    return (
      window.localStorage.getItem(storageKey(categoryId)) ?? DEFAULT_LAST_FROZEN
    );
  } catch {
    // プライベートブラウズなどで読めないときは既定のまま
    return DEFAULT_LAST_FROZEN;
  }
}

function saveLast(categoryId: number, last: string): void {
  try {
    window.localStorage.setItem(storageKey(categoryId), last);
  } catch {
    // 保存できない環境では、開いている間だけ効く
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useLastFrozen(categoryId: number): string {
  return useSyncExternalStore(
    subscribe,
    () => loadLast(categoryId),
    () => DEFAULT_LAST_FROZEN,
  );
}

/** 見出しの列の並び（data-col の付いた th を左から） */
function headerColumns(table: HTMLTableElement): HTMLElement[] {
  return [...table.querySelectorAll<HTMLElement>("thead th[data-col]")];
}

/** 固定する列のセルを sticky にし、left をその列より左の列幅の合計にする */
function applyFrozen(table: HTMLTableElement, last: string): void {
  const headers = headerColumns(table);
  const offsets = frozenOffsets(
    headers.map((th) => ({
      key: th.dataset.col ?? "",
      width: th.getBoundingClientRect().width,
    })),
    last,
    // 横スクロールする箱（表の親）の見える幅
    (table.parentElement?.clientWidth ?? Infinity) * FROZEN_MAX_RATIO,
  );
  const lastKey = [...offsets.keys()].at(-1);
  for (const cell of table.querySelectorAll<HTMLElement>("[data-col]")) {
    const left = offsets.get(cell.dataset.col ?? "");
    if (left === undefined) {
      if (cell.dataset.frozen === undefined) continue;
      delete cell.dataset.frozen;
      cell.style.position = "";
      cell.style.left = "";
      cell.style.zIndex = "";
      continue;
    }
    cell.dataset.frozen = cell.dataset.col === lastKey ? "last" : "";
    cell.style.position = "sticky";
    cell.style.left = `${left}px`;
    // 見出しのセルは上にも固定しているので、縦横どちらにスクロールしても行のセルより上に出す
    cell.style.zIndex = cell.closest("thead") ? "30" : "10";
  }
}

/**
 * 表の中に置き、選んだ列まで左に固定する。列幅の変更や行の入れ替わりのたびに位置を合わせ直す。
 * 置く場所はどこでもよい（closest("table") で表を探す）
 */
export function FrozenColumns({ categoryId }: { categoryId: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useLastFrozen(categoryId);

  useEffect(() => {
    const table = ref.current?.closest("table");
    if (!table) return;
    const apply = () => applyFrozen(table, last);
    apply();
    const resize = new ResizeObserver(apply);
    for (const th of headerColumns(table)) resize.observe(th);
    // 画面の回転などで見える幅が変わると、固定できる列の数も変わる
    if (table.parentElement) resize.observe(table.parentElement);
    // 絞り込みや並べ替えで行が作り直されたときも、新しいセルに付け直す
    const mutation = new MutationObserver(apply);
    mutation.observe(table, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [last]);

  return <span ref={ref} hidden />;
}

/** 見出しに置くピン。押すとその列まで固定し、固定の右端で押すと 1 つ左までに戻す */
export function PinButton({
  categoryId,
  column,
  label,
}: {
  categoryId: number;
  column: string;
  label: string;
}) {
  const last = useLastFrozen(categoryId);
  const ref = useRef<HTMLButtonElement>(null);
  // 固定中かどうかの色は、FrozenColumns が見出しに付ける data-frozen を見て CSS で切り替える
  const onClick = () => {
    const table = ref.current?.closest("table");
    if (!table) return;
    const columns = headerColumns(table).map((th) => th.dataset.col ?? "");
    const current = columns.includes(last) ? last : DEFAULT_LAST_FROZEN;
    saveLast(categoryId, toggleFrozen(columns, current, column));
  };
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={`${label}の列まで左に固定する（固定の右端で押すと 1 つ戻す）`}
      aria-label={`${label}の列まで左に固定`}
      className="ml-1 inline-flex align-middle text-zinc-300 group-data-[frozen]/col:text-indigo-600 hover:text-indigo-500 dark:text-zinc-600 dark:group-data-[frozen]/col:text-indigo-400"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M9.8 1.2a.75.75 0 0 1 1.06 0l3.94 3.94a.75.75 0 0 1 0 1.06l-.9.9a.75.75 0 0 1-.68.2l-1.1-.22-2.4 2.4.36 2.13a.75.75 0 0 1-.21.65l-.9.9a.75.75 0 0 1-1.06 0L5.7 11.04l-3.42 3.42a.75.75 0 1 1-1.06-1.06l3.42-3.42-2.12-2.12a.75.75 0 0 1 0-1.06l.9-.9a.75.75 0 0 1 .65-.21l2.13.36 2.4-2.4-.22-1.1a.75.75 0 0 1 .2-.68l.9-.9Z" />
      </svg>
    </button>
  );
}
