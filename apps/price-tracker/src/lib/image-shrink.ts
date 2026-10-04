/**
 * アップロード前の縮小の方針。
 * 商品画像は一覧で 80px、詳細で 192px にしか出さないため、3 倍の画面でも足りる 600px に抑える。
 * 一覧は商品数ぶんの画像を並べるので、ここを軽くするほどトップの表示が速くなる。
 * 値札やレシートの写真は拡大して文字を読むため、1200px を残す
 */
export type ShrinkProfile = {
	/** 長辺の上限（px） */
	maxEdge: number;
	/** 縮小が要らないとき、このサイズ未満の JPEG はそのまま送る（byte） */
	passThroughBytes: number;
};

export const PRODUCT_IMAGE: ShrinkProfile = { maxEdge: 600, passThroughBytes: 100 * 1024 };
export const RECORD_PHOTO: ShrinkProfile = { maxEdge: 1200, passThroughBytes: 500 * 1024 };

export type ShrinkPlan = { kind: "keep" } | { kind: "encode"; width: number; height: number };

/**
 * 縮小・再エンコードするかを決める。
 * 縮小が要らなくても、JPEG 以外（PNG のスクリーンショットなど）や大きすぎるものは JPEG に直す
 */
export function planShrink(
	image: { type: string; size: number; width: number; height: number },
	profile: ShrinkProfile,
): ShrinkPlan {
	// GIF は動きが消えるので触らない
	if (!image.type.startsWith("image/") || image.type === "image/gif") return { kind: "keep" };
	const scale = Math.min(1, profile.maxEdge / Math.max(image.width, image.height));
	if (scale === 1 && image.type === "image/jpeg" && image.size < profile.passThroughBytes) return { kind: "keep" };
	return { kind: "encode", width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
}
