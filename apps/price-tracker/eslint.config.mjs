import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    ".open-next/**",
    ".wrangler/**",
    ".next/**",
    "drizzle/**",
    "cloudflare-env.d.ts",
    "next-env.d.ts",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 画像は R2 から自前の Route Handler 経由で配信するため next/image は使わない
      "@next/next/no-img-element": "off",
    },
  },
]);
