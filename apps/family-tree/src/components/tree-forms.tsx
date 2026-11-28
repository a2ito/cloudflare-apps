"use client";

import { useActionState } from "react";
import {
  addMemberAction,
  createTreeAction,
  deleteTreeAction,
  removeMemberAction,
  renameTreeAction,
} from "@/app/actions/trees";
import { MAX_TREE_NAME } from "@/lib/constants";
import { initialActionState } from "@/lib/form";
import {
  dangerButtonClass,
  FormMessage,
  inputClass,
  primaryButtonClass,
} from "./ui";

export function CreateTreeForm() {
  const [state, action, pending] = useActionState(
    createTreeAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={MAX_TREE_NAME}
          placeholder="家系図の名前（例: 山田家）"
          aria-label="家系図の名前"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} shrink-0`}
        >
          作成
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RenameTreeForm({
  treeId,
  name,
}: {
  treeId: number;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    renameTreeAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="treeId" value={treeId} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={MAX_TREE_NAME}
          defaultValue={name}
          aria-label="家系図の名前"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} shrink-0`}
        >
          変更
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function AddMemberForm({ treeId }: { treeId: number }) {
  const [state, action, pending] = useActionState(
    addMemberAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="treeId" value={treeId} />
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="共有する相手の Google アカウント"
          aria-label="共有する相手のメールアドレス"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} shrink-0`}
        >
          共有
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RemoveMemberButton({
  treeId,
  email,
}: {
  treeId: number;
  email: string;
}) {
  const [state, action, pending] = useActionState(
    removeMemberAction,
    initialActionState,
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="email" value={email} />
      {state.error && <FormMessage state={state} />}
      <button
        type="submit"
        disabled={pending}
        aria-label={`${email} との共有をやめる`}
        className="px-1 text-sm text-zinc-400 hover:text-red-600"
      >
        外す
      </button>
    </form>
  );
}

export function DeleteTreeForm({
  treeId,
  name,
}: {
  treeId: number;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    deleteTreeAction,
    initialActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="treeId" value={treeId} />
      <p className="text-sm">
        家系図と、載っている人物・つながりをすべて消します。元に戻せません。
        確認のため「<span className="font-semibold">{name}</span>
        」と入力してください。
      </p>
      <div className="flex gap-2">
        <input
          name="confirm"
          required
          autoComplete="off"
          aria-label="確認のため家系図の名前を入力"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${dangerButtonClass} shrink-0`}
        >
          削除
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
