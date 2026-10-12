"use client";

import { useEffect } from "react";

/** ホーム画面へのインストールを可能にするため Service Worker を登録する */
export function ServiceWorkerRegister() {
	useEffect(() => {
		// 開発中は /_next/static/ のファイル名が変わらず、SW が古い JS を返して画面が更新されなくなる
		if (process.env.NODE_ENV !== "production") return;
		if (!("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch((err) => {
			// 登録できなくてもアプリ自体は動くので、握りつぶさず記録だけ残す
			console.error("Service Worker の登録に失敗しました", err);
		});
	}, []);

	return null;
}
