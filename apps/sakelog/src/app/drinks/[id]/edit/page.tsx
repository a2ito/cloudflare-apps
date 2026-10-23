import Link from "next/link";
import { notFound } from "next/navigation";
import { DrinkForm } from "@/components/drink-form";
import { getDb } from "@/db";
import { getDrink } from "@/db/queries";
import { requireUser } from "@/lib/auth";

export default async function EditDrinkPage({
  params,
}: PageProps<"/drinks/[id]/edit">) {
  await requireUser();
  const { id } = await params;
  const drinkId = Number(id);
  if (!Number.isInteger(drinkId)) notFound();

  const db = await getDb();
  const drink = await getDrink(db, drinkId);
  if (!drink) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/drinks/${drink.id}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← {drink.name}
      </Link>
      <h1 className="text-xl font-bold">記録を編集する</h1>
      {/* 写真は入力欄から追加するだけで、削除や並べ替えは詳細画面のビューアから行う */}
      <DrinkForm drink={drink} />
    </div>
  );
}
