# wifi-monitor エージェント

端末で常駐して Wi-Fi の通信状況を 1 分ごとに計測し、wifi-monitor（`POST /api/samples`）に送るプログラム。
macOS と Linux で動く。

## 計測するもの

| 項目                 | macOS                                                      | Linux                |
| -------------------- | ---------------------------------------------------------- | -------------------- |
| SSID                 | `system_profiler`。伏せ字なら `ipconfig getsummary`        | `iw dev <if> link`   |
| 受信強度・リンク速度 | `system_profiler SPAirPortDataType -json`                  | `iw dev <if> link`   |
| ノイズ               | `system_profiler`                                          | 取れない（空で送る） |
| 遅延・パケット損失   | `ping -c 5 -q 1.1.1.1`                                     | 同左                 |
| ダウンロード速度     | 1 時間ごとに `speed.cloudflare.com` から 10MB 落として計る | 同左                 |

取れなかった値は空で送る。Wi-Fi につながっていない（有線など）ときも、遅延と損失は送る。

## しくみ

- 計測はまずローカルのキュー（`queue.jsonl`）に書いてから送る。回線が切れている間の計測は貯めておき、
  つながったら 300 件ずつまとめて送る（受信 API の上限）。貯めるのは 5 万件（約 1 か月分）まで
- 送れなかったときの扱い
  - 回線断・サーバの 5xx … キューに残して次の回に送り直す
  - 400 / 413（形が違う）… そのまとまりを捨ててログに出す。同じまとまりで止まり続けないため
  - 401（トークンが違う）… 送るのをやめてログに出す。計測は貯め続けるので、トークンを直して再起動すれば送られる
- 送る前に、受信 API と同じスキーマ（`../src/lib/sample-schema.ts`）で形を確かめる

## 入れ方

前提は Node.js 24 以上（設定ファイルを `node --env-file` で読むため）。

### 1. ビルドして置く

```sh
# リポジトリ直下で npm ci したあと、apps/wifi-monitor で
npm run agent:build
mkdir -p ~/.local/lib/wifi-monitor
cp agent/dist/wifi-monitor-agent.mjs ~/.local/lib/wifi-monitor/
```

できあがるのは依存を全部まとめた 1 ファイルなので、別の端末にはこのファイルだけをコピーすればよい。

### 2. 設定を書く

wifi-monitor の画面で端末を登録し、表示されたトークンを控える（トークンはその場でしか表示されない）。

```sh
mkdir -p ~/.config/wifi-monitor
cp agent/agent.env.example ~/.config/wifi-monitor/agent.env
chmod 600 ~/.config/wifi-monitor/agent.env
# WIFI_MONITOR_TOKEN を書く。ほかの項目は空欄なら既定値
```

手で 1 回動かして、ログに「起動しました」と出て、wifi-monitor の画面に計測が届くことを確かめる（Ctrl-C で止める）。

```sh
node --env-file="$HOME/.config/wifi-monitor/agent.env" ~/.local/lib/wifi-monitor/wifi-monitor-agent.mjs
```

### 3a. 常駐させる（macOS）

```sh
sed -e "s#__NODE__#$(which node)#" -e "s#__HOME__#$HOME#g" \
  agent/launchd/work.a2ito.wifi-monitor-agent.plist \
  > ~/Library/LaunchAgents/work.a2ito.wifi-monitor-agent.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/work.a2ito.wifi-monitor-agent.plist
```

ログは `~/Library/Logs/wifi-monitor-agent.log`。止めるときは `launchctl bootout "gui/$(id -u)/work.a2ito.wifi-monitor-agent"`。

**SSID が届かないとき**（画面で SSID が空、ネットワークが増えない）: macOS 14.4 以降は、位置情報の権限が無いプログラムには
SSID が伏せ字で返る。一度だけ次を流すと、`ipconfig getsummary` に SSID が出るようになり、エージェントはそこから読む。

```sh
sudo ipconfig setverbose 1
```

OS の再起動のあとも効き続けるかは確かめていない。届かなくなったら、もう一度流す。

### 3b. 常駐させる（Linux）

```sh
mkdir -p ~/.config/systemd/user
cp agent/systemd/wifi-monitor-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now wifi-monitor-agent
# ログインしていない間も動かすなら（Raspberry Pi など）
sudo loginctl enable-linger "$USER"
```

ログは `journalctl --user -u wifi-monitor-agent -f`。`iw` が無ければ入れる（Debian 系なら `sudo apt install iw`）。

## 更新

`npm run agent:build` で作り直したファイルを同じ場所にコピーし、再起動する
（macOS は `launchctl kickstart -k "gui/$(id -u)/work.a2ito.wifi-monitor-agent"`、
Linux は `systemctl --user restart wifi-monitor-agent`）。貯まっている計測はキューのファイルに残っているので失われない。

## 開発

- コードは `agent/src/`。コマンドの出力の読み取り（`parse.ts`）は副作用の無い関数に分け、実機の出力の形を写した
  fixture でテストしている。**fixture の SSID・BSSID は架空の値にする**（リポジトリは公開）
- テストはアプリと一緒に `npm test` で流れる（`vitest.config.mts` の `include` に `agent/src` を入れている）
