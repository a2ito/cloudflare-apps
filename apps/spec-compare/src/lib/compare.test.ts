import { describe, expect, it } from "vitest";
import {
  bestValues,
  compare,
  costPer,
  formatSpec,
  isCostField,
  makerChips,
  matches,
  parseCompareQuery,
  pickBest,
  quickFilterChips,
  rankIn,
  hasScore,
  scoreItems,
  scoreRanks,
  sortItems,
  type CompareItem,
  type CompareQuery,
  type FieldDef,
} from "./compare";

const CPU: FieldDef = {
  id: 1,
  name: "CPU",
  unit: null,
  kind: "text",
  better: "none",
};
const MEMORY: FieldDef = {
  id: 2,
  name: "メモリ",
  unit: "GB",
  kind: "number",
  better: "higher",
};
const WEIGHT: FieldDef = {
  id: 3,
  name: "重量",
  unit: "kg",
  kind: "number",
  better: "lower",
};
const TOUCH: FieldDef = {
  id: 4,
  name: "タッチ",
  unit: null,
  kind: "bool",
  better: "higher",
};
const FIELDS = [CPU, MEMORY, WEIGHT, TOUCH];

function item(
  id: number,
  price: number | null,
  specs: Partial<Record<number, number | string>> = {},
): CompareItem {
  return {
    id,
    name: `PC${id}`,
    maker: null,
    imageKey: null,
    specs: Object.fromEntries(
      Object.entries(specs).map(([k, v]) => [
        Number(k),
        typeof v === "string"
          ? { num: null, text: v }
          : { num: v ?? null, text: null },
      ]),
    ),
    best:
      price === null
        ? null
        : {
            id: id * 10,
            store: "店",
            price,
            used: false,
            recordedAt: "2026-10-12",
            url: null,
          },
    hidden: false,
    favorite: false,
  };
}

const baseQuery: CompareQuery = {
  sort: "price",
  dir: "asc",
  ranges: [],
  required: [],
  contains: [],
  includeUsed: true,
  showHidden: false,
  favoritesOnly: false,
  textIn: [],
  numIn: [],
  makers: [],
};

describe("pickBest", () => {
  it("一番安い記録を選び、同額なら新しい記録を選ぶ", () => {
    const records = [
      { id: 1, price: 1000, used: false, recordedAt: "2026-10-01" },
      { id: 2, price: 900, used: false, recordedAt: "2026-09-01" },
      { id: 3, price: 900, used: false, recordedAt: "2026-10-05" },
    ];
    expect(pickBest(records)?.id).toBe(3);
  });
  it("同額・同日なら後から記録したものを選ぶ", () => {
    expect(
      pickBest([
        { id: 5, price: 900, used: false, recordedAt: "2026-10-05" },
        { id: 4, price: 900, used: false, recordedAt: "2026-10-05" },
      ])?.id,
    ).toBe(5);
  });
  it("記録が無ければ null", () => {
    expect(pickBest([])).toBeNull();
  });
  it("新品があれば新品だけから選び、中古は includeUsed のときに候補にする", () => {
    const records = [
      { id: 1, price: 1000, used: false, recordedAt: "2026-10-01" },
      { id: 2, price: 600, used: true, recordedAt: "2026-10-01" },
    ];
    expect(pickBest(records)?.id).toBe(1);
    expect(pickBest(records, true)?.id).toBe(2);
  });
  it("新品の記録が無ければ中古から選ぶ", () => {
    const records = [
      { id: 3, price: 600, used: true, recordedAt: "2026-10-01" },
      { id: 4, price: 500, used: true, recordedAt: "2026-10-01" },
    ];
    expect(pickBest(records)?.id).toBe(4);
  });
});

describe("costPer", () => {
  it("価格 ÷ 値", () => {
    expect(costPer(160000, 16)).toBe(10000);
  });
  it("値が無い・0 以下なら出さない", () => {
    expect(costPer(1000, null)).toBeNull();
    expect(costPer(1000, 0)).toBeNull();
    expect(costPer(null, 16)).toBeNull();
  });
});

describe("isCostField", () => {
  it("大きいほど良い数値だけ", () => {
    expect(isCostField(MEMORY)).toBe(true);
    expect(isCostField(WEIGHT)).toBe(false);
    expect(isCostField(CPU)).toBe(false);
    expect(isCostField(TOUCH)).toBe(false);
  });
});

describe("parseCompareQuery", () => {
  it("既定は価格の安い順", () => {
    expect(parseCompareQuery({}, FIELDS)).toEqual({
      ...baseQuery,
      maxPrice: undefined,
      costFieldId: undefined,
    });
  });

  it("項目ごとの条件を型に合わせて読む", () => {
    const q = parseCompareQuery(
      {
        sort: "f2",
        dir: "desc",
        min_2: "16",
        max_3: "1.5",
        has_4: "1",
        q_1: " ryzen ",
        maxPrice: "200000",
        cost: "2",
      },
      FIELDS,
    );
    expect(q).toEqual({
      sort: "f2",
      dir: "desc",
      ranges: [
        { fieldId: 2, min: 16, max: undefined },
        { fieldId: 3, min: undefined, max: 1.5 },
      ],
      required: [4],
      contains: [{ fieldId: 1, text: "ryzen" }],
      maxPrice: 200000,
      costFieldId: 2,
      includeUsed: true,
      showHidden: false,
      favoritesOnly: false,
      textIn: [],
      numIn: [],
      makers: [],
    });
  });

  it("存在しない項目・型の合わない指定は捨てる", () => {
    const q = parseCompareQuery(
      {
        sort: "f99",
        min_99: "1",
        min_1: "3",
        q_2: "x",
        has_2: "1",
        min_2: "abc",
        cost: "3",
      },
      FIELDS,
    );
    expect(q.sort).toBe("price");
    expect(q.ranges).toEqual([]);
    expect(q.contains).toEqual([]);
    expect(q.required).toEqual([]);
    // 重量は小さいほど良いので、価格 ÷ 重量はコスパにならない
    expect(q.costFieldId).toBeUndefined();
  });

  it("中古は既定で含め、used=0 のときだけ外す", () => {
    expect(parseCompareQuery({}, FIELDS).includeUsed).toBe(true);
    expect(parseCompareQuery({ used: "1" }, FIELDS).includeUsed).toBe(true);
    expect(parseCompareQuery({ used: "0" }, FIELDS).includeUsed).toBe(false);
    // フォームの hidden（0）とチェックボックス（1）が両方届いたらチェックが入っている
    expect(parseCompareQuery({ used: ["0", "1"] }, FIELDS).includeUsed).toBe(
      true,
    );
  });

  it("cost が無ければ既定のコスパ項目を使い、空なら出さない", () => {
    expect(parseCompareQuery({}, FIELDS, 2).costFieldId).toBe(2);
    expect(
      parseCompareQuery({ cost: "" }, FIELDS, 2).costFieldId,
    ).toBeUndefined();
    expect(parseCompareQuery({ sort: "cost" }, FIELDS, 2).sort).toBe("cost");
    // 既定の項目が消えたり、小さいほど良い項目になっていたりしたら出さない
    expect(parseCompareQuery({}, FIELDS, 99).costFieldId).toBeUndefined();
    expect(parseCompareQuery({}, FIELDS, 3).costFieldId).toBeUndefined();
  });

  it("コスパの項目が無いのにコスパ順を指定されたら価格順にする", () => {
    expect(parseCompareQuery({ sort: "cost" }, FIELDS).sort).toBe("price");
    expect(parseCompareQuery({ sort: "cost", cost: "2" }, FIELDS).sort).toBe(
      "cost",
    );
  });
});

describe("makerChips", () => {
  const makers = [
    { ...item(1, 1), maker: "Lenovo" },
    { ...item(2, 1), maker: "Apple" },
    { ...item(3, 1), maker: "Lenovo" },
    { ...item(4, 1), maker: "ASUS", hidden: true },
  ];
  it("表示している商品のメーカーを並べ、押すと足し、押し直すと外す", () => {
    expect(
      makerChips(makers, baseQuery).map((c) => [c.label, c.params.maker]),
    ).toEqual([
      ["Apple", ["Apple"]],
      ["Lenovo", ["Lenovo"]],
    ]);
    const picked = makerChips(makers, { ...baseQuery, makers: ["lenovo"] });
    expect(picked.map((c) => [c.label, c.active, c.params.maker])).toEqual([
      ["Apple", false, ["lenovo", "Apple"]],
      ["Lenovo", true, undefined],
    ]);
  });
});

describe("quickFilterChips", () => {
  const items = [
    item(1, 1, { 1: "Windows", 2: 16, 3: 1.2, 4: 1 }),
    item(2, 1, { 1: "macOS", 2: 32, 3: 1.6 }),
    item(3, 1, { 1: "Windows", 2: 64, 3: 1.2 }),
  ];
  const SIZE: FieldDef = {
    id: 5,
    name: "画面",
    unit: "インチ",
    kind: "number",
    better: "none",
  };
  const sized = [item(1, 1, { 5: 14 }), item(2, 1, { 5: 16 })];

  it("テキストは値ごとに複数選べる。押し直すと外れる", () => {
    expect(
      quickFilterChips(items, CPU, baseQuery).map((c) => [
        c.label,
        c.params.in_1,
      ]),
    ).toEqual([
      ["macOS", ["macOS"]],
      ["Windows", ["Windows"]],
    ]);
    const one = quickFilterChips(items, CPU, {
      ...baseQuery,
      textIn: [{ fieldId: 1, values: ["windows"] }],
    });
    expect(one.find((c) => c.label === "Windows")).toMatchObject({
      active: true,
      params: { in_1: undefined },
    });
    expect(one.find((c) => c.label === "macOS")).toMatchObject({
      active: false,
      params: { in_1: ["windows", "macOS"] },
    });
    const both = quickFilterChips(items, CPU, {
      ...baseQuery,
      textIn: [{ fieldId: 1, values: ["Windows", "macOS"] }],
    });
    expect(both.find((c) => c.label === "Windows")).toMatchObject({
      active: true,
      params: { in_1: ["macOS"] },
    });
  });

  it("大きいほど良い数値は以上、小さいほど良い数値は以下。全部が通る値は出さない", () => {
    expect(
      quickFilterChips(items, MEMORY, baseQuery).map((c) => c.label),
    ).toEqual(["32 GB 以上", "64 GB 以上"]);
    expect(quickFilterChips(items, MEMORY, baseQuery)[0].params).toEqual({
      min_2: "32",
      max_2: undefined,
    });
    expect(
      quickFilterChips(items, WEIGHT, baseQuery).map((c) => c.label),
    ).toEqual(["1.2 kg 以下"]);
  });

  it("比べない数値はその値ちょうどで、複数選べる", () => {
    expect(
      quickFilterChips(sized, SIZE, baseQuery).map((c) => [
        c.label,
        c.params.in_5,
      ]),
    ).toEqual([
      ["14 インチ", ["14"]],
      ["16 インチ", ["16"]],
    ]);
    const picked = quickFilterChips(sized, SIZE, {
      ...baseQuery,
      numIn: [{ fieldId: 5, values: [14] }],
    });
    expect(picked.map((c) => [c.active, c.params.in_5])).toEqual([
      [true, undefined],
      [false, ["14", "16"]],
    ]);
  });

  it("非表示の商品の値は使わない", () => {
    const withHidden = [
      ...items,
      { ...item(4, 1, { 1: "ChromeOS" }), hidden: true },
    ];
    expect(
      quickFilterChips(withHidden, CPU, baseQuery).map((c) => c.label),
    ).not.toContain("ChromeOS");
  });
});

describe("matches", () => {
  const pc = item(1, 150000, { 1: "Ryzen 7", 2: 16, 3: 1.2, 4: 1 });

  it("簡易フィルタの複数選択は、同じ項目内はどれか・項目どうしは両方", () => {
    const q = parseCompareQuery(
      { in_1: ["ryzen 7", "Core i7"], in_2: ["8", "16"] },
      FIELDS,
    );
    expect(q.textIn).toEqual([{ fieldId: 1, values: ["ryzen 7", "Core i7"] }]);
    expect(q.numIn).toEqual([{ fieldId: 2, values: [8, 16] }]);
    expect(matches(pc, q)).toBe(true);
    expect(
      matches(pc, parseCompareQuery({ in_1: "Core i7", in_2: "16" }, FIELDS)),
    ).toBe(false);
    expect(
      matches(pc, parseCompareQuery({ in_1: "Ryzen 7", in_2: "32" }, FIELDS)),
    ).toBe(false);
    expect(matches(item(2, 1), parseCompareQuery({ in_2: "16" }, FIELDS))).toBe(
      false,
    );
  });

  it("範囲は境界を含む", () => {
    expect(
      matches(pc, { ...baseQuery, ranges: [{ fieldId: 2, min: 16, max: 16 }] }),
    ).toBe(true);
    expect(
      matches(pc, { ...baseQuery, ranges: [{ fieldId: 2, min: 32 }] }),
    ).toBe(false);
  });
  it("条件のある項目が未入力なら外す", () => {
    expect(
      matches(item(2, 100000), {
        ...baseQuery,
        ranges: [{ fieldId: 2, min: 8 }],
      }),
    ).toBe(false);
    expect(matches(item(2, 100000), { ...baseQuery, required: [4] })).toBe(
      false,
    );
  });
  it("非表示の商品は showHidden のときだけ出す", () => {
    const hidden = { ...pc, hidden: true };
    expect(matches(hidden, baseQuery)).toBe(false);
    expect(matches(hidden, { ...baseQuery, showHidden: true })).toBe(true);
    expect(parseCompareQuery({ hidden: "1" }, FIELDS).showHidden).toBe(true);
  });

  it("メーカーは複数選べ、どれかに一致すれば通す。メーカー未入力は外す", () => {
    const q = parseCompareQuery({ maker: ["lenovo", "Apple"] }, FIELDS);
    expect(q.makers).toEqual(["lenovo", "Apple"]);
    expect(matches({ ...pc, maker: "Lenovo" }, q)).toBe(true);
    expect(matches({ ...pc, maker: "ASUS" }, q)).toBe(false);
    expect(matches({ ...pc, maker: null }, q)).toBe(false);
    expect(matches({ ...pc, maker: null }, baseQuery)).toBe(true);
  });

  it("favoritesOnly のときはお気に入りだけ出す", () => {
    const fav = { ...pc, favorite: true };
    expect(matches(pc, { ...baseQuery, favoritesOnly: true })).toBe(false);
    expect(matches(fav, { ...baseQuery, favoritesOnly: true })).toBe(true);
    expect(matches(pc, baseQuery)).toBe(true);
    expect(parseCompareQuery({ fav: "1" }, FIELDS).favoritesOnly).toBe(true);
  });
  it("bool は「あり」だけ通す", () => {
    expect(matches(pc, { ...baseQuery, required: [4] })).toBe(true);
    expect(matches(item(2, 1, { 4: 0 }), { ...baseQuery, required: [4] })).toBe(
      false,
    );
  });
  it("テキストは大文字小文字を区別せず部分一致", () => {
    expect(
      matches(pc, { ...baseQuery, contains: [{ fieldId: 1, text: "ryzen" }] }),
    ).toBe(true);
    expect(
      matches(pc, { ...baseQuery, contains: [{ fieldId: 1, text: "core" }] }),
    ).toBe(false);
  });
  it("価格の上限。価格が無い商品は外す", () => {
    expect(matches(pc, { ...baseQuery, maxPrice: 150000 })).toBe(true);
    expect(matches(pc, { ...baseQuery, maxPrice: 149999 })).toBe(false);
    expect(matches(item(2, null), { ...baseQuery, maxPrice: 999999 })).toBe(
      false,
    );
  });
});

describe("sortItems", () => {
  const items = [
    item(1, 120000, { 2: 8 }),
    item(2, null, { 2: 32 }),
    item(3, 90000),
    item(4, 150000, { 2: 16 }),
  ];

  it("値の無い商品は昇順でも降順でも末尾", () => {
    expect(sortItems(items, baseQuery).map((i) => i.id)).toEqual([3, 1, 4, 2]);
    expect(
      sortItems(items, { ...baseQuery, dir: "desc" }).map((i) => i.id),
    ).toEqual([4, 1, 3, 2]);
  });
  it("スペック項目で並べる", () => {
    expect(
      sortItems(items, { ...baseQuery, sort: "f2", dir: "desc" }).map(
        (i) => i.id,
      ),
    ).toEqual([2, 4, 1, 3]);
  });
  it("コスパ（価格 ÷ 値）の安い順", () => {
    // 120000/8=15000, 150000/16=9375。価格の無い 2 と値の無い 3 は末尾（id 順）
    expect(
      sortItems(items, { ...baseQuery, sort: "cost", costFieldId: 2 }).map(
        (i) => i.id,
      ),
    ).toEqual([4, 1, 2, 3]);
  });
  it("名前は日本語の辞書順", () => {
    const named = [
      { ...item(1, 1), name: "いろは" },
      { ...item(2, 1), name: "あいう" },
    ];
    expect(
      sortItems(named, { ...baseQuery, sort: "name" }).map((i) => i.id),
    ).toEqual([2, 1]);
  });
});

describe("bestValues", () => {
  it("良し悪しの向きに沿って一番良い値を選ぶ", () => {
    const items = [
      item(1, 120000, { 2: 8, 3: 1.5, 4: 0 }),
      item(2, 100000, { 2: 16, 3: 1.2, 4: 1 }),
    ];
    const best = bestValues(items, FIELDS, 2);
    expect(best.get("price")).toBe(100000);
    expect(best.get(2)).toBe(16);
    expect(best.get(3)).toBe(1.2);
    expect(best.get(4)).toBe(1);
    expect(best.get("cost")).toBe(6250);
    expect(best.has(1)).toBe(false);
  });
  it("比べる相手がいない列・全部同じ値の列は選ばない", () => {
    const best = bestValues(
      [item(1, 100000, { 2: 16 }), item(2, 100000)],
      FIELDS,
    );
    expect(best.has("price")).toBe(false);
    expect(best.has(2)).toBe(false);
  });
});

describe("rankIn", () => {
  const items = [
    item(1, 1, { 2: 16, 3: 1.2 }),
    item(2, 1, { 2: 32, 3: 1.2 }),
    item(3, 1, { 2: 16, 3: 1.0 }),
    item(4, 1),
  ];
  it("同じ値は同じ順位", () => {
    expect(rankIn(items, MEMORY, 2)).toEqual({ rank: 1, total: 3 });
    expect(rankIn(items, MEMORY, 1)).toEqual({ rank: 2, total: 3 });
    expect(rankIn(items, MEMORY, 3)).toEqual({ rank: 2, total: 3 });
    expect(rankIn(items, WEIGHT, 1)).toEqual({ rank: 2, total: 3 });
  });
  it("比べない項目・値の無い商品は null", () => {
    expect(rankIn(items, CPU, 1)).toBeNull();
    expect(rankIn(items, MEMORY, 4)).toBeNull();
  });
});

describe("compare", () => {
  it("絞り込んだ行の中で最良値を決める", () => {
    const items = [
      item(1, 100000, { 2: 8 }),
      item(2, 120000, { 2: 16 }),
      item(3, 200000, { 2: 32 }),
    ];
    const { rows, best } = compare(items, FIELDS, {
      ...baseQuery,
      maxPrice: 150000,
    });
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(best.get(2)).toBe(16);
  });
});

describe("hasScore", () => {
  it("重みのある比べられる項目か価格があれば出す", () => {
    expect(hasScore(FIELDS, { price: 0, fields: {} })).toBe(false);
    expect(hasScore(FIELDS, { price: 1, fields: {} })).toBe(true);
    expect(hasScore(FIELDS, { price: 0, fields: { 2: 1 } })).toBe(true);
  });
  it("比べない項目に重みがあっても出さない", () => {
    expect(hasScore(FIELDS, { price: 0, fields: { 1: 3 } })).toBe(false);
  });
});

describe("scoreItems", () => {
  it("基準ごとに一番良い値を 1、一番悪い値を 0 にして重み付きで平均する", () => {
    const items = [
      item(1, 100000, { 2: 8, 3: 1.0 }),
      item(2, 200000, { 2: 32, 3: 2.0 }),
      item(3, 150000, { 2: 16, 3: 1.5 }),
    ];
    const scores = scoreItems(items, FIELDS, {
      price: 1,
      fields: { 2: 2, 3: 1 },
    });
    // 1: 価格 1・メモリ 0・重量 1 → (1 + 0 + 1) / 4
    expect(scores.get(1)).toBeCloseTo(50);
    // 2: 価格 0・メモリ 1・重量 0 → (0 + 2 + 0) / 4
    expect(scores.get(2)).toBeCloseTo(50);
    // 3: 価格 0.5・メモリ 1/3・重量 0.5 → (0.5 + 2/3 + 0.5) / 4
    expect(scores.get(3)).toBeCloseTo(41.67, 1);
  });
  it("あり / なしは あり = 1 として比べる", () => {
    const scores = scoreItems(
      [item(1, 1, { 4: 1 }), item(2, 1, { 4: 0 })],
      FIELDS,
      {
        price: 0,
        fields: { 4: 1 },
      },
    );
    expect(scores.get(1)).toBe(100);
    expect(scores.get(2)).toBe(0);
  });
  it("値の無い基準は 0 として数える", () => {
    const scores = scoreItems(
      [item(1, null, { 2: 8 }), item(2, 100, { 2: 16 })],
      FIELDS,
      {
        price: 1,
        fields: { 2: 1 },
      },
    );
    expect(scores.get(1)).toBe(0);
    expect(scores.get(2)).toBe(100);
  });
  it("全員が同じ値の基準は値のある商品を 1 にする", () => {
    const scores = scoreItems(
      [item(1, 100), item(2, 100), item(3, null)],
      FIELDS,
      {
        price: 1,
        fields: {},
      },
    );
    expect([...scores.values()]).toEqual([100, 100, 0]);
  });
  it("重みが無ければ空", () => {
    expect(
      scoreItems([item(1, 1)], FIELDS, { price: 0, fields: {} }).size,
    ).toBe(0);
  });
});

describe("scoreRanks", () => {
  it("同じスコアは同じ順位", () => {
    const ranks = scoreRanks(
      new Map([
        [1, 50],
        [2, 80],
        [3, 50],
        [4, 10],
      ]),
    );
    expect(Object.fromEntries(ranks)).toEqual({ 1: 2, 2: 1, 3: 2, 4: 4 });
  });
});

describe("総合スコアでの並べ替え", () => {
  const items = [
    item(1, 100, { 2: 8 }),
    item(2, 300, { 2: 32 }),
    item(3, 200, { 2: 16 }),
  ];
  const weights = { price: 1, fields: { 2: 3 } };

  it("スコアを出すカテゴリは既定でスコアの高い順", () => {
    const query = parseCompareQuery({}, FIELDS, null, true);
    expect(query.sort).toBe("score");
    expect(query.dir).toBe("desc");
    const { rows, ranks, best } = compare(items, FIELDS, query, weights);
    // 1: 1/4=25, 2: 3/4=75, 3: (0.5 + 3 * 1/3)/4=37.5
    expect(rows.map((r) => r.id)).toEqual([2, 3, 1]);
    expect(ranks?.get(2)).toBe(1);
    expect(best.get("score")).toBeCloseTo(75);
  });
  it("スコアを出さないカテゴリでは sort=score を無視する", () => {
    expect(parseCompareQuery({ sort: "score" }, FIELDS).sort).toBe("price");
  });
  it("向きを指定すればスコアの低い順にもできる", () => {
    const query = parseCompareQuery(
      { sort: "score", dir: "asc" },
      FIELDS,
      null,
      true,
    );
    expect(
      compare(items, FIELDS, query, weights).rows.map((r) => r.id),
    ).toEqual([1, 3, 2]);
  });
  it("重みが無ければスコアも順位も出さない", () => {
    const { scores, ranks } = compare(items, FIELDS, baseQuery, {
      price: 0,
      fields: {},
    });
    expect(scores).toBeUndefined();
    expect(ranks).toBeUndefined();
  });
});

describe("formatSpec", () => {
  it("型ごとに表示を変える", () => {
    expect(formatSpec(MEMORY, { num: 1024, text: null })).toBe("1,024 GB");
    expect(
      formatSpec({ kind: "number", unit: null }, { num: 1.25, text: null }),
    ).toBe("1.25");
    expect(formatSpec(TOUCH, { num: 1, text: null })).toBe("あり");
    expect(formatSpec(TOUCH, { num: 0, text: null })).toBe("なし");
    expect(formatSpec(CPU, { num: null, text: "M4" })).toBe("M4");
    expect(formatSpec(MEMORY, undefined)).toBeNull();
  });
});
