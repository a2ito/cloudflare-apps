// インストール要件（fetch ハンドラを持つ Service Worker）を満たすための最小構成。
//
// ログイン必須の私的なデータを端末に残さないため、キャッシュするのはビルド成果物
// (/_next/static/) だけに限る。ページ・画像・サーバーアクションは常にネットワークへ
// 素通しするので、古い価格が表示されることはない。

const CACHE = "static-v1";
const STATIC_PREFIX = "/_next/static/";

self.addEventListener("install", () => {
	// 新しい SW をすぐ有効にする
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			// 名前が変わった古い世代のキャッシュを捨てる
			const names = await caches.keys();
			await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
			await self.clients.claim();
		})(),
	);
});

/** キャッシュしてよいのは、内容が変わらない同一オリジンのビルド成果物だけ */
function isImmutableAsset(request) {
	if (request.method !== "GET") return false;
	const url = new URL(request.url);
	return url.origin === self.location.origin && url.pathname.startsWith(STATIC_PREFIX);
}

self.addEventListener("fetch", (event) => {
	if (!isImmutableAsset(event.request)) return; // それ以外はブラウザ既定の挙動に任せる

	event.respondWith(
		(async () => {
			const cached = await caches.match(event.request);
			if (cached) return cached;

			const response = await fetch(event.request);
			if (response.ok) {
				const cache = await caches.open(CACHE);
				await cache.put(event.request, response.clone());
			}
			return response;
		})(),
	);
});
