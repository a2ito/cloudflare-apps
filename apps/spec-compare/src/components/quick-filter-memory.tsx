"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  hasQuickKeys,
  parseSavedQuickParams,
  pickQuickParams,
  withQuickParams,
} from "@/lib/quick-filter-memory";

/** 列幅と同じく、絞り込みの好みは端末（ブラウザ）ごとに覚える。カテゴリごとに項目が違うので ID を入れる */
function storageKey(categoryId: number): string {
  return `spec-compare:quick-filters:${categoryId}`;
}

/**
 * 簡易フィルタで選んだ条件をブラウザに覚えておき、次に条件なしで開いたときに戻す。
 * 選び直すたびに今の条件で上書きするので、全部外せば次からは何も戻さない
 */
export function QuickFilterMemory({
  categoryId,
  fieldIds,
}: {
  categoryId: number;
  fieldIds: readonly number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restored = useRef(false);

  useEffect(() => {
    const search = new URLSearchParams(searchParams.toString());
    const current = pickQuickParams(search, fieldIds);
    if (!restored.current) {
      restored.current = true;
      // 空の値で外した条件も指定のうち。戻すのは簡易フィルタの条件が URL に一つも無いときだけ
      if (!hasQuickKeys(search, fieldIds)) {
        let saved: [string, string][] = [];
        try {
          saved = parseSavedQuickParams(
            window.localStorage.getItem(storageKey(categoryId)),
          );
        } catch {
          // プライベートブラウズなどで読めないときは、何も戻さない
        }
        const valid = pickQuickParams(new URLSearchParams(saved), fieldIds);
        if (valid.length > 0) {
          router.replace(`${pathname}?${withQuickParams(search, valid)}`, {
            scroll: false,
          });
          return;
        }
      }
    }
    try {
      window.localStorage.setItem(
        storageKey(categoryId),
        JSON.stringify(current),
      );
    } catch {
      // 保存できない環境では、開いている間だけ効く
    }
  }, [categoryId, fieldIds, pathname, router, searchParams]);

  return null;
}
