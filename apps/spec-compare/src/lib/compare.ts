import type { Better, FieldKind, PriceRecord } from "@/db/schema";

/** 比較に使うスペック項目の情報 */
export type FieldDef = {
  id: number;
  name: string;
  unit: string | null;
  kind: FieldKind;
  better: Better;
};

/** 1 つのスペック値。number / bool は num、text は text に入る */
export type SpecCell = { num: number | null; text: string | null };

export type BestPrice = Pick<
  PriceRecord,
  "id" | "store" | "price" | "used" | "recordedAt" | "url"
>;

export type CompareItem = {
  id: number;
  name: string;
  maker: string | null;
  imageKey: string | null;
  /** fieldId → 値。未入力の項目はキーを持たない */
  specs: Record<number, SpecCell>;
  best: BestPrice | null;
  /** 候補から外して比較表に出さない商品 */
  hidden: boolean;
  /** 売り切れて比較表に出さない商品 */
  soldOut: boolean;
  favorite: boolean;
  /** 商品を登録した日（日本時間の YYYY-MM-DD） */
  createdAt: string;
};

/** 並べ替えの軸。f<id> はスペック項目、score は総合スコア、created は登録日 */
export type SortKey =
  "price" | "name" | "cost" | "score" | "created" | `f${number}`;
export type SortDir = "asc" | "desc";

export type RangeFilter = { fieldId: number; min?: number; max?: number };

export type CompareQuery = {
  sort: SortKey;
  dir: SortDir;
  /** 数値項目の範囲。境界を含む */
  ranges: RangeFilter[];
  /** 「あり」でなければ外す bool 項目 */
  required: number[];
  /** テキスト項目の部分一致（大文字小文字を区別しない） */
  contains: { fieldId: number; text: string }[];
  /** 簡易フィルタで選んだテキストの値。どれかに一致すれば通す（大文字小文字を区別しない） */
  textIn: { fieldId: number; values: string[] }[];
  /** 簡易フィルタで選んだ数値。どれかにちょうど一致すれば通す */
  numIn: { fieldId: number; values: number[] }[];
  /** 簡易フィルタで選んだメーカー。どれかに一致すれば通す（大文字小文字を区別しない） */
  makers: string[];
  maxPrice?: number;
  /** コスパ（価格 ÷ 値）を出す数値項目 */
  costFieldId?: number;
  /** 中古の価格も最安値の候補にするか */
  includeUsed: boolean;
  /** 非表示にした商品も出すか */
  showHidden: boolean;
  /** 売り切れの商品も出すか */
  showSoldOut: boolean;
  favoritesOnly: boolean;
};

type PriceCandidate = Pick<PriceRecord, "id" | "price" | "used" | "recordedAt">;

/**
 * 価格の記録から最安値を選ぶ。同額なら新しい記録を優先する。
 * 中古は状態が新品と違い同じ物の値段として比べられないので、新品の記録があれば新品だけから選ぶ。
 * 新品の記録が無ければ（もう新品が売っていない機種など）中古から選ぶ。includeUsed なら新品と中古をまとめて比べる
 */
export function pickBest<T extends PriceCandidate>(
  records: readonly T[],
  includeUsed = false,
): T | null {
  if (includeUsed) return cheapest(records);
  return cheapest(records.filter((r) => !r.used)) ?? cheapest(records);
}

function cheapest<T extends PriceCandidate>(records: readonly T[]): T | null {
  let best: T | null = null;
  for (const r of records) {
    if (
      best === null ||
      r.price < best.price ||
      (r.price === best.price &&
        (r.recordedAt > best.recordedAt ||
          (r.recordedAt === best.recordedAt && r.id > best.id)))
    ) {
      best = r;
    }
  }
  return best;
}

/** 大小を比べる項目か。text と、良し悪しの無い項目は比べない */
export function isRankable(field: Pick<FieldDef, "kind" | "better">): boolean {
  return field.kind !== "text" && field.better !== "none";
}

/** コスパを出せる項目か。「価格 ÷ 値」が意味を持つのは、大きいほど良い数値だけ */
export function isCostField(field: Pick<FieldDef, "kind" | "better">): boolean {
  return field.kind === "number" && field.better === "higher";
}

/** 1 単位あたりの価格。値が無い・0 以下なら出せない */
export function costPer(
  price: number | null | undefined,
  value: number | null | undefined,
): number | null {
  if (
    price === null ||
    price === undefined ||
    value === null ||
    value === undefined ||
    value <= 0
  )
    return null;
  return price / value;
}

/**
 * 総合スコアの重み。fields のキーは項目 id。
 * 重みは比較表の条件（URL）ではなくカテゴリの設定なので、CompareQuery とは分けて持つ
 */
export type ScoreWeights = { price: number; fields: Record<number, number> };

/** スコアに入れる基準。値を取り出す関数と、どちらが良いかを持つ */
type ScoreCriterion = {
  weight: number;
  better: "higher" | "lower";
  value: (item: CompareItem) => number | null | undefined;
};

function scoreCriteria(
  fields: readonly FieldDef[],
  weights: ScoreWeights,
): ScoreCriterion[] {
  const criteria: ScoreCriterion[] = [];
  if (weights.price > 0)
    criteria.push({
      weight: weights.price,
      better: "lower",
      value: (i) => i.best?.price,
    });
  for (const field of fields) {
    const weight = weights.fields[field.id] ?? 0;
    // isRankable と同じ条件。better を絞り込むため直接書く
    if (weight <= 0 || field.kind === "text" || field.better === "none")
      continue;
    criteria.push({
      weight,
      better: field.better,
      value: (i) => i.specs[field.id]?.num,
    });
  }
  return criteria;
}

/** 総合スコアを出せるか。重みのある比べられる項目か価格が 1 つでもあれば出す */
export function hasScore(
  fields: readonly FieldDef[],
  weights: ScoreWeights,
): boolean {
  return scoreCriteria(fields, weights).length > 0;
}

/**
 * 総合スコア（0〜100）。基準ごとに、並べた商品の中で一番良い値を 1、一番悪い値を 0 にして重み付きで平均する。
 * 単位の違う項目（GB と kg など）をそのまま足せないので、商品どうしの相対的な位置に直している。
 * そのため絞り込みで並べる商品が変わるとスコアも変わる。
 * 値の無い基準は 0 として数える。分からない項目が多い商品を上に出さないため。
 * 全員が同じ値の基準は差が付かないので、値のある商品をすべて 1 にする
 */
export function scoreItems(
  items: readonly CompareItem[],
  fields: readonly FieldDef[],
  weights: ScoreWeights,
): Map<number, number> {
  const criteria = scoreCriteria(fields, weights);
  const scores = new Map<number, number>();
  if (criteria.length === 0) return scores;
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const normalizers = criteria.map((c) => {
    const present = items
      .map(c.value)
      .filter((v): v is number => v !== null && v !== undefined);
    const min = Math.min(...present);
    const max = Math.max(...present);
    return (v: number) =>
      max === min
        ? 1
        : c.better === "higher"
          ? (v - min) / (max - min)
          : (max - v) / (max - min);
  });

  for (const item of items) {
    const sum = criteria.reduce((acc, c, k) => {
      const v = c.value(item);
      return v === null || v === undefined
        ? acc
        : acc + c.weight * normalizers[k](v);
    }, 0);
    scores.set(item.id, (sum / totalWeight) * 100);
  }
  return scores;
}

/** スコアの高い順の順位。同じスコアは同じ順位にする（1, 1, 3 位） */
export function scoreRanks(
  scores: ReadonlyMap<number, number>,
): Map<number, number> {
  const values = [...scores.values()];
  return new Map(
    [...scores].map(([id, score]) => [
      id,
      values.filter((v) => v > score).length + 1,
    ]),
  );
}

function numberParam(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function stringParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s === "" ? undefined : s;
}

/** 同じ名前で複数並ぶパラメータ（in_<id>=a&in_<id>=b）を、空でない値の配列にする */
function listParam(value: string | string[] | undefined): string[] {
  const list = typeof value === "string" ? [value] : (value ?? []);
  return [...new Set(list.map((v) => v.trim()).filter((v) => v !== ""))];
}

type Params = Record<string, string | string[] | undefined>;

/**
 * 中古も含めるか。既定は含める（中古で買う候補も最安値で並べたいため）。
 * 外すときは ?used=0。フォームはチェックボックスの前に used=0 の hidden を置くので、
 * チェックすると used=0&used=1 が届く。1 が 1 つでもあれば含める。
 * 最安値は項目の定義より先に決めるので、parseCompareQuery とは別に読めるようにしている
 */
export function parseIncludeUsed(params: Params): boolean {
  const used = params.used;
  if (used === undefined) return true;
  return [used].flat().includes("1");
}

/**
 * URL の検索パラメータを比較条件に直す。
 * 項目ごとのパラメータ名は min_<id> / max_<id> / has_<id> / q_<id>、簡易フィルタの複数選択は in_<id>（複数並べる）。
 * 存在しない項目や型の合わない指定は黙って捨てる（項目を消したあとの古いリンクでも開けるように）。
 * cost が無ければカテゴリの既定のコスパ項目を使う。フォームで「出さない」を選ぶと cost が空で届くので、そのときは出さない。
 * 総合スコアを出すカテゴリ（scoreEnabled）は、sort が無ければスコアの高い順（ランキング）で開く
 */
export function parseCompareQuery(
  params: Params,
  fields: readonly FieldDef[],
  defaultCostFieldId?: number | null,
  scoreEnabled = false,
): CompareQuery {
  const byId = new Map(fields.map((f) => [f.id, f]));

  const rawSort = stringParam(params.sort);
  const costFieldId =
    params.cost === undefined
      ? (defaultCostFieldId ?? undefined)
      : numberParam(params.cost);
  const costField =
    costFieldId !== undefined ? byId.get(costFieldId) : undefined;
  const validCost =
    costField && isCostField(costField) ? costField.id : undefined;

  let sort: SortKey = scoreEnabled ? "score" : "price";
  if (rawSort === "name" || rawSort === "price" || rawSort === "created")
    sort = rawSort;
  else if (rawSort === "cost" && validCost !== undefined) sort = "cost";
  else if (rawSort === "score" && scoreEnabled) sort = "score";
  else if (rawSort?.startsWith("f")) {
    const field = byId.get(Number(rawSort.slice(1)));
    if (field) sort = `f${field.id}`;
  }
  // スコアは高いほど良いので、向きの指定が無ければ高い順にする
  const dir: SortDir =
    params.dir === "desc" || params.dir === "asc"
      ? params.dir
      : sort === "score"
        ? "desc"
        : "asc";

  const ranges: RangeFilter[] = [];
  const required: number[] = [];
  const contains: CompareQuery["contains"] = [];
  const textIn: CompareQuery["textIn"] = [];
  const numIn: CompareQuery["numIn"] = [];
  for (const field of fields) {
    const picked = listParam(params[`in_${field.id}`]);
    if (field.kind === "number") {
      const nums = picked.map(Number).filter(Number.isFinite);
      if (nums.length > 0) numIn.push({ fieldId: field.id, values: nums });
      const min = numberParam(params[`min_${field.id}`]);
      const max = numberParam(params[`max_${field.id}`]);
      if (min !== undefined || max !== undefined)
        ranges.push({ fieldId: field.id, min, max });
    } else if (field.kind === "bool") {
      if (params[`has_${field.id}`] === "1") required.push(field.id);
    } else {
      const text = stringParam(params[`q_${field.id}`]);
      if (text !== undefined) contains.push({ fieldId: field.id, text });
      if (picked.length > 0) textIn.push({ fieldId: field.id, values: picked });
    }
  }

  return {
    sort,
    dir,
    ranges,
    required,
    contains,
    textIn,
    numIn,
    makers: listParam(params.maker),
    maxPrice: numberParam(params.maxPrice),
    costFieldId: validCost,
    includeUsed: parseIncludeUsed(params),
    showHidden: params.hidden === "1",
    showSoldOut: params.soldOut === "1",
    favoritesOnly: params.fav === "1",
  };
}

/** 非表示・売り切れで比較表から外れていないか */
function isListed(item: CompareItem, query: CompareQuery): boolean {
  return (
    (!item.hidden || query.showHidden) && (!item.soldOut || query.showSoldOut)
  );
}

/** 絞り込みの条件に合うか。条件のある項目が未入力なら外す */
export function matches(item: CompareItem, query: CompareQuery): boolean {
  if (!isListed(item, query)) return false;
  if (query.favoritesOnly && !item.favorite) return false;
  if (
    query.maxPrice !== undefined &&
    (item.best === null || item.best.price > query.maxPrice)
  )
    return false;
  for (const r of query.ranges) {
    const v = item.specs[r.fieldId]?.num;
    if (v === null || v === undefined) return false;
    if (r.min !== undefined && v < r.min) return false;
    if (r.max !== undefined && v > r.max) return false;
  }
  for (const id of query.required) {
    if (item.specs[id]?.num !== 1) return false;
  }
  for (const c of query.contains) {
    const v = item.specs[c.fieldId]?.text;
    if (!v || !v.toLowerCase().includes(c.text.toLowerCase())) return false;
  }
  for (const t of query.textIn) {
    const v = item.specs[t.fieldId]?.text?.toLowerCase();
    if (!v || !t.values.some((x) => x.toLowerCase() === v)) return false;
  }
  if (query.makers.length > 0) {
    const maker = item.maker?.toLowerCase();
    if (!maker || !query.makers.some((m) => m.toLowerCase() === maker))
      return false;
  }
  for (const n of query.numIn) {
    const v = item.specs[n.fieldId]?.num;
    if (v === null || v === undefined || !n.values.includes(v)) return false;
  }
  return true;
}

/** 並べ替えに使う値。null は値なしで、昇順・降順のどちらでも末尾に回す */
function sortValue(
  item: CompareItem,
  query: CompareQuery,
  scores: ReadonlyMap<number, number> | undefined,
): number | string | null {
  if (query.sort === "price") return item.best?.price ?? null;
  if (query.sort === "name") return item.name;
  if (query.sort === "created") return item.createdAt;
  if (query.sort === "score") return scores?.get(item.id) ?? null;
  if (query.sort === "cost") {
    return query.costFieldId === undefined
      ? null
      : costPer(item.best?.price, item.specs[query.costFieldId]?.num);
  }
  const cell = item.specs[Number(query.sort.slice(1))];
  if (!cell) return null;
  return cell.num ?? cell.text;
}

export function sortItems(
  items: readonly CompareItem[],
  query: CompareQuery,
  scores?: ReadonlyMap<number, number>,
): CompareItem[] {
  const sign = query.dir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const va = sortValue(a, query, scores);
    const vb = sortValue(b, query, scores);
    if (va === null && vb === null) return a.id - b.id;
    if (va === null) return 1;
    if (vb === null) return -1;
    const diff =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "ja");
    return diff !== 0 ? sign * diff : a.id - b.id;
  });
}

/** ハイライトの対象。price・cost はどちらも小さいほど良く、score は大きいほど良い */
export type HighlightKey = "price" | "cost" | "score" | number;

/**
 * 列ごとに一番良い値を求める。
 * 値のある商品が 2 つ未満、または全部同じ値の列はハイライトしない（勝ち負けが無いため）
 */
export function bestValues(
  items: readonly CompareItem[],
  fields: readonly FieldDef[],
  costFieldId?: number,
  scores?: ReadonlyMap<number, number>,
): Map<HighlightKey, number> {
  const result = new Map<HighlightKey, number>();
  const consider = (
    key: HighlightKey,
    values: (number | null | undefined)[],
    better: "higher" | "lower",
  ) => {
    const present = values.filter(
      (v): v is number => v !== null && v !== undefined,
    );
    if (present.length < 2) return;
    const min = Math.min(...present);
    const max = Math.max(...present);
    if (min === max) return;
    result.set(key, better === "higher" ? max : min);
  };

  consider(
    "price",
    items.map((i) => i.best?.price),
    "lower",
  );
  if (costFieldId !== undefined) {
    consider(
      "cost",
      items.map((i) => costPer(i.best?.price, i.specs[costFieldId]?.num)),
      "lower",
    );
  }
  if (scores !== undefined) {
    consider(
      "score",
      items.map((i) => scores.get(i.id)),
      "higher",
    );
  }
  for (const field of fields) {
    // isRankable と同じ条件。better を絞り込むため直接書く
    if (field.kind === "text" || field.better === "none") continue;
    consider(
      field.id,
      items.map((i) => i.specs[field.id]?.num),
      field.better,
    );
  }
  return result;
}

/**
 * カテゴリの中で何番目に良いか。同じ値は同じ順位にする（1, 1, 3 位）。
 * 比べない項目、値が無い、比べる相手がいないときは null
 */
export function rankIn(
  items: readonly CompareItem[],
  field: FieldDef,
  productId: number,
): { rank: number; total: number } | null {
  if (field.kind === "text" || field.better === "none") return null;
  const own = items.find((i) => i.id === productId)?.specs[field.id]?.num;
  if (own === null || own === undefined) return null;
  const values = items
    .map((i) => i.specs[field.id]?.num)
    .filter((v): v is number => v !== null && v !== undefined);
  if (values.length < 2) return null;
  const better = values.filter((v) =>
    field.better === "higher" ? v > own : v < own,
  ).length;
  return { rank: better + 1, total: values.length };
}

export type QuickChip = {
  label: string;
  params: Record<string, string | string[] | undefined>;
  active: boolean;
};

/** 選んだ値の一覧に value を足す・外したときの in_<id> の値。空になったらパラメータごと消す */
function toggled(
  selected: readonly string[],
  value: string,
  active: boolean,
): string[] | undefined {
  const next = active
    ? selected.filter((s) => s !== value)
    : [...selected, value];
  return next.length > 0 ? next : undefined;
}

/**
 * 簡易フィルタのチップ。値はそのカテゴリの（表示している）商品に入っているものから作る。
 * 大きいほど良い数値は「以上」、小さいほど良い数値は「以下」で、1 つだけ選べる（選び直すと入れ替わる）。
 * テキストと比べない数値はその値ちょうどで、複数選ぶと「どれか」に一致するものを残す。
 * params は URL の検索パラメータの差し替え分で、押し直すと外れるよう active なら消す値を返す
 */
export function quickFilterChips(
  items: readonly CompareItem[],
  field: FieldDef,
  query: CompareQuery,
): QuickChip[] {
  const visible = items.filter((i) => isListed(i, query));
  if (field.kind === "bool") {
    const active = query.required.includes(field.id);
    return [
      {
        label: `${field.name}あり`,
        params: { [`has_${field.id}`]: active ? undefined : "1" },
        active,
      },
    ];
  }
  if (field.kind === "text") {
    const selected =
      query.textIn.find((t) => t.fieldId === field.id)?.values ?? [];
    const values = [
      ...new Set(
        visible
          .map((i) => i.specs[field.id]?.text)
          .filter((v): v is string => !!v),
      ),
    ].sort((a, b) => a.localeCompare(b, "ja"));
    return values.map((v) => {
      const match = selected.find((s) => s.toLowerCase() === v.toLowerCase());
      const active = match !== undefined;
      return {
        label: v,
        params: { [`in_${field.id}`]: toggled(selected, match ?? v, active) },
        active,
      };
    });
  }

  const minKey = `min_${field.id}`;
  const maxKey = `max_${field.id}`;
  const range = query.ranges.find((r) => r.fieldId === field.id);
  const unit = field.unit ? ` ${field.unit}` : "";
  let values = [
    ...new Set(
      visible
        .map((i) => i.specs[field.id]?.num)
        .filter((v): v is number => v !== null && v !== undefined),
    ),
  ].sort((a, b) => a - b);
  // 「一番小さい値以上」「一番大きい値以下」は全部の商品が通り、絞り込みにならないので出さない
  if (values.length > 1 && field.better === "higher") values = values.slice(1);
  if (values.length > 1 && field.better === "lower")
    values = values.slice(0, -1);

  return values.map((v) => {
    const text = `${formatNumber(v)}${unit}`;
    if (field.better === "higher") {
      const active = range?.min === v && range.max === undefined;
      return {
        label: `${text} 以上`,
        params: {
          [minKey]: active ? undefined : String(v),
          [maxKey]: undefined,
        },
        active,
      };
    }
    if (field.better === "lower") {
      const active = range?.max === v && range.min === undefined;
      return {
        label: `${text} 以下`,
        params: {
          [minKey]: undefined,
          [maxKey]: active ? undefined : String(v),
        },
        active,
      };
    }
    const selected =
      query.numIn.find((n) => n.fieldId === field.id)?.values ?? [];
    const active = selected.includes(v);
    return {
      label: text,
      params: {
        [`in_${field.id}`]: toggled(selected.map(String), String(v), active),
      },
      active,
    };
  });
}

/** メーカーの簡易フィルタのチップ。テキストの項目と同じく複数選べ、どれかに一致するものを残す */
export function makerChips(
  items: readonly CompareItem[],
  query: CompareQuery,
): QuickChip[] {
  const visible = items.filter((i) => isListed(i, query));
  const makers = [
    ...new Set(visible.map((i) => i.maker).filter((m): m is string => !!m)),
  ].sort((a, b) => a.localeCompare(b, "ja"));
  return makers.map((m) => {
    const match = query.makers.find((s) => s.toLowerCase() === m.toLowerCase());
    const active = match !== undefined;
    return {
      label: m,
      params: { maker: toggled(query.makers, match ?? m, active) },
      active,
    };
  });
}

/**
 * 比較表に出す行と、列ごとの最良値。
 * weights があれば、絞り込んだ行の中で総合スコアと順位も出す（スコアが無ければ scores は undefined）
 */
export function compare(
  items: readonly CompareItem[],
  fields: readonly FieldDef[],
  query: CompareQuery,
  weights?: ScoreWeights,
) {
  const filtered = items.filter((i) => matches(i, query));
  const scores =
    weights && hasScore(fields, weights)
      ? scoreItems(filtered, fields, weights)
      : undefined;
  const rows = sortItems(filtered, query, scores);
  return {
    rows,
    best: bestValues(rows, fields, query.costFieldId, scores),
    scores,
    ranks: scores ? scoreRanks(scores) : undefined,
  };
}

/** 数値を桁区切りで。小数は必要なぶんだけ（最大 2 桁）出す */
export function formatNumber(value: number, maxFractionDigits = 2): string {
  return value.toLocaleString("ja-JP", {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatYen(value: number, maxFractionDigits = 0): string {
  return `¥${formatNumber(value, maxFractionDigits)}`;
}

/** 表に出すスペック値。未入力は null */
export function formatSpec(
  field: Pick<FieldDef, "kind" | "unit">,
  cell: SpecCell | undefined,
): string | null {
  if (!cell) return null;
  if (field.kind === "bool")
    return cell.num === null ? null : cell.num === 1 ? "あり" : "なし";
  if (field.kind === "text") return cell.text;
  if (cell.num === null) return null;
  return field.unit
    ? `${formatNumber(cell.num)} ${field.unit}`
    : formatNumber(cell.num);
}

/** コスパ列の見出し。「¥ / GB」のように出す */
export function costLabel(field: Pick<FieldDef, "name" | "unit">): string {
  return `${field.name} 1${field.unit ?? ""} あたり`;
}

export const BETTER_LABELS: Record<Better, string> = {
  higher: "大きいほど良い",
  lower: "小さいほど良い",
  none: "比べない",
};

export const KIND_LABELS: Record<FieldKind, string> = {
  number: "数値",
  bool: "あり / なし",
  text: "テキスト",
};
