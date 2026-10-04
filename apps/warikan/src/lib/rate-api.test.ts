import { describe, expect, it, vi } from "vitest";
import { fetchRate, fetchRates, toRateString } from "./rate-api";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("toRateString", () => {
  it("有効数字 8 桁に丸める", () => {
    expect(toRateString(149.91234567)).toBe("149.91235");
    expect(toRateString(0.000724)).toBe("0.000724");
    expect(toRateString(9.1)).toBe("9.1");
  });

  it("扱えない値は null", () => {
    expect(toRateString(0)).toBeNull();
    expect(toRateString(-1)).toBeNull();
    expect(toRateString(Number.NaN)).toBeNull();
    expect(toRateString(1e12)).toBeNull();
  });
});

describe("fetchRate", () => {
  it("外貨 1 単位あたりの精算通貨の額と基準日を返す", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ date: "2026-10-03", krw: { jpy: 0.10931, usd: 0.00072 } }),
    );
    await expect(fetchRate("KRW", "JPY", fetchImpl)).resolves.toEqual({
      rate: "0.10931",
      date: "2026-10-03",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/currencies/krw.json"),
      expect.anything(),
    );
  });

  it("1 つ目が失敗したらミラーから取る", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ date: "2026-10-03", usd: { jpy: 150 } }));
    await expect(fetchRate("USD", "JPY", fetchImpl)).resolves.toEqual({
      rate: "150",
      date: "2026-10-03",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("どこからも取れなければ null", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(json({ date: "2026-10-03", usd: {} }));
    await expect(fetchRate("USD", "JPY", fetchImpl)).resolves.toBeNull();
  });
});

describe("fetchRates", () => {
  it("取れた通貨だけを返す", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/usd.json")
        ? json({ date: "2026-10-03", usd: { jpy: 150.5 } })
        : json({}, 404),
    );
    const rates = await fetchRates(["USD", "TWD"], "JPY", fetchImpl);
    expect([...rates.keys()]).toEqual(["USD"]);
    expect(rates.get("USD")?.rate).toBe("150.5");
  });
});
