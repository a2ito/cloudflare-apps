"use client";

import { useId, useRef } from "react";
import { pickerStartDate } from "@/lib/fuzzy-date";
import { inputClass } from "./ui";

/**
 * 年月日をカレンダーから選べる入力欄。
 * 年だけ・年月だけも持てるようにテキスト欄は残し、横のボタンでブラウザ標準のカレンダーを開く。
 * 選んだ日付はテキスト欄に書き込む（送るのはテキスト欄だけ）
 */
export function DateField({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const id = useId();
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const text = textRef.current;
    const picker = pickerRef.current;
    if (!text || !picker) return;
    picker.value = pickerStartDate(text.value);
    try {
      picker.showPicker();
    } catch {
      // showPicker が無い・使えない環境。タップは重ねた日付欄に直接当たり、標準の動きで開くので何もしない
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-zinc-500">
        {label}
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          ref={textRef}
          name={name}
          placeholder={placeholder}
          maxLength={10}
          defaultValue={defaultValue}
          className={inputClass}
        />
        <div className="relative shrink-0">
          {/* キーボード操作用。マウスやタップは上に重ねた日付欄が受ける */}
          <button
            type="button"
            onClick={openPicker}
            aria-label={`${label}をカレンダーから選ぶ`}
            title="カレンダーから選ぶ"
            className="h-full rounded-md border border-zinc-300 px-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            📅
          </button>
          {/*
            カレンダーを出すための日付欄。ボタンに透明で重ね、タップを直接受けさせる。
            iOS Safari などは showPicker が無くても、日付欄そのものへのタップならカレンダーが開く
          */}
          <input
            ref={pickerRef}
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            tabIndex={-1}
            aria-hidden
            onClick={openPicker}
            onChange={(e) => {
              if (textRef.current && e.target.value)
                textRef.current.value = e.target.value;
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
}
