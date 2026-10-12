// wrangler.jsonc は実 ID と公開ホスト名を含むため追跡していない。
// CI やビルド環境では、雛形のプレースホルダを環境変数の値で埋めて生成する。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TEMPLATE = "wrangler.jsonc.example";
const OUTPUT = "wrangler.jsonc";

const PLACEHOLDERS = {
	__D1_DATABASE_ID__: "D1_DATABASE_ID",
	__APP_HOSTNAME__: "APP_HOSTNAME",
};

// 手元に本物の設定がある場合は触らない
if (existsSync(OUTPUT)) {
	console.log(`${OUTPUT} が既にあるため生成をスキップします`);
	process.exit(0);
}

let config = readFileSync(TEMPLATE, "utf8");
const missing = [];

for (const [placeholder, envName] of Object.entries(PLACEHOLDERS)) {
	const value = process.env[envName];
	if (!value) {
		missing.push(envName);
		continue;
	}
	config = config.replaceAll(placeholder, value);
}

if (missing.length > 0) {
	console.error(`環境変数が未設定です: ${missing.join(", ")}`);
	process.exit(1);
}

const leftover = Object.keys(PLACEHOLDERS).filter((p) => config.includes(p));
if (leftover.length > 0) {
	console.error(`置換されていないプレースホルダがあります: ${leftover.join(", ")}`);
	process.exit(1);
}

writeFileSync(OUTPUT, config);
console.log(`${OUTPUT} を生成しました`);
