import { describe, expect, it } from "vitest";
import { planShrink, PRODUCT_IMAGE, RECORD_PHOTO } from "./image-shrink";

const KB = 1024;

describe("planShrink", () => {
	it("商品画像は長辺 600px に縮める", () => {
		expect(planShrink({ type: "image/jpeg", size: 2000 * KB, width: 4032, height: 3024 }, PRODUCT_IMAGE)).toEqual({
			kind: "encode",
			width: 600,
			height: 450,
		});
	});

	it("価格記録の写真は長辺 1200px に縮める", () => {
		expect(planShrink({ type: "image/jpeg", size: 2000 * KB, width: 3024, height: 4032 }, RECORD_PHOTO)).toEqual({
			kind: "encode",
			width: 900,
			height: 1200,
		});
	});

	it("縮小が要らない小さな JPEG はそのまま送る", () => {
		expect(planShrink({ type: "image/jpeg", size: 50 * KB, width: 500, height: 400 }, PRODUCT_IMAGE)).toEqual({ kind: "keep" });
	});

	it("縮小が要らなくても、上限を超える JPEG は再エンコードする", () => {
		expect(planShrink({ type: "image/jpeg", size: 300 * KB, width: 600, height: 600 }, PRODUCT_IMAGE)).toEqual({
			kind: "encode",
			width: 600,
			height: 600,
		});
	});

	it("小さくても PNG は JPEG に直す", () => {
		expect(planShrink({ type: "image/png", size: 20 * KB, width: 300, height: 300 }, PRODUCT_IMAGE)).toMatchObject({ kind: "encode" });
	});

	it("GIF と画像以外は触らない", () => {
		expect(planShrink({ type: "image/gif", size: 900 * KB, width: 2000, height: 2000 }, PRODUCT_IMAGE)).toEqual({ kind: "keep" });
		expect(planShrink({ type: "application/pdf", size: 900 * KB, width: 0, height: 0 }, PRODUCT_IMAGE)).toEqual({ kind: "keep" });
	});
});
