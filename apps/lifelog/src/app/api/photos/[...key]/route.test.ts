import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { addPhotos, createEntry, upsertUser } from "@/db/queries";
import { createTestEnv, type TestEnv } from "@/test/d1";

let t: TestEnv;
let signedInAs: number | null = 1;
vi.mock("@/lib/auth", () => ({ currentUserId: async () => signedInAs }));
vi.mock("@/lib/cloudflare", () => ({ getEnv: () => Promise.resolve(t.env) }));
const { GET } = await import("./route");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());

let key: string;
beforeEach(async () => {
  await t.truncate();
  signedInAs = 1;
  await upsertUser(t.db, {
    email: "tester@example.com",
    name: null,
    image: null,
  });
  await upsertUser(t.db, {
    email: "other@example.com",
    name: null,
    image: null,
  });
  const entry = await createEntry(t.db, 1, {
    happenedAt: "2026-09-25T12:00",
    body: "x",
  });
  key = `entries/${entry.id}/photo.jpg`;
  await t.bucket.put(key, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await addPhotos(t.db, entry.id, [{ key, contentType: "image/jpeg" }]);
});

function get(objectKey: string) {
  return GET(new Request(`http://localhost/api/photos/${objectKey}`), {
    params: Promise.resolve({ key: objectKey.split("/") }),
  } as Parameters<typeof GET>[1]);
}

describe("GET /api/photos", () => {
  it("持ち主には写真を返す。共有キャッシュには載せない", async () => {
    const res = await get(key);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toMatch(/^private/);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("未ログインは 401", async () => {
    signedInAs = null;
    expect((await get(key)).status).toBe(401);
  });

  it("他人の写真は、あるかどうかも知らせず 404", async () => {
    signedInAs = 2;
    expect((await get(key)).status).toBe(404);
  });

  it("写真の置き場所の外は辿らせない", async () => {
    expect((await get("other/secret.txt")).status).toBe(404);
  });
});
