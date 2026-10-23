import type { ActionState } from "@/lib/form";

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="text-sm text-emerald-600 dark:text-emerald-400"
      >
        {state.success}
      </p>
    );
  }
  return null;
}
