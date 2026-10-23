import Link from "next/link";
import { recordWorkout } from "@/app/actions/workouts";
import { ActionForm } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";
import { getDb } from "@/db";
import { latestWorkout, listMenus, listWorkoutsOn } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatDay, today } from "@/lib/date";
import { MAX_REPS, MAX_WEIGHT, WEIGHT_STEP } from "@/lib/limits";
import { formatWeight, nextMenu } from "@/lib/training";
import { repsField, weightField } from "@/lib/workout-form";

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const { menu: menuParam } = await searchParams;
  const day = today();

  const db = await getDb();
  const [menus, last, done] = await Promise.all([
    listMenus(db, user.id),
    latestWorkout(db, user.id),
    listWorkoutsOn(db, user.id, day),
  ]);

  const suggested = nextMenu(menus, last?.menuId);
  // ?menu= で別のメニューに切り替えられる。ローテーションは記録したメニューの次から続く
  const chosen = menus.find((m) => String(m.id) === menuParam) ?? suggested;

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <h1 className="text-lg font-bold">{formatDay(day)}</h1>

      {!chosen ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          まずは
          <Link href="/plan" className="mx-1 text-sky-600 hover:underline">
            目標
          </Link>
          で種目とメニューを作ってください
        </p>
      ) : (
        <section className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              {done.length > 0 ? "次は" : "今日は"}「{chosen.name}
              」をやりましょう
            </h2>
            {menus.length > 1 && (
              <nav className="flex flex-wrap gap-2 text-sm">
                {menus.map((m) => (
                  <Link
                    key={m.id}
                    href={m.id === suggested?.id ? "/" : `/?menu=${m.id}`}
                    className={`rounded-full border px-3 py-1 ${m.id === chosen.id ? "border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
                  >
                    {m.name}
                    {m.id === suggested?.id && (
                      <span className="ml-1 text-xs">（おすすめ）</span>
                    )}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {chosen.exercises.length === 0 ? (
            <p className="text-sm text-zinc-500">
              このメニューには種目がありません。
              <Link href="/plan" className="text-sky-600 hover:underline">
                目標
              </Link>
              で種目を入れてください
            </p>
          ) : (
            // 記録するとローテーションが進むので、メニューと記録の数で作り直して入力を持ち越さない
            <ActionForm
              key={`${chosen.id}-${done.length}`}
              action={recordWorkout}
              submitLabel="記録する"
              successHref="/"
              className="space-y-5"
            >
              <input type="hidden" name="menuId" value={chosen.id} />
              <input type="hidden" name="performedOn" value={day} />
              <p className="text-xs text-zinc-500">
                予定の値が入っています。できた回数に直して記録してください（回数を空にしたセットは記録しません）
              </p>
              {chosen.exercises.map((exercise) => (
                <fieldset key={exercise.id} className="space-y-2">
                  <legend className="mb-1 font-semibold">
                    {exercise.name}
                    <span className="ml-2 text-sm font-normal text-zinc-500">
                      {formatWeight(exercise.weight)} × {exercise.targetReps}回
                      × {exercise.targetSets}セット
                    </span>
                  </legend>
                  {Array.from(
                    { length: exercise.targetSets },
                    (_, i) => i + 1,
                  ).map((setNumber) => (
                    <div
                      key={setNumber}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-12 text-zinc-500">
                        {setNumber}セット
                      </span>
                      <input
                        name={weightField(exercise.id, setNumber)}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={MAX_WEIGHT}
                        step={WEIGHT_STEP}
                        defaultValue={exercise.weight}
                        aria-label={`${exercise.name} ${setNumber}セット目の重量`}
                        className={`${inputClass} w-24 text-right`}
                      />
                      kg ×
                      <input
                        name={repsField(exercise.id, setNumber)}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_REPS}
                        step={1}
                        defaultValue={exercise.targetReps}
                        aria-label={`${exercise.name} ${setNumber}セット目の回数`}
                        className={`${inputClass} w-20 text-right`}
                      />
                      回
                    </div>
                  ))}
                </fieldset>
              ))}
            </ActionForm>
          )}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">今日の記録</h2>
          {done.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </section>
      )}
    </main>
  );
}
