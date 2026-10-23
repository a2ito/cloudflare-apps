import type { Db } from "@/db";
import { isImageKeyReferenced } from "@/db/queries";
import { deleteImage } from "./images";

/**
 * 画像キーへの参照を手放す。
 *
 * 荷姿ごとに商品を分割したマイグレーション（0005）が image_key をコピーしたため、
 * 複数の行が同じ R2 オブジェクトを指していることがある。無条件に消すと共有相手の
 * 画像まで巻き添えになるので、どこからも参照されなくなったときだけ実体を消す。
 *
 * 参照が消えたことを判定するため、DB を更新したあとに呼ぶこと。
 */
export async function releaseImage(db: Db, key: string | null): Promise<void> {
  if (!key) return;
  if (await isImageKeyReferenced(db, key)) return;
  await deleteImage(key);
}
