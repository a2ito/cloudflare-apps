import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatAmount, getCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/admin-summary";
import { loadGroupData } from "@/lib/group-data";
import { formatWeight, DEFAULT_WEIGHT } from "@/lib/weight";
import { AdminHeader } from "../../AdminHeader";
import { deleteGroup } from "../../actions";
import { DeleteGroupButton } from "./DeleteGroupButton";

const card = "bg-white rounded-2xl shadow-sm border border-black/5 p-5";

// 管理者がグループの中身を確かめる画面。編集はさせず、削除だけできる
export default async function AdminGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { email } = await requireAdmin();
  const { id } = await params;
  const data = await loadGroupData(id);
  if (!data) notFound();
  const {
    group,
    members,
    expenses,
    participantsByExpense,
    rates,
    baseAmountById,
    settlement,
  } = data;

  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const nameOf = (memberId: string) => memberName.get(memberId) ?? "?";
  const currency = getCurrency(group.currency);
  const balanceByMember = new Map(
    settlement.balances.map((b) => [b.memberId, b]),
  );

  return (
    <div className="space-y-6">
      <AdminHeader email={email} />
      <Link href="/admin" className="text-sm text-emerald-600 hover:underline">
        ← グループ一覧
      </Link>

      <section className={`${card} space-y-2`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{group.name}</h2>
          <span className="shrink-0 text-xs font-medium text-black/50 border border-black/10 rounded-full px-2.5 py-1">
            精算 {currency.symbol} {currency.code}
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-black/50">作成</dt>
          <dd>{formatDateTime(group.createdAt)}</dd>
          <dt className="text-black/50">合計</dt>
          <dd>
            {formatAmount(settlement.total, group.currency)}・立替{" "}
            {expenses.length} 件・メンバー {members.length} 人
          </dd>
          <dt className="text-black/50">公開ページ</dt>
          <dd className="min-w-0">
            <Link
              href={`/g/${group.id}`}
              className="text-emerald-600 hover:underline break-all"
            >
              /g/{group.id}
            </Link>
          </dd>
        </dl>
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-3">メンバー</h2>
        {members.length === 0 ? (
          <p className="text-sm text-black/40">メンバーはいません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-black/50">
                <tr className="text-left">
                  <th className="font-normal py-1.5">名前</th>
                  <th className="font-normal py-1.5 text-right">支払</th>
                  <th className="font-normal py-1.5 text-right">負担</th>
                  <th className="font-normal py-1.5 text-right">差額</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const b = balanceByMember.get(m.id);
                  const net = b?.net ?? 0;
                  return (
                    <tr key={m.id} className="border-t border-black/5">
                      <td className="py-1.5 font-medium">{m.name}</td>
                      <td className="py-1.5 text-right">
                        {formatAmount(b?.paid ?? 0, group.currency)}
                      </td>
                      <td className="py-1.5 text-right">
                        {formatAmount(b?.owed ?? 0, group.currency)}
                      </td>
                      <td
                        className={
                          "py-1.5 text-right " +
                          (net > 0
                            ? "text-emerald-600"
                            : net < 0
                              ? "text-rose-500"
                              : "")
                        }
                      >
                        {(net > 0 ? "+" : "") +
                          formatAmount(net, group.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-3">立替</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-black/40">立替はありません。</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((e) => {
              const baseAmount = baseAmountById.get(e.id);
              const participants = participantsByExpense.get(e.id) ?? [];
              const weighted = participants.some(
                (p) => p.weight !== DEFAULT_WEIGHT,
              );
              return (
                <li
                  key={e.id}
                  className="rounded-lg border border-black/5 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {e.description || "（内容なし）"}
                      </div>
                      <div className="text-xs text-black/50">
                        {nameOf(e.payerId)} が立替・
                        {participants
                          .map((p) =>
                            weighted
                              ? `${nameOf(p.memberId)}×${formatWeight(p.weight)}`
                              : nameOf(p.memberId),
                          )
                          .join("、")}{" "}
                        で割り勘
                      </div>
                      <div className="text-xs text-black/40">
                        {formatDateTime(e.createdAt)}
                      </div>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      <div className="font-bold">
                        {formatAmount(e.amount, e.currency)}
                      </div>
                      {e.currency !== group.currency && (
                        <div className="text-xs text-black/50">
                          {baseAmount == null
                            ? "レート未設定"
                            : `≈ ${formatAmount(baseAmount, group.currency)}`}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-3">通貨と為替レート</h2>
        {rates.length === 0 ? (
          <p className="text-sm text-black/40">
            精算通貨（{group.currency}）のみです。
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {rates.map((r) => (
              <li
                key={r.currency}
                className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2"
              >
                <span className="font-medium">{r.currency}</span>
                <span>
                  {r.rate
                    ? `1 ${r.currency} = ${r.rate} ${group.currency}`
                    : "レート未設定"}
                </span>
                <span className="ml-auto text-xs text-black/50">
                  {r.rateSource === "manual"
                    ? "手入力"
                    : `自動取得${r.rateDate ? `（${r.rateDate} 時点）` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-3">精算結果</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-black/40">立替がないため精算はありません。</p>
        ) : settlement.transfers.length === 0 ? (
          <p className="text-sm text-black/60">精算の必要はありません。</p>
        ) : (
          <ul className="space-y-2">
            {settlement.transfers.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-sm"
              >
                <span className="font-medium">{nameOf(t.fromId)}</span>
                <span className="text-emerald-600">→</span>
                <span className="font-medium">{nameOf(t.toId)}</span>
                <span className="ml-auto font-bold text-emerald-700">
                  {formatAmount(t.amount, group.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} border-rose-200`}>
        <h2 className="font-semibold mb-1 text-rose-600">グループを削除</h2>
        <p className="text-sm text-black/60 mb-3">
          メンバー・立替・為替レートもまとめて消えます。元に戻せません。
          公開ページの URL も開けなくなります。
        </p>
        <DeleteGroupButton
          groupName={group.name}
          deleteAction={deleteGroup.bind(null, group.id)}
        />
      </section>
    </div>
  );
}
