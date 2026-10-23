"use client";

import { useActionState, useId, useState } from "react";
import { saveTrip } from "@/app/actions/trips";
import type { TripWithCurrencies } from "@/db/queries";
import { initialActionState } from "@/lib/form";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  MAX_TRIP_CURRENCIES,
} from "@/lib/money";
import { MAX_TRIP_AREAS } from "@/lib/trip-areas";
import { Field, FormMessage, inputClass, SubmitButton } from "./ui";

/** 円は主通貨として常に使えるので、選択肢からは外す */
const LOCAL_CURRENCY_OPTIONS = CURRENCY_OPTIONS.filter(
  (c) => c.code !== DEFAULT_CURRENCY,
);

type CurrencyRow = { key: string; code: string; rate: string };

function toRows(trip?: TripWithCurrencies): CurrencyRow[] {
  return (trip?.currencies ?? []).map((c) => ({
    key: `saved-${c.id}`,
    code: c.code,
    rate: String(c.rateToJpy),
  }));
}

export function TripForm({ trip }: { trip?: TripWithCurrencies }) {
  const [state, formAction] = useActionState(saveTrip, initialActionState);
  const [rows, setRows] = useState<CurrencyRow[]>(() => toRows(trip));
  const [areas, setAreas] = useState<{ key: string; name: string }[]>(() =>
    (trip?.areas ?? []).map((a) => ({
      key: `saved-area-${a.id}`,
      name: a.name,
    })),
  );
  const rowIdPrefix = useId();

  // 同じ通貨を 2 度選べないよう、他の行で使っている通貨は選択肢から外す
  const usedCodes = new Set(rows.map((r) => r.code).filter((c) => c !== ""));
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        key: `${rowIdPrefix}-${prev.length}-${Date.now()}`,
        code: "",
        rate: "",
      },
    ]);
  const removeRow = (key: string) =>
    setRows((prev) => prev.filter((r) => r.key !== key));
  const updateRow = (key: string, patch: Partial<CurrencyRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const addArea = () =>
    setAreas((prev) => [
      ...prev,
      { key: `${rowIdPrefix}-area-${prev.length}-${Date.now()}`, name: "" },
    ]);
  const removeArea = (key: string) =>
    setAreas((prev) => prev.filter((a) => a.key !== key));
  const updateArea = (key: string, name: string) =>
    setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, name } : a)));

  return (
    <form action={formAction} className="space-y-4">
      {trip && <input type="hidden" name="id" value={trip.id} />}
      <FormMessage state={state} />

      <Field label="旅行名">
        <input
          name="name"
          defaultValue={trip?.name ?? ""}
          required
          maxLength={100}
          className={inputClass}
          placeholder="台湾旅行 2026"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="開始日">
          <input
            type="date"
            name="startDate"
            defaultValue={trip?.startDate ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="終了日">
          <input
            type="date"
            name="endDate"
            defaultValue={trip?.endDate ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          現地通貨
        </legend>
        <p className="text-xs text-zinc-500">
          日本円はいつでも使えます。現地で使う通貨と、その 1
          単位が何円かを登録してください（複数可）
        </p>

        {rows.map((row) => (
          <div key={row.key} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <select
                name="currencyCode"
                value={row.code}
                onChange={(e) => updateRow(row.key, { code: e.target.value })}
                aria-label="通貨"
                className={inputClass}
              >
                <option value="">選択してください</option>
                {LOCAL_CURRENCY_OPTIONS.filter(
                  (c) => c.code === row.code || !usedCodes.has(c.code),
                ).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32 shrink-0">
              <input
                name="currencyRate"
                type="number"
                step="0.0001"
                min="0.0001"
                value={row.rate}
                onChange={(e) => updateRow(row.key, { rate: e.target.value })}
                aria-label={
                  row.code ? `1 ${row.code} あたりの円` : "1 単位あたりの円"
                }
                placeholder="4.7"
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label="この通貨を削除"
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              削除
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_TRIP_CURRENCIES}
          className="rounded-md border border-dashed border-zinc-400 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ＋ 通貨を追加
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          エリア
        </legend>
        <p className="text-xs text-zinc-500">
          訪れる場所を登録しておくと、記録をエリアごとに絞り込めます（例:
          ミラノ、ピサ、ローマ）
        </p>

        {areas.map((area) => (
          <div key={area.key} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <input
                name="areaName"
                value={area.name}
                onChange={(e) => updateArea(area.key, e.target.value)}
                maxLength={50}
                aria-label="エリア名"
                placeholder="ミラノ"
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeArea(area.key)}
              aria-label="このエリアを削除"
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              削除
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addArea}
          disabled={areas.length >= MAX_TRIP_AREAS}
          className="rounded-md border border-dashed border-zinc-400 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ＋ エリアを追加
        </button>
        {/* 消したエリアを指していた記録は「エリアなし」になるだけで、消えはしない */}
        <p className="text-xs text-zinc-500">
          エリアを消しても、その記録は残ります
        </p>
      </fieldset>

      <Field label="メモ">
        <textarea
          name="note"
          defaultValue={trip?.note ?? ""}
          rows={3}
          maxLength={1000}
          className={inputClass}
        />
      </Field>

      <SubmitButton>{trip ? "更新する" : "旅行をつくる"}</SubmitButton>
    </form>
  );
}
