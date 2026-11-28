/**
 * スキーマ・フォーム（クライアント）・サーバーアクションの全部から読む値。
 * "use server" のファイルには置けない（非同期関数以外を export できない）。
 */

export const MEMBER_ROLES = ["owner", "editor"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const GENDERS = ["male", "female", "other", "unknown"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
  unknown: "不明",
};

export const MAX_TREE_NAME = 50;
export const MAX_PERSON_NAME = 50;
export const MAX_NOTE = 500;
/** 1 枚の家系図に載せる人数の上限。描画とレイアウト計算が重くならない範囲に抑える */
export const MAX_PERSONS_PER_TREE = 500;
/** 1 枚の家系図を共有できる人数（持ち主を含む） */
export const MAX_MEMBERS_PER_TREE = 20;
