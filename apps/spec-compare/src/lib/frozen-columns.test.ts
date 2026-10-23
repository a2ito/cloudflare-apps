import { describe, expect, it } from "vitest";
import { frozenOffsets, toggleFrozen } from "./frozen-columns";

const COLS = [
  { key: "name", width: 200 },
  { key: "price", width: 100 },
  { key: "cost", width: 80 },
  { key: "f1", width: 60 },
];

describe("frozenOffsets", () => {
  it("選んだ列まで、左から幅を足した位置に固定する", () => {
    expect([...frozenOffsets(COLS, "cost")]).toEqual([
      ["name", 0],
      ["price", 200],
      ["cost", 300],
    ]);
  });
  it("選んだ列が無ければ最安値まで", () => {
    expect([...frozenOffsets(COLS, "f99")]).toEqual([
      ["name", 0],
      ["price", 200],
    ]);
  });
  it("商品の列だけにもできる", () => {
    expect([...frozenOffsets(COLS, "name")]).toEqual([["name", 0]]);
  });
});

describe("toggleFrozen", () => {
  const keys = COLS.map((c) => c.key);
  it("固定していない列を押すとそこまで固定する", () => {
    expect(toggleFrozen(keys, "price", "f1")).toBe("f1");
  });
  it("固定の右端を押すと 1 つ左までに戻す", () => {
    expect(toggleFrozen(keys, "price", "price")).toBe("name");
    expect(toggleFrozen(keys, "f1", "f1")).toBe("cost");
  });
  it("固定の途中の列を押すとそこまでに縮める", () => {
    expect(toggleFrozen(keys, "f1", "price")).toBe("price");
  });
});
