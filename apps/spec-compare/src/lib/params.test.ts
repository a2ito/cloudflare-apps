import { describe, expect, it } from "vitest";
import { parseId } from "./params";

describe("parseId", () => {
  it("正の整数だけ読む", () => {
    expect(parseId("12")).toBe(12);
    expect(parseId("0")).toBeNull();
    expect(parseId("-1")).toBeNull();
    expect(parseId("1.5")).toBeNull();
    expect(parseId("abc")).toBeNull();
    expect(parseId(undefined)).toBeNull();
    expect(parseId(["1"])).toBeNull();
  });
});
