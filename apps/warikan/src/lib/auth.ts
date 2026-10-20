import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";

// Secret は wrangler の型に出てこないので、名前で引く。手元の next dev では .dev.vars か process.env から読む
async function readEnv(name: string): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const fromBinding = (env as unknown as Record<string, unknown>)[name];
  if (typeof fromBinding === "string" && fromBinding !== "") return fromBinding;
  const fromProcess = process.env[name];
  return fromProcess && fromProcess !== "" ? fromProcess : undefined;
}

async function requireEnv(name: string): Promise<string> {
  const value = await readEnv(name);
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}

async function allowedEmails(): Promise<ReadonlySet<string>> {
  return parseAllowedEmails(await readEnv("ALLOWED_EMAILS"));
}

async function buildConfig(): Promise<NextAuthConfig> {
  const allowed = await allowedEmails();
  return {
    secret: await requireEnv("AUTH_SECRET"),
    trustHost: true,
    session: { strategy: "jwt" },
    pages: { signIn: "/admin/login", error: "/admin/login" },
    providers: [
      Google({
        clientId: await requireEnv("AUTH_GOOGLE_ID"),
        clientSecret: await requireEnv("AUTH_GOOGLE_SECRET"),
      }),
    ],
    callbacks: {
      // 許可リストに載っている Google アカウントだけログインさせる
      signIn({ profile, user }) {
        return isSignInAllowed(
          {
            email: profile?.email ?? user.email,
            emailVerified: profile?.email_verified,
          },
          allowed,
        );
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildConfig);

/**
 * 管理者としてログインしていなければ /admin/login へ送る。
 * ログイン時だけでなく毎回許可リストを見るのは、ALLOWED_EMAILS から外した人の
 * セッションを、期限切れを待たずに無効にするため。
 */
export async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/admin/login");
  if (!isSignInAllowed({ email }, await allowedEmails())) {
    redirect("/admin/login?error=AccessDenied");
  }
  return { email };
}
