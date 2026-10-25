import type { Better, FieldKind } from "@/db/schema";

export type PresetField = {
  name: string;
  unit?: string;
  kind: FieldKind;
  better: Better;
  /** 総合スコアでの重み。省くと 0（スコアに入れない） */
  scoreWeight?: number;
};
export type Preset = {
  key: string;
  label: string;
  fields: PresetField[];
  /** 総合スコアでの最安値の重み。省くと 0 */
  priceScoreWeight?: number;
};

/**
 * カテゴリを作るときに最初から入れておくスペック項目のひな形。
 * 項目はあとから足したり消したりできるので、よく見る項目だけにしている
 */
export const PRESETS: readonly Preset[] = [
  {
    key: "laptop",
    label: "ノート PC",
    fields: [
      { name: "CPU", kind: "text", better: "none" },
      { name: "メモリ", unit: "GB", kind: "number", better: "higher" },
      { name: "ストレージ", unit: "GB", kind: "number", better: "higher" },
      { name: "画面サイズ", unit: "インチ", kind: "number", better: "none" },
      { name: "重量", unit: "kg", kind: "number", better: "lower" },
      { name: "バッテリー", unit: "時間", kind: "number", better: "higher" },
    ],
  },
  {
    key: "desktop",
    label: "デスクトップ PC",
    fields: [
      { name: "CPU", kind: "text", better: "none" },
      { name: "GPU", kind: "text", better: "none" },
      { name: "メモリ", unit: "GB", kind: "number", better: "higher" },
      { name: "ストレージ", unit: "GB", kind: "number", better: "higher" },
    ],
  },
  {
    key: "monitor",
    label: "モニター",
    fields: [
      { name: "画面サイズ", unit: "インチ", kind: "number", better: "higher" },
      { name: "解像度", kind: "text", better: "none" },
      {
        name: "リフレッシュレート",
        unit: "Hz",
        kind: "number",
        better: "higher",
      },
      { name: "パネル", kind: "text", better: "none" },
      { name: "USB-C 給電", kind: "bool", better: "higher" },
    ],
  },
  {
    key: "smartphone",
    label: "スマートフォン",
    fields: [
      { name: "SoC", kind: "text", better: "none" },
      { name: "ストレージ", unit: "GB", kind: "number", better: "higher" },
      { name: "画面サイズ", unit: "インチ", kind: "number", better: "none" },
      { name: "重量", unit: "g", kind: "number", better: "lower" },
      { name: "防水", kind: "bool", better: "higher" },
    ],
  },
  {
    // 年会費は価格として記録する。最安値・コスパ・総合スコアの価格をそのまま使えるため
    key: "credit-card",
    label: "クレジットカード",
    priceScoreWeight: 2,
    fields: [
      { name: "国際ブランド", kind: "text", better: "none" },
      {
        name: "基本還元率",
        unit: "%",
        kind: "number",
        better: "higher",
        scoreWeight: 3,
      },
      {
        // 回数制限なしは大きな数（99 など）で入れる
        name: "海外ラウンジ無料回数",
        unit: "回/年",
        kind: "number",
        better: "higher",
        scoreWeight: 2,
      },
      {
        name: "海外旅行保険",
        unit: "万円",
        kind: "number",
        better: "higher",
        scoreWeight: 1,
      },
      {
        name: "国内旅行保険",
        unit: "万円",
        kind: "number",
        better: "higher",
        scoreWeight: 1,
      },
      {
        name: "家族カード年会費",
        unit: "円",
        kind: "number",
        better: "lower",
        scoreWeight: 1,
      },
      {
        name: "コンシェルジュ",
        kind: "bool",
        better: "higher",
        scoreWeight: 1,
      },
    ],
  },
];

export function findPreset(key: string | undefined): Preset | undefined {
  return PRESETS.find((p) => p.key === key);
}
