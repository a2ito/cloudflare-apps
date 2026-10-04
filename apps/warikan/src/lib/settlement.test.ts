import { describe, expect, it } from "vitest";
import {
  calculateSettlement,
  splitByWeight,
  splitEqually,
} from "./settlement";

describe("splitByWeight", () => {
  it("重みの比で分ける", () => {
    expect(splitByWeight(12000, [20, 10, 10])).toEqual([6000, 3000, 3000]);
    expect(splitByWeight(10000, [15, 10])).toEqual([6000, 4000]);
  });

  it("合計は必ず元の金額と一致する", () => {
    for (const [amount, weights] of [
      [1000, [10, 10, 10]],
      [1001, [15, 10, 5]],
      [7, [20, 15, 10, 5]],
      [99999, [35, 10, 25]],
    ] as const) {
      const shares = splitByWeight(amount, [...weights]);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(amount);
    }
  });

  it("端数は余りの大きい人から配る", () => {
    // 100 を 2:1 → 66.66.. と 33.33..。余りの大きい 1 人目に 1 を足す
    expect(splitByWeight(100, [20, 10])).toEqual([67, 33]);
  });

  it("重みが全員同じなら均等割りと同じ結果になる", () => {
    for (const amount of [1000, 1001, 1002, 7, 1]) {
      expect(splitByWeight(amount, [10, 10, 10])).toEqual(splitEqually(amount, 3));
    }
  });

  it("金額 × 重みが安全な整数を超えても正しく分ける", () => {
    const amount = Number.MAX_SAFE_INTEGER - 1;
    const shares = splitByWeight(amount, [100, 100]);
    expect(shares).toEqual([amount / 2, amount / 2]);
  });

  it("対象がいなければ空", () => {
    expect(splitByWeight(1000, [])).toEqual([]);
  });
});

describe("calculateSettlement", () => {
  const members = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];

  it("傾斜をつけた立替は、重みの比で負担する", () => {
    const result = calculateSettlement(members, [
      {
        id: "e1",
        payerId: "a",
        amount: 12000,
        participants: [
          { memberId: "a", weight: 20 },
          { memberId: "b", weight: 10 },
          { memberId: "c", weight: 10 },
        ],
      },
    ]);
    expect(result.balances.map((b) => b.owed)).toEqual([6000, 3000, 3000]);
    expect(result.transfers).toEqual([
      { fromId: "b", toId: "a", amount: 3000 },
      { fromId: "c", toId: "a", amount: 3000 },
    ]);
  });

  it("傾斜は立替ごとに効く", () => {
    const result = calculateSettlement(members, [
      {
        id: "e1",
        payerId: "a",
        amount: 3000,
        participants: [
          { memberId: "a", weight: 10 },
          { memberId: "b", weight: 10 },
          { memberId: "c", weight: 10 },
        ],
      },
      {
        id: "e2",
        payerId: "b",
        amount: 4000,
        participants: [
          { memberId: "b", weight: 30 },
          { memberId: "c", weight: 10 },
        ],
      },
    ]);
    expect(result.balances.map((b) => b.owed)).toEqual([1000, 4000, 2000]);
    expect(result.total).toBe(7000);
  });

  it("内訳として、立替ごとに各メンバーの負担額を返す", () => {
    const result = calculateSettlement(members, [
      {
        id: "e1",
        payerId: "a",
        amount: 1000,
        participants: [
          { memberId: "a", weight: 10 },
          { memberId: "b", weight: 10 },
          { memberId: "c", weight: 10 },
        ],
      },
      {
        id: "e2",
        payerId: "b",
        amount: 4000,
        participants: [
          { memberId: "b", weight: 30 },
          { memberId: "c", weight: 10 },
        ],
      },
    ]);
    expect(result.shares).toEqual([
      { expenseId: "e1", memberId: "a", amount: 334 },
      { expenseId: "e1", memberId: "b", amount: 333 },
      { expenseId: "e1", memberId: "c", amount: 333 },
      { expenseId: "e2", memberId: "b", amount: 3000 },
      { expenseId: "e2", memberId: "c", amount: 1000 },
    ]);
  });

  it("内訳の合計は各メンバーの負担額と一致する", () => {
    const result = calculateSettlement(members, [
      {
        id: "e1",
        payerId: "a",
        amount: 1001,
        participants: [
          { memberId: "a", weight: 15 },
          { memberId: "b", weight: 10 },
          { memberId: "c", weight: 5 },
        ],
      },
      {
        id: "e2",
        payerId: "c",
        amount: 777,
        participants: [
          { memberId: "a", weight: 10 },
          { memberId: "c", weight: 10 },
        ],
      },
    ]);
    for (const b of result.balances) {
      const sum = result.shares
        .filter((s) => s.memberId === b.memberId)
        .reduce((acc, s) => acc + s.amount, 0);
      expect(sum).toBe(b.owed);
    }
  });

  it("グループにいないメンバーは内訳に含めない", () => {
    const result = calculateSettlement(members, [
      {
        id: "e1",
        payerId: "a",
        amount: 2000,
        participants: [
          { memberId: "a", weight: 10 },
          { memberId: "x", weight: 10 },
        ],
      },
    ]);
    expect(result.shares).toEqual([
      { expenseId: "e1", memberId: "a", amount: 2000 },
    ]);
  });
});
