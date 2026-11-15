import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createDevice, upsertUser } from "@/db/queries";
import { MAX_REQUEST_BYTES } from "@/lib/limits";
import { hashToken } from "@/lib/token";
import { createTestEnv, type TestEnv } from "@/test/d1";

let t: TestEnv;
vi.mock("@/lib/cloudflare", () => ({ getEnv: () => Promise.resolve(t.env) }));
const { POST } = await import("./route");

beforeAll(async () => {
  t = await createTestEnv();
});
afterAll(() => t.dispose());

const TOKEN = "wfm_route-test";
beforeEach(async () => {
  await t.truncate();
  const user = await upsertUser(t.db, {
    email: "tester@example.com",
    name: null,
    image: null,
  });
  await createDevice(t.db, user.id, {
    name: "Mac",
    tokenHash: await hashToken(TOKEN),
  });
});

/** Content-Length を付けずに本文を流す（chunked 転送と同じ形） */
function streamOf(text: string, pulls: { count: number }): ReadableStream {
  const bytes = new TextEncoder().encode(text);
  const chunk = 16 * 1024;
  let offset = 0;
  return new ReadableStream(
    {
      pull(controller) {
        pulls.count++;
        if (offset >= bytes.length) return controller.close();
        controller.enqueue(bytes.slice(offset, offset + chunk));
        offset += chunk;
      },
      // 既定では作った時点で 1 回先読みする。読まれた回数だけを数えたいので止める
    },
    { highWaterMark: 0 },
  );
}

function post(
  body: BodyInit,
  headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` },
): Promise<Response> {
  return POST(
    new Request("http://localhost/api/samples", {
      method: "POST",
      headers,
      body,
      // ストリームの本文を送るときに要る
      ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
    } as RequestInit),
  );
}

describe("POST /api/samples", () => {
  it("計測値を受け取って 200 を返す", async () => {
    const res = await post(
      JSON.stringify({ samples: [{ measuredAt: new Date().toISOString() }] }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 1, skipped: 0 });
  });

  it("JSON でない本文は 400", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
  });

  it("Content-Length が上限を超えていれば読まずに 413", async () => {
    const res = await post("{}", {
      authorization: `Bearer ${TOKEN}`,
      "content-length": String(MAX_REQUEST_BYTES + 1),
    });
    expect(res.status).toBe(413);
  });

  it("Content-Length が無くても、読んだ量が上限を超えたら途中でやめて 413", async () => {
    const pulls = { count: 0 };
    const big = "x".repeat(MAX_REQUEST_BYTES * 4);
    const res = await post(streamOf(big, pulls));
    expect(res.status).toBe(413);
    // 全部（64 回強）は読んでいない
    expect(pulls.count).toBeLessThan(40);
  });

  it("トークンが正しくなければ、本文を読まずに 401", async () => {
    const pulls = { count: 0 };
    const res = await post(streamOf("{}", pulls), {
      authorization: "Bearer wfm_wrong",
    });
    expect(res.status).toBe(401);
    expect(pulls.count).toBe(0);
  });
});
