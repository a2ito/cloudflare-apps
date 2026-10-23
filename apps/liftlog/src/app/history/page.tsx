import { deleteWorkoutAction } from "@/app/actions/workouts";
import { deleteButtonClass } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";
import { getDb } from "@/db";
import { listWorkouts } from "@/db/queries";
import { requireUser } from "@/lib/auth";

/** 振り返るのは直近の分で足りるので、ページ送りは付けずに件数で切る */
const LIMIT = 50;

export default async function HistoryPage() {
  const user = await requireUser();
  const db = await getDb();
  const workouts = await listWorkouts(db, user.id, LIMIT);

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-bold">履歴</h1>
      <p className="text-xs text-zinc-500">
        赤い数字は目標回数に届かなかったセット。記録を消しても、上がった重量は戻りません（目標の画面で直してください）
      </p>
      {workouts.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          まだ記録がありません
        </p>
      ) : (
        workouts.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            action={
              <form action={deleteWorkoutAction}>
                <input type="hidden" name="id" value={w.id} />
                <button
                  type="submit"
                  aria-label={`${w.performedOn} の ${w.menuName} を削除`}
                  className={deleteButtonClass}
                >
                  ×
                </button>
              </form>
            }
          />
        ))
      )}
    </main>
  );
}
