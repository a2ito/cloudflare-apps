/**
 * 評価の軸。
 *
 * 軸ごとに 1〜5 で付ける。未評価は null で、0 は「未評価」としてフォームから来る。
 * 列名と画面の並びをここ 1 か所に持つ（軸を足すときはここと schema.ts を直す）。
 */

/** DB の列 rating_<key> と 1 対 1 で対応する */
export const RATING_AXES = [
  { key: "overall", label: "総合", hint: "また買いたいか" },
  { key: "aroma", label: "香り", hint: "立ち上がりの華やかさ・複雑さ" },
  { key: "taste", label: "味", hint: "口に含んだときの好み" },
  { key: "finish", label: "余韻", hint: "飲んだあとの続き方" },
  { key: "value", label: "コスパ", hint: "値段に見合うか" },
] as const;

export type RatingAxis = (typeof RATING_AXES)[number]["key"];

/** 評価をまとめて持つ。未評価の軸は null */
export type Ratings = Record<RatingAxis, number | null>;

export const MAX_RATING = 5;

/** フォームの選択肢。0 は未評価 */
export const RATING_CHOICES = [
  { value: 0, label: "未評価" },
  { value: 5, label: "★★★★★ 最高" },
  { value: 4, label: "★★★★ よかった" },
  { value: 3, label: "★★★ ふつう" },
  { value: 2, label: "★★ いまいち" },
  { value: 1, label: "★ 微妙" },
] as const;

/** 0（未評価）を null に寄せる */
export function toRatingValue(input: number): number | null {
  return input >= 1 && input <= MAX_RATING ? input : null;
}

/** 付いている軸だけの平均。1 つも付いていなければ null */
export function averageRating(ratings: Ratings): number | null {
  const values = RATING_AXES.map((a) => ratings[a.key]).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/** 総合が付いていればそれを、無ければ他の軸の平均を四捨五入して代表値にする */
export function representativeRating(ratings: Ratings): number | null {
  if (ratings.overall !== null) return ratings.overall;
  const average = averageRating(ratings);
  return average === null ? null : Math.round(average);
}

/** DB の行が持つ評価列。schema.ts の wines と同じ名前にしてある */
export type RatingColumns = {
  ratingOverall: number | null;
  ratingAroma: number | null;
  ratingTaste: number | null;
  ratingFinish: number | null;
  ratingValue: number | null;
};

/** 軸の key からフォームの name / DB の列名を作る */
export function ratingFieldName(key: RatingAxis): keyof RatingColumns {
  return `rating${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof RatingColumns;
}

/** DB の行を軸ごとの評価に直す */
export function toRatings(row: RatingColumns): Ratings {
  return {
    overall: row.ratingOverall,
    aroma: row.ratingAroma,
    taste: row.ratingTaste,
    finish: row.ratingFinish,
    value: row.ratingValue,
  };
}
