"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/form";

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText = "送信中…",
  ...props
}: ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 whitespace-nowrap text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm";
  const style =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
  return (
    <Link href={href} className={`${base} ${style}`}>
      {children}
    </Link>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
      >
        {state.success}
      </p>
    );
  }
  return null;
}

/** 削除など取り消せない操作の前に確認ダイアログを出すフォーム */
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function DangerButton({ children, ...props }: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
      {...props}
    >
      {children}
    </button>
  );
}

/** 中古の価格に付ける印。最安値が中古のときに見落とさないように */
export function UsedBadge() {
  return (
    <span className="mr-1 rounded bg-amber-500 px-1.5 align-middle text-xs font-normal text-white">
      中古
    </span>
  );
}

export function SoldOutBadge() {
  return (
    <span className="mr-1 rounded bg-zinc-500 px-1.5 align-middle text-xs font-normal text-white">
      売り切れ
    </span>
  );
}
