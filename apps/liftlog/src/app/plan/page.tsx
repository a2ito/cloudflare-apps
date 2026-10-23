import {
  addExercise,
  addMenu,
  addMenuItemAction,
  deleteExerciseAction,
  deleteMenuAction,
  removeMenuItemAction,
  updateExerciseAction,
} from "@/app/actions/plan";
import { ActionForm } from "@/components/action-form";
import { ExerciseFields } from "@/components/exercise-fields";
import { cardClass, deleteButtonClass, inputClass } from "@/components/ui";
import { getDb } from "@/db";
import { listExercises, listMenus } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatWeight } from "@/lib/training";

export default async function PlanPage() {
  const user = await requireUser();
  const db = await getDb();
  const [exercises, menus] = await Promise.all([
    listExercises(db, user.id),
    listMenus(db, user.id),
  ]);

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
      <section className="space-y-3">
        <h1 className="text-lg font-bold">種目と目標</h1>
        <p className="text-xs text-zinc-500">
          重量は次回に提案する値です。全セットで目標回数に届くと、記録したときに上げ幅だけ増えます（上げ幅
          0 なら増えません）
        </p>
        <ul className="space-y-2">
          {exercises.map((e) => (
            <li key={e.id} className={cardClass}>
              <details>
                <summary className="flex cursor-pointer items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{e.name}</span>
                    <span className="ml-2 text-sm text-zinc-500">
                      {formatWeight(e.weight)} × {e.targetReps}回 ×{" "}
                      {e.targetSets}セット（+{formatWeight(e.increment)}）
                    </span>
                  </span>
                  <span className="text-xs text-sky-600">編集</span>
                </summary>
                <div className="mt-3 flex items-start gap-2">
                  <ActionForm
                    action={updateExerciseAction}
                    submitLabel="保存"
                    className="flex-1 space-y-3"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <ExerciseFields defaults={e} />
                  </ActionForm>
                  <form action={deleteExerciseAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="text-sm text-zinc-400 hover:text-red-600"
                    >
                      削除
                    </button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold">種目を追加</h2>
          <ActionForm
            action={addExercise}
            submitLabel="追加"
            resetOnSuccess
            className="space-y-3"
          >
            <ExerciseFields />
          </ActionForm>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">メニュー</h2>
        <p className="text-xs text-zinc-500">
          上から順に回します。最後まで行ったら最初に戻ります
        </p>
        <ol className="space-y-2">
          {menus.map((menu) => {
            const addable = exercises.filter(
              (e) => !menu.exercises.some((m) => m.id === e.id),
            );
            return (
              <li key={menu.id} className={`${cardClass} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{menu.name}</h3>
                  <form action={deleteMenuAction}>
                    <input type="hidden" name="id" value={menu.id} />
                    <button
                      type="submit"
                      className="text-sm text-zinc-400 hover:text-red-600"
                    >
                      削除
                    </button>
                  </form>
                </div>
                {menu.exercises.length === 0 ? (
                  <p className="text-sm text-zinc-500">種目がありません</p>
                ) : (
                  <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                    {menu.exercises.map((e) => (
                      <li
                        key={e.itemId}
                        className="flex items-center gap-2 py-1"
                      >
                        <span className="flex-1">{e.name}</span>
                        <form action={removeMenuItemAction}>
                          <input type="hidden" name="id" value={e.itemId} />
                          <button
                            type="submit"
                            aria-label={`${menu.name} から ${e.name} を外す`}
                            className={deleteButtonClass}
                          >
                            ×
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                {addable.length > 0 && (
                  <ActionForm
                    action={addMenuItemAction}
                    submitLabel="入れる"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="menuId" value={menu.id} />
                    <select
                      name="exerciseId"
                      aria-label={`${menu.name} に入れる種目`}
                      className={`${inputClass} min-w-0 flex-1`}
                    >
                      {addable.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ol>
        <div className={cardClass}>
          <ActionForm
            action={addMenu}
            submitLabel="メニューを追加"
            resetOnSuccess
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="name"
              required
              maxLength={30}
              placeholder={`メニュー名（例: ${String.fromCharCode(65 + Math.min(menus.length, 25))}）`}
              aria-label="メニュー名"
              className={`${inputClass} min-w-0 flex-1`}
            />
          </ActionForm>
        </div>
      </section>
    </main>
  );
}
