"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { recordReview } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/date";

const reviewSchema = z.object({
  id: z.number().int().positive(),
  correct: z.boolean(),
});

/**
 * 練習中の○×を記録する。フォームではなく練習画面から直接呼ぶので、引数を検証し直す
 * （Server Action はブラウザから任意の値で呼べるため）。
 *
 * revalidatePath は呼ばない。呼ぶと練習画面が再描画され、出題が選び直されてしまう。
 * セット一覧の「今日の数」は、一覧を開いたときに読み直されるので困らない。
 */
export async function recordReviewAction(
  id: unknown,
  correct: unknown,
): Promise<void> {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse({ id, correct });
  if (!parsed.success) throw new Error("記録する内容が不正です");

  const db = await getDb();
  if (
    !(await recordReview(
      db,
      user.id,
      parsed.data.id,
      parsed.data.correct,
      today(),
    ))
  ) {
    throw new Error("文が見つかりません");
  }
}
