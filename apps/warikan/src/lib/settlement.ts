// 精算計算（純粋関数）。金額はすべて通貨の最小単位(minor units)の整数で扱う。

export interface SettlementMember {
  id: string;
  name: string;
}

export interface SettlementExpense {
  id: string;
  payerId: string;
  amount: number; // minor units
  participants: SettlementParticipant[]; // 割り勘対象
}

export interface SettlementParticipant {
  memberId: string;
  weight: number; // 傾斜の重み（src/lib/weight.ts）。全員同じなら均等割り
}

export interface Balance {
  memberId: string;
  paid: number; // 支払った総額
  owed: number; // 負担すべき総額
  net: number; // paid - owed (正=受け取る, 負=支払う)
}

export interface Transfer {
  fromId: string; // 支払う人
  toId: string; // 受け取る人
  amount: number;
}

// 立替 1 件のうち、メンバー 1 人が負担する額。精算結果の内訳に使う
export interface Share {
  expenseId: string;
  memberId: string;
  amount: number;
}

export interface SettlementResult {
  total: number;
  balances: Balance[];
  transfers: Transfer[];
  shares: Share[]; // 立替の入力順。負担額 0 の行も含む
}

// 金額 amount を n 人で均等割りし、余りを先頭から1単位ずつ配分した配列を返す。
// 合計は必ず amount と一致する。
export function splitEqually(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

// 金額 amount を重み weights の比で分けた配列を返す。合計は必ず amount と一致する。
// 端数は、切り捨てた余りの大きい人から 1 単位ずつ配る（同じなら先頭から）。
// 重みが全員同じなら splitEqually と同じ結果になる。
// 金額 × 重みは安全な整数の範囲を超えうるので BigInt で計算する。
export function splitByWeight(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  if (total <= 0n) return weights.map(() => 0);
  const a = BigInt(amount);
  const parts = weights.map((w, index) => {
    const product = a * BigInt(w);
    return { index, share: product / total, remainder: product % total };
  });
  let leftover = a - parts.reduce((sum, p) => sum + p.share, 0n);
  const byRemainder = [...parts].sort((x, y) =>
    x.remainder === y.remainder
      ? x.index - y.index
      : x.remainder > y.remainder
        ? -1
        : 1,
  );
  for (const p of byRemainder) {
    if (leftover <= 0n) break;
    p.share += 1n;
    leftover -= 1n;
  }
  return parts.map((p) => Number(p.share));
}

export function calculateSettlement(
  members: SettlementMember[],
  expenses: SettlementExpense[],
): SettlementResult {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const m of members) {
    paid.set(m.id, 0);
    owed.set(m.id, 0);
  }

  let total = 0;
  const shares: Share[] = [];
  for (const e of expenses) {
    total += e.amount;
    if (paid.has(e.payerId)) {
      paid.set(e.payerId, (paid.get(e.payerId) ?? 0) + e.amount);
    }
    const participants = e.participants.filter((p) => owed.has(p.memberId));
    const amounts = splitByWeight(
      e.amount,
      participants.map((p) => p.weight),
    );
    participants.forEach((p, i) => {
      owed.set(p.memberId, (owed.get(p.memberId) ?? 0) + amounts[i]);
      shares.push({ expenseId: e.id, memberId: p.memberId, amount: amounts[i] });
    });
  }

  const balances: Balance[] = members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    return { memberId: m.id, paid: p, owed: o, net: p - o };
  });

  const transfers = minimizeTransfers(balances);

  return { total, balances, transfers, shares };
}

// 貪欲法で送金回数を最小化する。最大の債務者と最大の債権者を順に相殺する。
export function minimizeTransfers(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.memberId, amount: b.net }));
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.memberId, amount: -b.net }));

  // 金額降順で安定した結果を得る
  creditors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  debtors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.amount, debt.amount);
    if (amount > 0) {
      transfers.push({ fromId: debt.id, toId: credit.id, amount });
    }
    credit.amount -= amount;
    debt.amount -= amount;
    if (credit.amount === 0) ci++;
    if (debt.amount === 0) di++;
  }

  return transfers;
}
