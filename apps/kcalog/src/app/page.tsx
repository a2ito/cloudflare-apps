import Link from "next/link";
import { deleteMealAction } from "@/app/actions/meals";
import { MealForm } from "@/components/meal-form";
import { getDb } from "@/db";
import { listMealsOn } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { formatDay, isDate, shiftDate, today } from "@/lib/date";

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const { date } = await searchParams;
  const todayStr = today();
  const day = typeof date === "string" && isDate(date) ? date : todayStr;

  const db = await getDb();
  const meals = await listMealsOn(db, user.id, day);
  const total = meals.reduce((sum, m) => sum + m.kcal, 0);

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <nav className="flex items-center justify-between">
        <Link
          href={`/?date=${shiftDate(day, -1)}`}
          className="px-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 前日
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold">{formatDay(day)}</h1>
          {day !== todayStr && (
            <Link href="/" className="text-xs text-orange-600 hover:underline">
              今日へ
            </Link>
          )}
        </div>
        <Link
          href={`/?date=${shiftDate(day, 1)}`}
          className="px-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          翌日 →
        </Link>
      </nav>

      <section className="rounded-lg bg-orange-50 py-4 text-center dark:bg-orange-950/40">
        <p className="text-sm text-zinc-500">合計</p>
        <p className="text-4xl font-bold tabular-nums">
          {total.toLocaleString("ja-JP")}
          <span className="ml-1 text-base font-normal text-zinc-500">kcal</span>
        </p>
      </section>

      {/* 日付を変えたら入力途中の値を持ち越さないよう key で作り直す */}
      <MealForm key={day} eatenOn={day} />

      {meals.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          まだ記録がありません
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {meals.map((meal) => (
            <li key={meal.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate">{meal.foodName}</span>
              <span className="tabular-nums">
                {meal.kcal.toLocaleString("ja-JP")} kcal
              </span>
              <form action={deleteMealAction}>
                <input type="hidden" name="id" value={meal.id} />
                <button
                  type="submit"
                  aria-label={`${meal.foodName} を削除`}
                  className="px-1 text-zinc-400 hover:text-red-600"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
