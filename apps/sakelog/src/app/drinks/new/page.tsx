import Link from "next/link";
import { DrinkForm } from "@/components/drink-form";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "お酒を記録する | さけログ" };

export default async function NewDrinkPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 一覧
      </Link>
      <h1 className="text-xl font-bold">お酒を記録する</h1>
      <DrinkForm />
    </div>
  );
}
