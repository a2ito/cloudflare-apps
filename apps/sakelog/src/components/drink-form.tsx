"use client";

import { useActionState, useState } from "react";
import { saveDrink } from "@/app/actions/drinks";
import type { DrinkWithMeta } from "@/db/queries";
import {
  CATEGORY_DEFS,
  categoryDef,
  SPECIFIC_FIELDS,
  type Category,
  type SpecificField,
} from "@/lib/categories";
import { MIN_YEAR, today } from "@/lib/datetime";
import { initialActionState } from "@/lib/form";
import { formatIngredients, MAX_INGREDIENTS } from "@/lib/ingredients";
import {
  currencyLabel,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  minorToInput,
  normalizeCurrency,
} from "@/lib/money";
import {
  RATING_AXES,
  RATING_CHOICES,
  ratingFieldName,
  toRatings,
} from "@/lib/ratings";
import { SHOP_URL_EXAMPLE } from "@/lib/shop-url";
import { PhotoInput } from "./photo-input";
import { Field, FormMessage, inputClass, SubmitButton } from "./ui";

/** 種類ごとの項目の入力欄。数値・選択・自由入力を定義から出し分ける */
function SpecificInput({
  field,
  defaultValue,
}: {
  field: SpecificField;
  defaultValue: string;
}) {
  const def = SPECIFIC_FIELDS[field];
  const label = def.unit ? `${def.label}（${def.unit}）` : def.label;

  if (def.kind === "choice") {
    return (
      <Field label={label}>
        <select name={field} defaultValue={defaultValue} className={inputClass}>
          <option value="">未入力</option>
          {def.choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (def.kind === "text") {
    return (
      <Field label={label}>
        <input
          name={field}
          defaultValue={defaultValue}
          maxLength={100}
          className={inputClass}
          placeholder={def.placeholder}
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input
        name={field}
        defaultValue={defaultValue}
        inputMode={def.kind === "integer" ? "numeric" : "decimal"}
        className={inputClass}
        placeholder={def.placeholder}
      />
    </Field>
  );
}

export function DrinkForm({ drink }: { drink?: DrinkWithMeta }) {
  const [state, formAction] = useActionState(saveDrink, initialActionState);
  const defaultCurrency = normalizeCurrency(
    drink?.priceCurrency ?? DEFAULT_CURRENCY,
  );
  const [currency, setCurrency] = useState(defaultCurrency);
  // 選んだ種類で、造り手の呼び方・材料の呼び方・固有の入力欄が変わる
  const [category, setCategory] = useState<Category>(
    (drink?.category as Category) ?? "wine",
  );
  const def = categoryDef(category);
  const ratings = drink ? toRatings(drink) : null;

  /** 保存済みの固有項目を入力欄に戻す */
  const specificValue = (field: SpecificField): string => {
    const value = drink?.[field];
    return value === null || value === undefined ? "" : String(value);
  };

  return (
    <form action={formAction} className="space-y-4">
      {drink && <input type="hidden" name="id" value={drink.id} />}
      <FormMessage state={state} />

      <Field label="種類">
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputClass}
        >
          {CATEGORY_DEFS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="銘柄">
        <input
          name="name"
          defaultValue={drink?.name ?? ""}
          required
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={def.makerLabel}>
          <input
            name="maker"
            defaultValue={drink?.maker ?? ""}
            maxLength={200}
            className={inputClass}
          />
        </Field>
        <Field
          label="分類"
          hint={
            def.styles.length > 0 ? "候補から選ぶか、自由に書けます" : undefined
          }
        >
          <input
            name="style"
            defaultValue={drink?.style ?? ""}
            maxLength={100}
            list={`style-candidates-${category}`}
            className={inputClass}
            placeholder={def.styles[0]?.name ?? ""}
          />
          {/* 候補には説明も添える（title はブラウザがツールチップで見せる） */}
          <datalist id={`style-candidates-${category}`}>
            {def.styles.map((s) => (
              <option key={s.name} value={s.name} label={s.note} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 年が意味を持つ種類（ワイン・ウイスキー）でだけ出す */}
        {def.yearLabel && (
          <Field label={def.yearLabel} hint="年表記が無ければ空欄">
            <input
              type="number"
              name="year"
              defaultValue={drink?.year ?? ""}
              min={MIN_YEAR}
              max={new Date().getFullYear()}
              inputMode="numeric"
              className={inputClass}
            />
          </Field>
        )}
        <Field label="度数（%）">
          <input
            name="abv"
            defaultValue={drink?.abv ?? ""}
            inputMode="decimal"
            className={inputClass}
            placeholder="13.5"
          />
        </Field>
      </div>

      <Field
        label={def.ingredientLabel}
        hint={`カンマ区切りで ${MAX_INGREDIENTS} 個まで。書いた順に並びます（迷ったらガイドを見る）`}
      >
        <input
          name="ingredients"
          defaultValue={formatIngredients(
            drink?.ingredients.map((i) => i.name) ?? [],
          )}
          maxLength={600}
          list={`ingredient-candidates-${category}`}
          className={inputClass}
          placeholder={def.ingredients
            .slice(0, 2)
            .map((i) => i.name)
            .join(", ")}
        />
        <datalist id={`ingredient-candidates-${category}`}>
          {def.ingredients.map((i) => (
            <option key={i.name} value={i.name} label={i.note} />
          ))}
        </datalist>
      </Field>

      {/* 種類ごとの項目。選んだ種類のものだけ出し、送るのもこれだけ */}
      {def.fields.length > 0 && (
        <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {def.label}の項目
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((field) => (
              <SpecificInput
                key={field}
                field={field}
                defaultValue={specificValue(field)}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="国">
          <input
            name="country"
            defaultValue={drink?.country ?? ""}
            maxLength={100}
            className={inputClass}
          />
        </Field>
        <Field label="産地">
          <input
            name="region"
            defaultValue={drink?.region ?? ""}
            maxLength={100}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="価格" hint="空欄でも保存できます">
          <div className="flex gap-2">
            {/* inputClass の w-full と衝突しないよう、幅の指定は外側の要素に持たせる */}
            <input
              name="price"
              inputMode="decimal"
              defaultValue={
                drink?.priceMinor != null
                  ? minorToInput(drink.priceMinor, defaultCurrency)
                  : ""
              }
              className={`${inputClass} min-w-0 flex-1`}
              placeholder="3200"
            />
            <div className="w-28 shrink-0">
              <select
                name="priceCurrency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="価格の通貨"
                className={inputClass}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option
                    key={c.code}
                    value={c.code}
                    title={currencyLabel(c.code)}
                  >
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Field>
        <Field label="飲んだ日" hint="まだ開けていなければ空欄">
          <input
            type="date"
            name="drunkAt"
            defaultValue={drink ? (drink.drunkAt ?? "") : today()}
            max={today()}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="購入場所">
        <input
          name="shop"
          defaultValue={drink?.shop ?? ""}
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label="店の URL" hint="通販や造り手のページ（https のみ）">
        <input
          type="url"
          name="shopUrl"
          defaultValue={drink?.shopUrl ?? ""}
          maxLength={2000}
          inputMode="url"
          className={inputClass}
          placeholder={SHOP_URL_EXAMPLE}
        />
      </Field>

      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          評価
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {RATING_AXES.map((axis) => (
            <Field key={axis.key} label={axis.label} hint={axis.hint}>
              <select
                name={ratingFieldName(axis.key)}
                defaultValue={String(ratings?.[axis.key] ?? 0)}
                className={inputClass}
              >
                {RATING_CHOICES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </fieldset>

      <Field label="感想">
        <textarea
          name="note"
          defaultValue={drink?.note ?? ""}
          rows={4}
          maxLength={2000}
          className={inputClass}
          placeholder="開けたては固いが、30 分で果実味が開く"
        />
      </Field>

      <Field label="写真" hint="ラベルを残しておくと、あとで探しやすくなります">
        <PhotoInput name="photos" />
      </Field>

      <SubmitButton>{drink ? "更新する" : "記録する"}</SubmitButton>
    </form>
  );
}
