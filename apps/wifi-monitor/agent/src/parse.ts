/**
 * OS のコマンドの出力を読む。副作用の無い関数だけを置き、実際の出力をもとにした fixture でテストする。
 */

export type WifiInfo = {
  ssid: string | null;
  rssi: number | null;
  noise: number | null;
  txRateMbps: number | null;
};

export const NO_WIFI: WifiInfo = {
  ssid: null,
  rssi: null,
  noise: null,
  txRateMbps: null,
};

/** macOS は位置情報の権限が無いと SSID をこう伏せる */
function cleanSsid(raw: string | undefined | null): string | null {
  const ssid = raw?.trim() ?? "";
  if (ssid === "" || ssid === "<redacted>") return null;
  // 受信 API の上限（32 文字）を超えるものは壊れた値として捨てる
  return ssid.length <= 32 ? ssid : null;
}

function toInt(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/* ── macOS ─────────────────────────────────────────────────── */

type SystemProfilerJson = {
  SPAirPortDataType?: {
    spairport_airport_interfaces?: {
      _name?: string;
      spairport_current_network_information?: {
        _name?: string;
        spairport_network_rate?: number;
        spairport_signal_noise?: string;
      };
    }[];
  }[];
};

/**
 * `system_profiler SPAirPortDataType -json` を読む。
 * つながっているインタフェース（current_network_information に信号の値があるもの）を 1 つ選ぶ。
 */
export function parseSystemProfiler(
  json: unknown,
): (WifiInfo & { interface: string }) | null {
  const interfaces =
    (json as SystemProfilerJson).SPAirPortDataType?.[0]
      ?.spairport_airport_interfaces ?? [];
  for (const itf of interfaces) {
    const cur = itf.spairport_current_network_information;
    if (!cur?.spairport_signal_noise || !itf._name) continue;
    // 例: "-55 dBm / -92 dBm"
    const m = /(-?\d+)\s*dBm\s*\/\s*(-?\d+)\s*dBm/.exec(
      cur.spairport_signal_noise,
    );
    return {
      interface: itf._name,
      ssid: cleanSsid(cur._name),
      rssi: toInt(m?.[1]),
      noise: toInt(m?.[2]),
      txRateMbps:
        typeof cur.spairport_network_rate === "number"
          ? cur.spairport_network_rate
          : null,
    };
  }
  return null;
}

/**
 * `ipconfig getsummary <if>` から SSID を読む。
 * macOS 14.4 以降は、一度 `sudo ipconfig setverbose 1` しておくとここに SSID が出る
 * （system_profiler は位置情報の権限が無いと伏せ字になる）。
 */
export function parseIpconfigSsid(text: string): string | null {
  // "BSSID :" や "Hashed-BSSID :" を拾わないよう、行頭の空白に続く "SSID :" だけを見る
  const m = /^\s*SSID\s*:\s*(.+)$/m.exec(text);
  return cleanSsid(m?.[1]);
}

/* ── Linux ─────────────────────────────────────────────────── */

/** `iw dev` から無線のインタフェース名を拾う */
export function parseIwDev(text: string): string[] {
  return [...text.matchAll(/^\s*Interface\s+(\S+)/gm)].map((m) => m[1]!);
}

/**
 * `iw dev <if> link` を読む。つながっていなければ null。
 * ノイズは iw では取れないので常に null。
 */
export function parseIwLink(text: string): WifiInfo | null {
  if (!/^Connected to/m.test(text)) return null;
  return {
    ssid: cleanSsid(/^\s*SSID:\s*(.+)$/m.exec(text)?.[1]),
    rssi: toInt(/^\s*signal:\s*(-?\d+)\s*dBm/m.exec(text)?.[1]),
    noise: null,
    txRateMbps: toFloat(
      /^\s*tx bitrate:\s*([\d.]+)\s*MBit\/s/m.exec(text)?.[1],
    ),
  };
}

/* ── ping ──────────────────────────────────────────────────── */

export type PingResult = {
  latencyMs: number | null;
  packetLossPct: number | null;
};

/**
 * `ping -c N -q <宛先>` の要約を読む。macOS と Linux（iputils）の両方の形に対応する。
 *
 * - macOS: "5 packets transmitted, 5 packets received, 0.0% packet loss" / "round-trip min/avg/max/stddev = ..."
 * - Linux: "5 packets transmitted, 5 received, 0% packet loss, time 4005ms" / "rtt min/avg/max/mdev = ..."
 *
 * 全部失われたときは往復時間の行が無いので、遅延は null・損失は 100 になる。
 * 要約が読めない（名前解決の失敗など）ときは両方 null。
 */
export function parsePing(text: string): PingResult {
  const loss = toFloat(/([\d.]+)% packet loss/.exec(text)?.[1]);
  const avg = toFloat(
    /(?:round-trip|rtt) min\/avg\/max\/(?:stddev|mdev) = [\d.]+\/([\d.]+)\//.exec(
      text,
    )?.[1],
  );
  return { latencyMs: avg, packetLossPct: loss };
}
