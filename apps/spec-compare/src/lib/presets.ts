import type { Better, FieldKind } from "@/db/schema";

export type PresetField = {
  name: string;
  unit?: string;
  kind: FieldKind;
  better: Better;
};
export type Preset = { key: string; label: string; fields: PresetField[] };

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
];

export function findPreset(key: string | undefined): Preset | undefined {
  return PRESETS.find((p) => p.key === key);
}
