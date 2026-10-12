import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getEnv(): Promise<CloudflareEnv> {
	const { env } = await getCloudflareContext({ async: true });
	return env;
}

/**
 * secret / var を読む。wrangler の型に無いキーでも process.env をフォールバックにする。
 */
export function readEnvString(env: CloudflareEnv, name: string): string | undefined {
	const fromBinding = (env as unknown as Record<string, unknown>)[name];
	if (typeof fromBinding === "string" && fromBinding !== "") return fromBinding;
	const fromProcess = process.env[name];
	return fromProcess && fromProcess !== "" ? fromProcess : undefined;
}

export function requireEnvString(env: CloudflareEnv, name: string): string {
	const value = readEnvString(env, name);
	if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
	return value;
}
