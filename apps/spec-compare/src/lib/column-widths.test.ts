import { describe, expect, it } from "vitest";
import { parseColumnWidths, setColumnWidth } from "./column-widths";

describe("parseColumnWidths", () => {
  it("保存した幅を読む", () => {
    expect(parseColumnWidths('{"price":120,"f12":80}')).toEqual({
      price: 120,
      f12: 80,
    });
  });

  it("無い・壊れている・数でない値は捨てる", () => {
    expect(parseColumnWidths(null)).toEqual({});
    expect(parseColumnWidths("{")).toEqual({});
    expect(parseColumnWidths("[1,2]")).toEqual({});
    expect(parseColumnWidths('{"a":"100","b":-5,"c":0,"d":90}')).toEqual({
      d: 90,
    });
  });
});

describe("setColumnWidth", () => {
  it("幅を足し、整数に丸める", () => {
    expect(setColumnWidth({ price: 120 }, "f12", 80.6)).toEqual({
      price: 120,
      f12: 81,
    });
  });

  it("null なら保存した幅を消す", () => {
    expect(setColumnWidth({ price: 120, f12: 80 }, "f12", null)).toEqual({
      price: 120,
    });
  });
});
