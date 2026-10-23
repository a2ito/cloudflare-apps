import Link from "next/link";
import { getDb } from "@/db";
import { countByCategory } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { CATEGORY_DEFS, SPECIFIC_FIELDS } from "@/lib/categories";

export const metadata = {
  title: "お酒のガイド | さけログ",
  description: "種類ごとの成り立ちと、品種・ホップ・酒米・ボタニカルの特性",
};

/**
 * お酒のガイド。
 *
 * 「この品種はどんな味だったか」を思い出せないまま記録するのを避けるための画面。
 * 内容は src/lib/categories.ts の定義そのもので、入力欄の候補と同じものを出している
 * （解説を別に持つと、候補を足したときに片方だけ古くなる）。
 */
export default async function GuidePage() {
  await requireUser();

  // 記録のある種類を先に見たいので、件数を添えて並べ替える
  const db = await getDb();
  const counts = await countByCategory(db);
  const defs = [...CATEGORY_DEFS].sort(
    (a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0),
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 一覧
        </Link>
        <h1 className="text-xl font-bold">お酒のガイド</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          記録するときの手がかりに。味の感じ方は状態や温度でも変わるので、あくまで目安でっす。
        </p>
      </div>

      {/* 見たい種類へすぐ飛べるように、先頭に目次を置く */}
      <nav className="flex flex-wrap gap-2">
        {defs.map((def) => (
          <a
            key={def.key}
            href={`#${def.key}`}
            className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-sky-400 dark:border-zinc-700 dark:text-zinc-300"
          >
            {def.emoji} {def.label}
          </a>
        ))}
      </nav>

      {defs.map((def) => (
        <section
          key={def.key}
          id={def.key}
          className="scroll-mt-4 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">
                {def.emoji} {def.label}
              </h2>
              <Link
                href={`/?category=${def.key}`}
                className="text-sm text-sky-600 hover:underline dark:text-sky-400"
              >
                この種類の記録（{counts.get(def.key) ?? 0}）
              </Link>
            </div>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {def.description}
            </p>
          </div>

          {def.styles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                分類
              </h3>
              <TermList terms={def.styles} />
            </div>
          )}

          {def.ingredients.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                {def.ingredientLabel}
              </h3>
              <TermList terms={def.ingredients} />
            </div>
          )}

          {def.fields.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                数字の読み方
              </h3>
              <TermList
                terms={def.fields.map((field) => ({
                  name: SPECIFIC_FIELDS[field].label,
                  note: SPECIFIC_FIELDS[field].note,
                }))}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function TermList({
  terms,
}: {
  terms: readonly { name: string; note: string }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {terms.map((term) => (
        <div
          key={term.name}
          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <dt className="text-sm font-semibold">{term.name}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {term.note}
          </dd>
        </div>
      ))}
    </dl>
  );
}
