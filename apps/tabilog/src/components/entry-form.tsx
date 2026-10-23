"use client";

import { useActionState, useState } from "react";
import { saveEntry } from "@/app/actions/entries";
import type { EntryWithMeta, TripWithCurrencies } from "@/db/queries";
import { nowWallClock } from "@/lib/datetime";
import { ENTRY_KIND_OPTIONS } from "@/lib/entry-kinds";
import { initialActionState } from "@/lib/form";
import { MAP_URL_EXAMPLE } from "@/lib/map-url";
import {
  currencyLabel,
  DEFAULT_CURRENCY,
  minorToInput,
  normalizeCurrency,
} from "@/lib/money";
import { PhotoInput } from "./photo-input";
import { Field, FormMessage, inputClass, SubmitButton } from "./ui";

export function EntryForm({
  trip,
  entry,
}: {
  trip: TripWithCurrencies;
  entry?: EntryWithMeta;
}) {
  const [state, formAction] = useActionState(saveEntry, initialActionState);
  // 現地で払うとは限らない（日本で先に払った宿代など）ので、入力通貨を選べるようにする。
  // 円はどの旅行でも使えるので、旅行に登録された現地通貨と並べて選ばせる
  const choices = [...trip.currencies.map((c) => c.code), DEFAULT_CURRENCY];
  const defaultCurrency = normalizeCurrency(
    entry?.amountCurrency ?? choices[0] ?? DEFAULT_CURRENCY,
  );
  const [inputCurrency, setInputCurrency] = useState(defaultCurrency);
  // 選択肢が 1 つ（＝円だけの旅行）なら選ばせる意味がない
  const canChooseCurrency = choices.length > 1;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tripId" value={trip.id} />
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <FormMessage state={state} />

      <Field label="種別">
        <select
          name="kind"
          defaultValue={entry?.kind ?? "food"}
          className={inputClass}
        >
          {ENTRY_KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="何を？">
        <input
          name="title"
          defaultValue={entry?.title ?? ""}
          required
          maxLength={200}
          className={inputClass}
          placeholder="小籠包"
        />
      </Field>

      {trip.areas.length > 0 && (
        <Field label="エリア" hint="旅行に登録した場所から選びます">
          <select
            name="areaId"
            defaultValue={String(entry?.areaId ?? 0)}
            className={inputClass}
          >
            <option value="0">指定しない</option>
            {trip.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="どこで？">
        <input
          name="place"
          defaultValue={entry?.place ?? ""}
          maxLength={200}
          className={inputClass}
          placeholder="鼎泰豐 本店"
        />
      </Field>

      <Field
        label="地図"
        hint="Google マップの共有 URL を貼ると、記録から地図を開けます"
      >
        <input
          type="url"
          name="mapUrl"
          defaultValue={entry?.mapUrl ?? ""}
          maxLength={2000}
          inputMode="url"
          className={inputClass}
          placeholder={MAP_URL_EXAMPLE}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="いくら？" hint="空欄でも保存できます">
          <div className="flex gap-2">
            {/* inputClass の w-full と衝突しないよう、幅の指定は外側の要素に持たせる */}
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={
                entry?.amountMinor != null
                  ? minorToInput(entry.amountMinor, defaultCurrency)
                  : ""
              }
              className={`${inputClass} min-w-0 flex-1`}
              placeholder="200"
            />
            {canChooseCurrency ? (
              <div className="w-28 shrink-0">
                <select
                  name="amountCurrency"
                  value={inputCurrency}
                  onChange={(e) => setInputCurrency(e.target.value)}
                  aria-label="金額の通貨"
                  className={inputClass}
                >
                  {choices.map((code) => (
                    <option key={code} value={code} title={currencyLabel(code)}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="hidden"
                name="amountCurrency"
                value={inputCurrency}
              />
            )}
          </div>
        </Field>
        <Field label="日時">
          <input
            type="datetime-local"
            name="happenedAt"
            defaultValue={entry?.happenedAt ?? nowWallClock()}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="評価" hint="美味しかった・よかった度合い">
        <select
          name="rating"
          defaultValue={String(entry?.rating ?? 0)}
          className={inputClass}
        >
          <option value="0">未評価</option>
          <option value="5">★★★★★ 最高</option>
          <option value="4">★★★★ よかった</option>
          <option value="3">★★★ ふつう</option>
          <option value="2">★★ いまいち</option>
          <option value="1">★ 微妙</option>
        </select>
      </Field>

      <Field label="感想">
        <textarea
          name="note"
          defaultValue={entry?.note ?? ""}
          rows={4}
          maxLength={2000}
          className={inputClass}
          placeholder="皮が薄くて熱々。並ぶ価値あり"
        />
      </Field>

      <Field label="写真">
        <PhotoInput name="photos" />
      </Field>

      <SubmitButton>{entry ? "更新する" : "記録する"}</SubmitButton>
    </form>
  );
}
