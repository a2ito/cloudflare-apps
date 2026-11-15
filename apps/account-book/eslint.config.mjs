import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  // next lint が暗黙に除外していたビルド成果物を明示的に除外する
  {
    ignores: [
      ".next/**",
      ".cloudflare/**",
      ".vinext/**",
      "dist/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // eslint-config-next 16 で追加されたルール。既存コードが引っかかるため
      // 依存更新では警告に留め、コード側の対応は別途行う
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
