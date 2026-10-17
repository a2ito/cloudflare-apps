/**
 * OGP チェッカーのように、利用者が入れた URL をサーバーから取りに行くときの行き先の制限。
 * 公開された Web ページだけを許し、サーバー自身や社内向けのアドレスへ向けさせない（SSRF 対策）。
 *
 * ホスト名を DNS で引いた先までは確かめられないので、IP アドレスを直接書いた URL と、
 * 内部向けと決まっている名前だけを弾く。Workers の fetch はもともと私設網に届かないため、
 * ここは主に localhost やクラウドのメタデータのアドレスを狙った入力への備え。
 */

export type OutboundUrlCheck =
  { ok: true; url: URL } | { ok: false; reason: string };

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
];

export function checkOutboundUrl(raw: string): OutboundUrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL format" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs are allowed" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials are not allowed" };
  }

  // URL は IPv6 を [] 付きで、末尾の . を残したまま返す
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return { ok: false, reason: "Internal hosts are not allowed" };
  }
  if (host.startsWith("[")) {
    if (isBlockedIpv6(host.slice(1, -1))) {
      return {
        ok: false,
        reason: "Private or reserved IP addresses are not allowed",
      };
    }
  } else if (isBlockedIpv4(host)) {
    return {
      ok: false,
      reason: "Private or reserved IP addresses are not allowed",
    };
  }
  return { ok: true, url };
}

/** URL が正規化した IPv4（10 進の 4 つ組）なら、私設・予約済みの範囲かを返す。名前なら false */
function isBlockedIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // ループバック
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    (a === 169 && b === 254) || // リンクローカル（クラウドのメタデータを含む）
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 192 && b === 0 && Number(m[3]) === 0) || // 192.0.0.0/24
    (a === 198 && (b === 18 || b === 19)) || // ベンチマーク用 198.18.0.0/15
    a >= 224 // マルチキャストと予約済み
  );
}

function isBlockedIpv6(host: string): boolean {
  if (host === "::" || host === "::1") return true;
  // IPv4 射影（::ffff:a.b.c.d）。URL は ::ffff:7f00:1 のように 16 進で返すので両方見る
  const mapped =
    /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(
      host,
    );
  if (mapped) {
    if (mapped[1]) return isBlockedIpv4(mapped[1]);
    const hi = parseInt(mapped[2], 16);
    const lo = parseInt(mapped[3], 16);
    return isBlockedIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const first = parseInt(host.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // ユニークローカル fc00::/7
    (first & 0xffc0) === 0xfe80 || // リンクローカル fe80::/10
    (first & 0xff00) === 0xff00 // マルチキャスト
  );
}
