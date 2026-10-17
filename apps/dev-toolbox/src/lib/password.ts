export type PasswordOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUM = "0123456789";
const SYM = "!@#$%^&*()-_=+[]{};:,.<>?/";

export function generatePassword(options: PasswordOptions): string {
  const pools = [
    options.lowercase && LOWER,
    options.uppercase && UPPER,
    options.numbers && NUM,
    options.symbols && SYM,
  ].filter(Boolean) as string[];

  if (pools.length === 0) return "";

  const chars = pools.join("");

  return Array.from(
    { length: options.length },
    () => chars[randomIndex(chars.length)],
  ).join("");
}

const UINT32_RANGE = 2 ** 32;

/**
 * 0 以上 size 未満の一様な乱数。32 bit の乱数をそのまま size で割った余りにすると、
 * 2^32 が size で割り切れない分だけ小さい値が出やすくなる（剰余バイアス）。
 * 割り切れる範囲を超えた値は捨てて引き直す
 */
function randomIndex(size: number): number {
  const limit = UINT32_RANGE - (UINT32_RANGE % size);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % size;
  }
}
