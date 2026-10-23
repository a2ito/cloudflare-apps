import { extensionForType } from "./clipboard";

/**
 * ダウンロードするときのファイル名。
 *
 * R2 のキーは UUID なので、そのまま保存させると何の写真か分からなくなる。
 * 日記の日時から付け直し、ファイル名に使えない文字は落とす。
 */

/** 長すぎるタイトルはここで切る（端末やクラウドの保存先で弾かれないように） */
const MAX_BASE_LENGTH = 40;

export function photoFileName(
  title: string,
  index: number,
  contentType: string,
): string {
  const base =
    title
      // パス区切りや Windows で使えない文字、制御文字を落とす
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, MAX_BASE_LENGTH)
      .replace(/[-.]+$/, "") || "photo";
  return `${base}-${index + 1}.${extensionForType(contentType)}`;
}
