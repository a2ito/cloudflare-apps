import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestEnv, fakeImage, type TestEnv } from "@/test/d1";

let t: TestEnv;

vi.mock("@/lib/cloudflare", () => ({
	getEnv: () => Promise.resolve(t.env),
}));

const { deleteImage, imageUrl, storeImage } = await import("./images");

beforeAll(async () => {
	t = await createTestEnv();
});
afterAll(() => t.dispose());

describe("storeImage", () => {
	it("ファイルが無い / 空なら null", async () => {
		expect(await storeImage(null)).toBeNull();
		expect(await storeImage(new File([], "empty.jpg", { type: "image/jpeg" }))).toBeNull();
	});

	it("R2 に products/ 配下のキーで保存し content-type を残す", async () => {
		const key = await storeImage(fakeImage("image/png", 100, "a.png"));
		expect(key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
		const obj = await t.bucket.get(key!);
		expect(obj?.httpMetadata?.contentType).toBe("image/png");
		expect(obj?.size).toBe(100);
	});

	it("対応外の形式は拒否", async () => {
		await expect(storeImage(fakeImage("application/pdf", 10, "x.pdf"))).rejects.toThrow(/対応していない画像形式/);
		await expect(storeImage(fakeImage("image/svg+xml", 10, "x.svg"))).rejects.toThrow(/対応していない画像形式/);
	});

	it("4MB を超えると拒否", async () => {
		await expect(storeImage(fakeImage("image/jpeg", 4 * 1024 * 1024 + 1))).rejects.toThrow(/4MB/);
	});
});

describe("deleteImage", () => {
	it("キーがあれば削除し、null なら何もしない", async () => {
		const key = await storeImage(fakeImage());
		await deleteImage(key);
		expect(await t.bucket.head(key!)).toBeNull();
		await expect(deleteImage(null)).resolves.toBeUndefined();
	});
});

describe("imageUrl", () => {
	it("R2 カスタムドメイン上の URL を返す", () => {
		expect(imageUrl("products/abc.jpg")).toBe("https://images.example.com/products/abc.jpg");
	});

	it("基底 URL 末尾の / は重ねない", () => {
		vi.stubEnv("NEXT_PUBLIC_IMAGES_BASE_URL", "https://images.example.com/");
		expect(imageUrl("products/abc.jpg")).toBe("https://images.example.com/products/abc.jpg");
		vi.unstubAllEnvs();
	});

	it("基底 URL が無ければ開発用に /api/images へ落とす", () => {
		vi.stubEnv("NEXT_PUBLIC_IMAGES_BASE_URL", "");
		expect(imageUrl("products/abc.jpg")).toBe("/api/images/products/abc.jpg");
		vi.unstubAllEnvs();
	});

});
