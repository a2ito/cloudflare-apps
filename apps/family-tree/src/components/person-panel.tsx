"use client";

import { useActionState, useState } from "react";
import {
  deletePersonAction,
  linkPersonsAction,
  type PersonActionState,
  unlinkPersonsAction,
} from "@/app/actions/persons";
import type { ParentChild, Partnership, Person } from "@/db/schema";
import { GENDER_LABELS } from "@/lib/constants";
import { formatFuzzyDate } from "@/lib/fuzzy-date";
import { PersonForm } from "./person-form";
import {
  dangerButtonClass,
  FormMessage,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";

type Mode =
  | { kind: "view" }
  | { kind: "edit" }
  | { kind: "add"; relation: "parent" | "child" | "partner" }
  | { kind: "link" }
  | { kind: "delete" };

const RELATION_LABELS = {
  parent: "親",
  child: "子",
  partner: "配偶者",
} as const;

const initial: PersonActionState = {};

export function PersonPanel({
  treeId,
  person,
  persons,
  parents,
  partners,
  onSelect,
}: {
  treeId: number;
  person: Person;
  persons: Person[];
  parents: ParentChild[];
  partners: Partnership[];
  onSelect: (personId: number | null) => void;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const byId = new Map(persons.map((p) => [p.id, p]));
  const pick = (ids: number[]) =>
    ids.flatMap((id) => {
      const p = byId.get(id);
      return p ? [p] : [];
    });

  const parentList = pick(
    parents.filter((l) => l.childId === person.id).map((l) => l.parentId),
  );
  const childList = pick(
    parents.filter((l) => l.parentId === person.id).map((l) => l.childId),
  );
  const partnerList = pick(
    partners.flatMap((p) =>
      p.personAId === person.id
        ? [p.personBId]
        : p.personBId === person.id
          ? [p.personAId]
          : [],
    ),
  );

  if (mode.kind === "edit") {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{person.name} を編集</h2>
        <PersonForm
          treeId={treeId}
          person={person}
          submitLabel="保存"
          onSaved={() => setMode({ kind: "view" })}
          onCancel={() => setMode({ kind: "view" })}
        />
      </section>
    );
  }

  if (mode.kind === "add") {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">
          {person.name} の{RELATION_LABELS[mode.relation]}を追加
        </h2>
        <PersonForm
          key={mode.relation}
          treeId={treeId}
          relativeOf={person.id}
          kind={mode.relation}
          submitLabel="追加"
          onSaved={(id) => onSelect(id)}
          onCancel={() => setMode({ kind: "view" })}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold">{person.name}</h2>
        {person.kana && <p className="text-sm text-zinc-500">{person.kana}</p>}
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">性別</dt>
          <dd>{GENDER_LABELS[person.gender]}</dd>
          {person.birthDate && (
            <>
              <dt className="text-zinc-500">生年月日</dt>
              <dd>{formatFuzzyDate(person.birthDate)}</dd>
            </>
          )}
          {person.deathDate && (
            <>
              <dt className="text-zinc-500">没年月日</dt>
              <dd>{formatFuzzyDate(person.deathDate)}</dd>
            </>
          )}
        </dl>
        {person.note && (
          <p className="whitespace-pre-wrap rounded-md bg-zinc-100 p-2 text-sm dark:bg-zinc-900">
            {person.note}
          </p>
        )}
        <button
          type="button"
          onClick={() => setMode({ kind: "edit" })}
          className={secondaryButtonClass}
        >
          編集
        </button>
      </div>

      <RelativeList
        title="親"
        treeId={treeId}
        people={parentList}
        unlink={(other) => ({ kind: "parent", a: other.id, b: person.id })}
        onSelect={onSelect}
      />
      <RelativeList
        title="配偶者"
        treeId={treeId}
        people={partnerList}
        unlink={(other) => ({ kind: "partner", a: person.id, b: other.id })}
        onSelect={onSelect}
      />
      <RelativeList
        title="子"
        treeId={treeId}
        people={childList}
        unlink={(other) => ({ kind: "parent", a: person.id, b: other.id })}
        onSelect={onSelect}
      />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-500">家族を追加</h3>
        <div className="flex flex-wrap gap-2">
          {(["parent", "partner", "child"] as const).map((relation) => (
            <button
              key={relation}
              type="button"
              disabled={relation === "parent" && parentList.length >= 2}
              onClick={() => setMode({ kind: "add", relation })}
              className={secondaryButtonClass}
            >
              ＋ {RELATION_LABELS[relation]}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setMode({ kind: mode.kind === "link" ? "view" : "link" })
            }
            className={secondaryButtonClass}
          >
            家系図にいる人とつなぐ
          </button>
        </div>
        {mode.kind === "link" && (
          <LinkForm
            treeId={treeId}
            person={person}
            candidates={persons.filter((p) => p.id !== person.id)}
            onDone={() => setMode({ kind: "view" })}
          />
        )}
      </div>

      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
        {mode.kind === "delete" ? (
          <DeleteForm
            treeId={treeId}
            person={person}
            onDeleted={() => onSelect(null)}
            onCancel={() => setMode({ kind: "view" })}
          />
        ) : (
          <button
            type="button"
            onClick={() => setMode({ kind: "delete" })}
            className={dangerButtonClass}
          >
            この人を削除
          </button>
        )}
      </div>
    </section>
  );
}

function RelativeList({
  title,
  treeId,
  people,
  unlink,
  onSelect,
}: {
  title: string;
  treeId: number;
  people: Person[];
  unlink: (other: Person) => {
    kind: "parent" | "partner";
    a: number;
    b: number;
  };
  onSelect: (personId: number) => void;
}) {
  const [state, action, pending] = useActionState(unlinkPersonsAction, initial);
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-zinc-500">{title}</h3>
      {people.length === 0 ? (
        <p className="text-sm text-zinc-400">なし</p>
      ) : (
        <ul className="space-y-1">
          {people.map((p) => {
            const link = unlink(p);
            return (
              <li key={p.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {p.name}
                </button>
                <form action={action}>
                  <input type="hidden" name="treeId" value={treeId} />
                  <input type="hidden" name="kind" value={link.kind} />
                  <input type="hidden" name="a" value={link.a} />
                  <input type="hidden" name="b" value={link.b} />
                  <button
                    type="submit"
                    disabled={pending}
                    aria-label={`${p.name} とのつながりを外す`}
                    title="つながりを外す"
                    className="px-1 text-zinc-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      {state.error && <FormMessage state={state} />}
    </div>
  );
}

function LinkForm({
  treeId,
  person,
  candidates,
  onDone,
}: {
  treeId: number;
  person: Person;
  candidates: Person[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: PersonActionState, formData: FormData) => {
      const result = await linkPersonsAction(prev, formData);
      if (result.success) onDone();
      return result;
    },
    initial,
  );
  if (candidates.length === 0)
    return <p className="text-sm text-zinc-500">ほかに人物がいません</p>;
  return (
    <form
      action={action}
      className="space-y-2 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={person.id} />
      <div className="flex items-center gap-2 text-sm">
        <select
          name="otherId"
          required
          defaultValue=""
          className={inputClass}
          aria-label="つなぐ相手"
        >
          <option value="" disabled>
            相手を選ぶ
          </option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="shrink-0">は</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="shrink-0">{person.name} の</span>
        <select
          name="kind"
          required
          defaultValue="parent"
          className={inputClass}
          aria-label="続柄"
        >
          {(["parent", "partner", "child"] as const).map((k) => (
            <option key={k} value={k}>
              {RELATION_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        つなぐ
      </button>
    </form>
  );
}

function DeleteForm({
  treeId,
  person,
  onDeleted,
  onCancel,
}: {
  treeId: number;
  person: Person;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: PersonActionState, formData: FormData) => {
      const result = await deletePersonAction(prev, formData);
      if (result.success) onDeleted();
      return result;
    },
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="personId" value={person.id} />
      <p className="text-sm">
        {person.name}{" "}
        と、この人の親子・配偶者のつながりを消します。よろしいですか？
      </p>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={dangerButtonClass}>
          削除する
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={secondaryButtonClass}
        >
          やめる
        </button>
      </div>
    </form>
  );
}
