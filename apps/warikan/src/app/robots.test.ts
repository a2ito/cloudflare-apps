import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("AI のクローラにはすべてのパスをたどらせない", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules).toContainEqual(
      expect.objectContaining({ disallow: "/", userAgent: expect.arrayContaining(["GPTBot", "ClaudeBot", "CCBot"]) }),
    );
  });

  it("それ以外のクローラ（検索エンジン）には公開する", () => {
    expect(robots().rules).toContainEqual({ userAgent: "*", allow: "/" });
  });
});
