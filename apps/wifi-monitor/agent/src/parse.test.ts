import { describe, expect, it } from "vitest";
import {
  unescapeIwSsid,
  parseIpconfigSsid,
  parseIwDev,
  parseIwLink,
  parsePing,
  parseSystemProfiler,
} from "./parse";

// SSID・BSSID はすべて架空の値（実機の出力の形だけを写している）

const profiler = (current: Record<string, unknown> | undefined) => ({
  SPAirPortDataType: [
    {
      spairport_airport_interfaces: [
        {
          _name: "en0",
          ...(current
            ? { spairport_current_network_information: current }
            : {}),
        },
        {
          _name: "awdl0",
          spairport_current_network_information: {
            spairport_network_type: "spairport_network_type_station",
          },
        },
      ],
    },
  ],
});

describe("parseSystemProfiler（macOS）", () => {
  it("つながっているインタフェースの SSID・受信強度・ノイズ・リンク速度を読む", () => {
    expect(
      parseSystemProfiler(
        profiler({
          _name: "home-5G",
          spairport_network_channel: "44 (5GHz, 160MHz)",
          spairport_network_phymode: "802.11ax",
          spairport_network_rate: 2401,
          spairport_signal_noise: "-55 dBm / -93 dBm",
        }),
      ),
    ).toEqual({
      interface: "en0",
      ssid: "home-5G",
      rssi: -55,
      noise: -93,
      txRateMbps: 2401,
    });
  });

  it("位置情報の権限が無く SSID が伏せ字なら、SSID だけ null にする", () => {
    expect(
      parseSystemProfiler(
        profiler({
          _name: "<redacted>",
          spairport_network_rate: 866,
          spairport_signal_noise: "-60 dBm / -90 dBm",
        }),
      ),
    ).toMatchObject({ interface: "en0", ssid: null, rssi: -60 });
  });

  it("Wi-Fi につながっていなければ null（awdl0 のような信号の無いものは選ばない）", () => {
    expect(parseSystemProfiler(profiler(undefined))).toBeNull();
  });

  it("形が違う JSON でも落ちずに null", () => {
    expect(parseSystemProfiler({})).toBeNull();
    expect(parseSystemProfiler({ SPAirPortDataType: [] })).toBeNull();
  });
});

describe("parseIpconfigSsid（macOS）", () => {
  const summary = (ssidLine: string) =>
    [
      "<dictionary> {",
      "  BSSID : 02:00:00:00:00:01",
      "  Hashed-BSSID : 0a:1b:2c:3d:4e:5f",
      "  InterfaceType : WiFi",
      ssidLine,
      "  Security : WPA2_PSK",
      "}",
    ].join("\n");

  it("SSID の行を読む（BSSID の行は拾わない）", () => {
    expect(parseIpconfigSsid(summary("  SSID : cafe free wifi"))).toBe(
      "cafe free wifi",
    );
  });

  it("伏せ字や SSID の行が無いときは null", () => {
    expect(parseIpconfigSsid(summary("  SSID : <redacted>"))).toBeNull();
    expect(parseIpconfigSsid(summary(""))).toBeNull();
  });
});

describe("parseIwDev / parseIwLink（Linux）", () => {
  it("無線のインタフェース名を拾う", () => {
    expect(
      parseIwDev(
        [
          "phy#0",
          "\tInterface wlan0",
          "\t\tifindex 3",
          "\t\ttype managed",
          "phy#1",
          "\tInterface wlx001122334455",
        ].join("\n"),
      ),
    ).toEqual(["wlan0", "wlx001122334455"]);
  });

  it("SSID・受信強度・送信のビットレートを読む（ノイズは取れない）", () => {
    expect(
      parseIwLink(
        [
          "Connected to 02:00:00:00:00:01 (on wlan0)",
          "\tSSID: home-5G",
          "\tfreq: 5180",
          "\tRX: 123456 bytes (789 packets)",
          "\tTX: 23456 bytes (123 packets)",
          "\tsignal: -58 dBm",
          "\trx bitrate: 433.3 MBit/s VHT-MCS 9 80MHz short GI",
          "\ttx bitrate: 390.0 MBit/s VHT-MCS 8 80MHz short GI",
        ].join("\n"),
      ),
    ).toEqual({ ssid: "home-5G", rssi: -58, noise: null, txRateMbps: 390 });
  });

  it("つながっていなければ null", () => {
    expect(parseIwLink("Not connected.\n")).toBeNull();
  });

  it("iw がエスケープした日本語の SSID を UTF-8 に戻す（macOS の端末と同じネットワークになるように）", () => {
    // 「おうちのWiFi」を iw が出す形にしたもの
    const escaped = [...new TextEncoder().encode("おうちのWiFi")]
      .map((b) =>
        b < 0x80
          ? String.fromCharCode(b)
          : `\\x${b.toString(16).padStart(2, "0")}`,
      )
      .join("");
    expect(
      parseIwLink(
        [
          "Connected to 02:00:00:00:00:01 (on wlan0)",
          `\tSSID: ${escaped}`,
          "\tsignal: -60 dBm",
        ].join("\n"),
      )?.ssid,
    ).toBe("おうちのWiFi");
  });

  it("エスケープされた空白とバックスラッシュも戻す", () => {
    expect(unescapeIwSsid("\\x20cafe\\x5cwifi\\x20")).toBe(" cafe\\wifi ");
  });
});

describe("parsePing", () => {
  it("macOS の要約を読む", () => {
    expect(
      parsePing(
        [
          "PING 1.1.1.1 (1.1.1.1): 56 data bytes",
          "",
          "--- 1.1.1.1 ping statistics ---",
          "5 packets transmitted, 4 packets received, 20.0% packet loss",
          "round-trip min/avg/max/stddev = 19.823/22.775/28.386/3.969 ms",
        ].join("\n"),
      ),
    ).toEqual({ latencyMs: 22.775, packetLossPct: 20 });
  });

  it("Linux（iputils）の要約を読む", () => {
    expect(
      parsePing(
        [
          "--- 1.1.1.1 ping statistics ---",
          "5 packets transmitted, 5 received, 0% packet loss, time 4006ms",
          "rtt min/avg/max/mdev = 10.123/12.456/15.789/1.234 ms",
        ].join("\n"),
      ),
    ).toEqual({ latencyMs: 12.456, packetLossPct: 0 });
  });

  it("iputils の +N errors 付きの要約も読む", () => {
    expect(
      parsePing(
        [
          "5 packets transmitted, 3 received, +2 errors, 40% packet loss, time 4005ms",
          "rtt min/avg/max/mdev = 10.0/20.5/30.0/5.0 ms",
        ].join("\n"),
      ),
    ).toEqual({ latencyMs: 20.5, packetLossPct: 40 });
  });

  it("busybox の要約（stddev が無い）も読む", () => {
    expect(
      parsePing(
        [
          "5 packets transmitted, 5 packets received, 0% packet loss",
          "round-trip min/avg/max = 9.876/11.234/13.579 ms",
        ].join("\n"),
      ),
    ).toEqual({ latencyMs: 11.234, packetLossPct: 0 });
  });

  it("全部失われたら遅延は null・損失は 100", () => {
    expect(
      parsePing(
        "5 packets transmitted, 0 packets received, 100.0% packet loss\n",
      ),
    ).toEqual({ latencyMs: null, packetLossPct: 100 });
  });

  it("要約が無い（名前解決の失敗など）ときは両方 null", () => {
    expect(
      parsePing("ping: cannot resolve example.invalid: Unknown host"),
    ).toEqual({ latencyMs: null, packetLossPct: null });
  });
});
