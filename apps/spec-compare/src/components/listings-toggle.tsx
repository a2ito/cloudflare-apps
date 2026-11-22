"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ListingsState = { open: boolean; toggle: () => void };

const ListingsContext = createContext<ListingsState | null>(null);

function useListings(): ListingsState {
  const state = useContext(ListingsContext);
  if (!state) throw new Error("ListingsGroup の外では使えません");
  return state;
}

/**
 * 1 つの製品の行と、その下に並べるほかの出品の行をまとめる。
 * 開閉は製品ごとに持つ。行の中身はサーバーで描いたものをそのまま受け取る
 */
export function ListingsGroup({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <ListingsContext value={{ open, toggle: () => setOpen((o) => !o) }}>
      {children}
    </ListingsContext>
  );
}

/** 製品の行に置く開閉ボタン */
export function ListingsToggle({ count }: { count: number }) {
  const { open, toggle } = useListings();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      title={open ? "ほかの出品を隠す" : "ほかの出品を製品の下に並べる"}
      className="block w-full text-right text-xs font-normal text-zinc-500 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
    >
      ほか {count} 件 {open ? "▾" : "▸"}
    </button>
  );
}

/** 開いているときだけ中身（ほかの出品の行）を出す */
export function ListingsWhenOpen({ children }: { children: ReactNode }) {
  const { open } = useListings();
  return open ? children : null;
}
