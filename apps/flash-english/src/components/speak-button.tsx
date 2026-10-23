"use client";

import { useSyncExternalStore } from "react";
import { isSpeechSupported, speak } from "@/lib/speech";

const noop = () => () => {};

/** 読み上げに対応しているか。サーバーでの描画では false にして、ボタンを出さない */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noop, isSpeechSupported, () => false);
}

/** 英文を読み上げるボタン。読み上げに対応していないブラウザでは出さない */
export function SpeakButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const supported = useSpeechSupported();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        // 一覧の行やカードのクリックとして扱われないように
        e.preventDefault();
        e.stopPropagation();
        speak(text);
      }}
      aria-label={`「${text}」を読み上げる`}
      className={className ?? "px-1 text-zinc-400 hover:text-indigo-600"}
    >
      🔊
    </button>
  );
}
