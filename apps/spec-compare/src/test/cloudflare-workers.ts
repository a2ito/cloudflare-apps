/**
 * テスト用の `cloudflare:workers`。vitest.config.mts の alias で差し替える。
 *
 * 本物は workerd の中でしか解決できない。テストは Worker の外として扱うので、
 * env のプロパティに触れた時点で投げる。Worker の中として振る舞わせたいテストは vi.mock で差し替える。
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, key) {
    throw new Error(
      `cloudflare:workers の env.${String(key)} は Worker の外では読めません`,
    );
  },
});
