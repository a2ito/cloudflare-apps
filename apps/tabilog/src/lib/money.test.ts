import { describe, expect, it } from "vitest";
import {
  amountToJpy,
  currencyDigits,
  currencyLabel,
  sumAsJpy,
  sumByCurrency,
  formatMoney,
  minorToInput,
  needsJpyConversion,
  parseAmountToMinor,
  sumMinor,
  toJpy,
  toRates,
} from "./money";

describe("currencyDigits", () => {
  it("円やウォンは小数を持たない", () => {
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("krw")).toBe(0);
  });
  it("ドルやユーロは 2 桁", () => {
    expect(currencyDigits("USD")).toBe(2);
    expect(currencyDigits("EUR")).toBe(2);
  });
});

describe("parseAmountToMinor", () => {
  it("円はそのまま整数になる", () => {
    expect(parseAmountToMinor("1200", "JPY")).toBe(1200);
    expect(parseAmountToMinor("1,200", "JPY")).toBe(1200);
  });
  it("ドルは 100 倍される", () => {
    expect(parseAmountToMinor("12.34", "USD")).toBe(1234);
    expect(parseAmountToMinor("12.3", "USD")).toBe(1230);
    expect(parseAmountToMinor("12", "USD")).toBe(1200);
  });
  it("表現できない桁は四捨五入する", () => {
    expect(parseAmountToMinor("100.4", "JPY")).toBe(100);
    expect(parseAmountToMinor("100.6", "JPY")).toBe(101);
    expect(parseAmountToMinor("12.345", "USD")).toBe(1235);
  });
  it("空欄や不正な文字列は null", () => {
    expect(parseAmountToMinor("", "JPY")).toBeNull();
    expect(parseAmountToMinor("いくら", "JPY")).toBeNull();
    expect(parseAmountToMinor("-100", "JPY")).toBeNull();
  });
  it("通貨記号は取り除く", () => {
    expect(parseAmountToMinor("¥1,200", "JPY")).toBe(1200);
    expect(parseAmountToMinor("$12.34", "USD")).toBe(1234);
  });
});

describe("minorToInput", () => {
  it("入力欄に戻せる", () => {
    expect(minorToInput(1200, "JPY")).toBe("1200");
    expect(minorToInput(1234, "USD")).toBe("12.34");
    expect(minorToInput(5, "USD")).toBe("0.05");
  });
  it("parse と往復しても値が変わらない", () => {
    for (const [text, code] of [
      ["1200", "JPY"],
      ["12.34", "USD"],
      ["0.05", "EUR"],
    ] as const) {
      const minor = parseAmountToMinor(text, code);
      expect(minor).not.toBeNull();
      expect(minorToInput(minor as number, code)).toBe(text);
    }
  });
});

describe("formatMoney", () => {
  it("通貨記号つきで表示する", () => {
    expect(formatMoney(1200, "JPY")).toContain("1,200");
    expect(formatMoney(1234, "USD")).toContain("12.34");
  });
  it("未知の通貨コードでも落ちない", () => {
    // Intl は未知の 3 文字コードもコードのまま表示する
    expect(formatMoney(1234, "XYZ")).toContain("12.34");
    expect(formatMoney(1234, "XYZ")).toContain("XYZ");
    // 不正なコードは自前のフォールバックに落ちる
    expect(formatMoney(1234, "X")).toBe("12.34 X");
  });
});

describe("toJpy", () => {
  it("レートを掛けて円にする", () => {
    expect(toJpy(1234, "USD", 150)).toBe(1851);
    expect(toJpy(10000, "KRW", 0.11)).toBe(1100);
  });
  it("円はレート 1 でそのまま", () => {
    expect(toJpy(1200, "JPY", 1)).toBe(1200);
  });
});

describe("needsJpyConversion", () => {
  it("円のときだけ換算不要", () => {
    expect(needsJpyConversion("JPY")).toBe(false);
    expect(needsJpyConversion("usd")).toBe(true);
  });
});

describe("sumMinor", () => {
  it("合計する", () => {
    expect(sumMinor([100, 200, 300])).toBe(600);
    expect(sumMinor([])).toBe(0);
  });
});

describe("toRates", () => {
  it("通貨コードを大文字にそろえたレート表を作る", () => {
    expect(toRates([{ code: "twd", rateToJpy: 4.7 }])).toEqual({ TWD: 4.7 });
  });
});

describe("currencyLabel", () => {
  it("選択肢にある通貨は日本語名で返す", () => {
    expect(currencyLabel("twd")).toContain("台湾ドル");
  });
  it("知らない通貨はコードのまま返す", () => {
    expect(currencyLabel("xyz")).toBe("XYZ");
  });
});

describe("amountToJpy", () => {
  const rates = { TWD: 4.7, THB: 4.3 };

  it("現地通貨はレートで円にする", () => {
    expect(amountToJpy({ minor: 20000, currency: "TWD" }, rates)).toBe(940);
  });
  it("円はレートが無くてもそのまま", () => {
    expect(amountToJpy({ minor: 1200, currency: "JPY" }, {})).toBe(1200);
  });
  it("複数の通貨をそれぞれのレートで換算する", () => {
    expect(amountToJpy({ minor: 12000, currency: "THB" }, rates)).toBe(516);
  });
  it("レートの分からない通貨は換算しない", () => {
    expect(amountToJpy({ minor: 1000, currency: "EUR" }, rates)).toBe(0);
  });
});

describe("sumAsJpy", () => {
  it("通貨が混ざっていても合計できる", () => {
    const total = sumAsJpy(
      [
        { minor: 20000, currency: "TWD" }, // 200 TWD = 940 円
        { minor: 12000, currency: "THB" }, // 120 THB = 516 円
        { minor: 1200, currency: "JPY" },
      ],
      { TWD: 4.7, THB: 4.3 },
    );
    expect(total).toBe(2656);
  });
  it("空なら 0", () => {
    expect(sumAsJpy([], { TWD: 4.7 })).toBe(0);
  });
});

describe("sumByCurrency", () => {
  it("通貨ごとにまとめる", () => {
    expect(
      sumByCurrency([
        { minor: 100, currency: "TWD" },
        { minor: 1200, currency: "JPY" },
        { minor: 50, currency: "twd" },
      ]),
    ).toEqual([
      { currency: "TWD", minor: 150 },
      { currency: "JPY", minor: 1200 },
    ]);
  });
});
