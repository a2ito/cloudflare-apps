/**
 * Worker の env（バインディング）を返す。
 *
 * `cloudflare:workers` は workerd の中でしか解決できない。テストでは vitest.config.mts の
 * alias で src/test/cloudflare-workers.ts に差し替わり、触ると投げる env が返る。
 */
export async function getEnv(): Promise<Env> {
  const { env } = await import("cloudflare:workers");
  return env as Env;
}

/**
 * secret / var を読む。生成した Env の型に無いキーでも process.env をフォールバックにする。
 */
export function readEnvString(env: Env, name: string): string | undefined {
  const fromBinding = (env as unknown as Record<string, unknown>)[name];
  if (typeof fromBinding === "string" && fromBinding !== "") return fromBinding;
  const fromProcess = process.env[name];
  return fromProcess && fromProcess !== "" ? fromProcess : undefined;
}

export function requireEnvString(env: Env, name: string): string {
  const value = readEnvString(env, name);
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}
