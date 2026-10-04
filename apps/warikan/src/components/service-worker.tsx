"use client";

import { useEffect } from "react";

/** インストール可能にするために Service Worker を登録する */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 開発中はビルドのたびに中身が変わるのに、チャンクの URL は使い回される。
    // キャッシュから古い JS が返ると編集が画面に反映されなくなるため、
    // 本番でだけ登録し、開発中は残っている登録とキャッシュを消しておく。
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) if (key.startsWith("warikan-")) void caches.delete(key);
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.error("Service Worker の登録に失敗しました", err);
    });
  }, []);

  return null;
}
