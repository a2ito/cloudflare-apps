import type { WorkoutWithSets } from "@/db/queries";
import { formatDay } from "@/lib/date";
import { formatWeight } from "@/lib/training";
import { cardClass } from "./ui";

/** セットを種目ごとにまとめる。セットは種目を入れた順に並んでいる */
function groupByExercise(sets: WorkoutWithSets["sets"]) {
  const groups: { name: string; sets: WorkoutWithSets["sets"] }[] = [];
  for (const set of sets) {
    const last = groups.at(-1);
    if (last?.name === set.exerciseName) last.sets.push(set);
    else groups.push({ name: set.exerciseName, sets: [set] });
  }
  return groups;
}

export function WorkoutCard({
  workout,
  action,
}: {
  workout: WorkoutWithSets;
  action?: React.ReactNode;
}) {
  return (
    <article className={cardClass}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-bold">
          {workout.menuName}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {formatDay(workout.performedOn)}
          </span>
        </h3>
        {action}
      </header>
      <ul className="space-y-1 text-sm">
        {groupByExercise(workout.sets).map((group) => (
          <li key={group.name} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{group.name}</span>
            {group.sets.map((s) => (
              <span
                key={s.id}
                className={`tabular-nums ${s.reps < s.targetReps ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}
              >
                {formatWeight(s.weight)}×{s.reps}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </article>
  );
}
