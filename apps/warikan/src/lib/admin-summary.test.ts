import { describe, expect, it } from "vitest";
import { formatDateTime, summarizeGroups } from "./admin-summary";

const at = (iso: string) => new Date(iso);

describe("summarizeGroups", () => {
  const groups = [
    {
      id: "a",
      name: "旅行",
      currency: "JPY",
      createdAt: at("2026-10-01T00:00:00Z"),
    },
    {
      id: "b",
      name: "飲み会",
      currency: "JPY",
      createdAt: at("2026-10-05T00:00:00Z"),
    },
  ];

  it("グループごとにメンバー数・立替件数・合計を出し、新しい順に並べる", () => {
    const rows = summarizeGroups(
      groups,
      [{ groupId: "a" }, { groupId: "a" }, { groupId: "b" }],
      [
        {
          groupId: "a",
          amount: 1000,
          currency: "JPY",
          createdAt: at("2026-10-02T00:00:00Z"),
        },
        {
          groupId: "a",
          amount: 500,
          currency: "JPY",
          createdAt: at("2026-10-03T00:00:00Z"),
        },
      ],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(rows[1]).toMatchObject({
      memberCount: 2,
      expenseCount: 2,
      total: 1500,
      unconvertedCount: 0,
      lastExpenseAt: at("2026-10-03T00:00:00Z"),
    });
    expect(rows[0]).toMatchObject({
      memberCount: 1,
      expenseCount: 0,
      total: 0,
      lastExpenseAt: null,
    });
  });

  it("外貨はそのグループのレートで換算し、レートが無いものは合計から外して数える", () => {
    const rows = summarizeGroups(
      [groups[0]],
      [],
      [
        // 10.00 USD × 150 = 1500 円
        {
          groupId: "a",
          amount: 1000,
          currency: "USD",
          createdAt: at("2026-10-02T00:00:00Z"),
        },
        {
          groupId: "a",
          amount: 500,
          currency: "EUR",
          createdAt: at("2026-10-02T00:00:00Z"),
        },
      ],
      [
        { groupId: "a", currency: "USD", rate: "150" },
        { groupId: "a", currency: "EUR", rate: null },
        // 別のグループのレートは使わない
        { groupId: "b", currency: "EUR", rate: "160" },
      ],
    );
    expect(rows[0]).toMatchObject({ total: 1500, unconvertedCount: 1 });
  });
});

describe("formatDateTime", () => {
  it("日本時間で表示する", () => {
    expect(formatDateTime(at("2026-10-18T09:07:54Z"))).toBe("2026/10/18 18:07");
  });
});
