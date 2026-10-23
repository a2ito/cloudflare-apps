"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "./spinner";

/**
 * <Link> の子に置くと、遷移待ちの間だけぐるぐるが見える。
 *
 * 場所は常に確保して、出たり消えたりで文字がずれないようにする
 * （Next.js のドキュメントが注意している「インライン表示はレイアウトのズレを起こしやすい」への対応）。
 * 先読みが済んでいる遷移では pending にならないので、何も出ない。
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center transition-opacity ${
        pending ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      <Spinner />
    </span>
  );
}
