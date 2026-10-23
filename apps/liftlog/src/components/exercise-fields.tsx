import type { Exercise } from "@/db/schema";
import {
  MAX_INCREMENT,
  MAX_REPS,
  MAX_SETS,
  MAX_WEIGHT,
  WEIGHT_STEP,
} from "@/lib/limits";
import { inputClass } from "./ui";

type Defaults = Partial<
  Pick<Exercise, "name" | "targetSets" | "targetReps" | "weight" | "increment">
>;

function NumberField({
  label,
  name,
  unit,
  ...rest
}: {
  label: string;
  name: string;
  unit: string;
} & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <span className="flex items-center gap-1">
        <input
          name={name}
          type="number"
          required
          className={`${inputClass} w-20 text-right text-base text-zinc-900 dark:text-zinc-100`}
          {...rest}
        />
        {unit}
      </span>
    </label>
  );
}

/** 種目の追加と編集で共通の欄 */
export function ExerciseFields({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <div className="space-y-3">
      <input
        name="name"
        required
        maxLength={50}
        placeholder="種目名（例: ベンチプレス）"
        aria-label="種目名"
        defaultValue={defaults.name}
        className={`${inputClass} w-full`}
      />
      <div className="flex flex-wrap gap-3">
        <NumberField
          label="重量"
          name="weight"
          unit="kg"
          min={0}
          max={MAX_WEIGHT}
          step={WEIGHT_STEP}
          inputMode="decimal"
          defaultValue={defaults.weight}
        />
        <NumberField
          label="回数"
          name="targetReps"
          unit="回"
          min={1}
          max={MAX_REPS}
          step={1}
          inputMode="numeric"
          defaultValue={defaults.targetReps}
        />
        <NumberField
          label="セット"
          name="targetSets"
          unit="セット"
          min={1}
          max={MAX_SETS}
          step={1}
          inputMode="numeric"
          defaultValue={defaults.targetSets}
        />
        <NumberField
          label="上げ幅"
          name="increment"
          unit="kg"
          min={0}
          max={MAX_INCREMENT}
          step={WEIGHT_STEP}
          inputMode="decimal"
          defaultValue={defaults.increment ?? 2.5}
        />
      </div>
    </div>
  );
}
