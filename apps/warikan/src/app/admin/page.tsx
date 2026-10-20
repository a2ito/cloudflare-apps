import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { formatDateTime, summarizeGroups } from "@/lib/admin-summary";
import { AdminHeader } from "./AdminHeader";

export default async function AdminPage() {
  const { email } = await requireAdmin();
  const db = getDb();

  const [groups, members, expenses, rates] = await Promise.all([
    db.query.groups.findMany(),
    db.query.members.findMany({ columns: { groupId: true } }),
    db.query.expenses.findMany({
      columns: { groupId: true, amount: true, currency: true, createdAt: true },
    }),
    db.query.exchangeRates.findMany({
      columns: { groupId: true, currency: true, rate: true },
    }),
  ]);
  const rows = summarizeGroups(groups, members, expenses, rates);

  return (
    <div className="space-y-6">
      <AdminHeader email={email} />

      <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5">
        <h2 className="font-semibold mb-3">グループ（{rows.length} 件）</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-black/40">グループはまだありません。</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/admin/g/${g.id}`}
                  className="block rounded-lg border border-black/5 px-3 py-2.5 hover:border-emerald-500/40 hover:bg-emerald-50/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-xs text-black/50">
                        作成 {formatDateTime(g.createdAt)}
                        {g.lastExpenseAt &&
                          `・最終記録 ${formatDateTime(g.lastExpenseAt)}`}
                      </div>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      <div className="font-bold">
                        {formatAmount(g.total, g.currency)}
                      </div>
                      <div className="text-xs text-black/50">
                        メンバー {g.memberCount} 人・立替 {g.expenseCount} 件
                      </div>
                      {g.unconvertedCount > 0 && (
                        <div className="text-xs text-amber-600">
                          レート未設定 {g.unconvertedCount} 件は合計外
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
