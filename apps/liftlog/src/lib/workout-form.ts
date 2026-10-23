import { MAX_REPS, MAX_WEIGHT, WEIGHT_STEP } from "./limits";

/**
 * 実績入力フォームの読み取り。
 *
 * 1 セットごとに `weight:<種目 ID>:<セット番号>` と `reps:<種目 ID>:<セット番号>` の欄を持つ。
 * 欄の数は種目の目標セット数で決まるので、JS なしでも送れる素のフォームにしている。
 */

export const weightField = (exerciseId: number, setNumber: number) =>
  `weight:${exerciseId}:${setNumber}`;
export const repsField = (exerciseId: number, setNumber: number) =>
  `reps:${exerciseId}:${setNumber}`;

export type PlannedExercise = { id: number; name: string; targetSets: number };
export type EnteredSet = { setNumber: number; weight: number; reps: number };
export type EnteredExercise = { exerciseId: number; sets: EnteredSet[] };

export function isWeight(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_WEIGHT &&
    Number.isInteger(value / WEIGHT_STEP)
  );
}

/**
 * 回数が空のセットは「やらなかった」として飛ばす。重量が空なら 0kg（自重）として扱う。
 * 1 セットも入っていなければエラーにする（空の記録でローテーションだけ進むのを防ぐ）。
 */
export function parseWorkoutSets(
  formData: FormData,
  planned: readonly PlannedExercise[],
): { ok: true; entries: EnteredExercise[] } | { ok: false; error: string } {
  const entries: EnteredExercise[] = [];

  for (const exercise of planned) {
    const sets: EnteredSet[] = [];
    for (let setNumber = 1; setNumber <= exercise.targetSets; setNumber++) {
      const rawReps = String(
        formData.get(repsField(exercise.id, setNumber)) ?? "",
      ).trim();
      if (rawReps === "") continue;
      const rawWeight = String(
        formData.get(weightField(exercise.id, setNumber)) ?? "",
      ).trim();

      const where = `${exercise.name} の ${setNumber} セット目`;
      const reps = Number(rawReps);
      if (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) {
        return {
          ok: false,
          error: `${where}: 回数は 0〜${MAX_REPS} の整数で入力してください`,
        };
      }
      const weight = rawWeight === "" ? 0 : Number(rawWeight);
      if (!isWeight(weight)) {
        return {
          ok: false,
          error: `${where}: 重量は 0〜${MAX_WEIGHT}kg を ${WEIGHT_STEP}kg 刻みで入力してください`,
        };
      }
      sets.push({ setNumber, weight, reps });
    }
    if (sets.length > 0) entries.push({ exerciseId: exercise.id, sets });
  }

  if (entries.length === 0)
    return { ok: false, error: "1 セット以上入力してください" };
  return { ok: true, entries };
}
