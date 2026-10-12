// Next.js 16.4 から、サーバーの起動時に .next/server/preview-props.json を読むようになった。
// @opennextjs/cloudflare（1.20.10 時点）はビルド時に manifest を Worker へ埋め込むが、
// 対象を glob の `*-manifest.json` などで拾っていて preview-props.json が漏れる。
// そのため起動時に `Unexpected loadManifest(/.next/server/preview-props.json) call!` で落ち、
// 全リクエストが Error 1101 になる。
//
// upstream の修正（opennextjs/opennextjs-cloudflare#1356、issue #1355）と同じく glob に足す。
// 修正入りの版が出たら、このスクリプトと cf:build の呼び出しを消す。
//
// Workers Builds は毎回 npm ci から始まるので、ビルドの直前に node_modules を書き換える。
// 何度流してもよい（既に足してあれば何もしない）。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const RELATIVE = "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js";
const BEFORE = "{*-manifest,required-server-files,prefetch-hints}.json";
const AFTER = "{*-manifest,required-server-files,prefetch-hints,preview-props}.json";

/** カレントディレクトリから上へたどり、ホイストされた node_modules も探す */
function findTarget(dir) {
	const candidate = join(dir, RELATIVE);
	if (existsSync(candidate)) return candidate;
	const parent = dirname(dir);
	return parent === dir ? null : findTarget(parent);
}

const target = findTarget(process.cwd());
if (!target) {
	console.error(`${RELATIVE} が見つかりません。npm ci を済ませてから実行してください`);
	process.exit(1);
}

const source = readFileSync(target, "utf8");
if (source.includes("preview-props")) {
	console.log("preview-props.json は既に埋め込み対象に入っています（upstream で対応済みか、適用済み）");
	process.exit(0);
}
if (!source.includes(BEFORE)) {
	// 版が変わって置き換え先が無くなった。黙って進むと本番で 1101 になるので止める
	console.error(`${target} に想定した glob（${BEFORE}）がありません。@opennextjs/cloudflare の版を確認してください`);
	process.exit(1);
}

writeFileSync(target, source.replace(BEFORE, AFTER));
console.log(`preview-props.json を manifest の埋め込み対象に足しました: ${target}`);
