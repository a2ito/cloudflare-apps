import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16 で next lint が廃止され、eslint を直接呼ぶようになった。
// FlatCompat 経由で eslint-config-next 16 を読むと循環参照でクラッシュするため、
// 設定を直接 import する。生成物は next lint が自動で外していたので明示する。
export default defineConfig([
  globalIgnores([
    ".next/**",
    ".cloudflare/**",
    ".vinext/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Next 16 で error に格上げされた React Compiler 由来のルール。
      // 指摘は妥当だが、直すと描画の流れが変わる。テストの無いアプリで
      // まとめて触ると壊れたことに気づけないため、いったん warn で受ける。
      // 1 アプリずつ直しては error に戻していく。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);
