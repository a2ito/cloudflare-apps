/**
 * 入力の上限。フォーム（クライアント）とサーバーアクションの両方から読むため、
 * "use server" のファイルには置けない（非同期関数以外を export できない）。
 */

export const MAX_DECK_NAME = 50;
/** 1 文として長すぎるものは貼り付けの崩れとみなす */
export const MAX_SENTENCE = 500;
export const MAX_NOTE = 500;
/** まとめて登録できる行数。教材 1 冊の 1 章ぶんには足りる */
export const MAX_BULK_LINES = 500;
