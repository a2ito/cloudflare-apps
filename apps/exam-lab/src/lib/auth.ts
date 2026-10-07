import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { getDB } from "@/db";
import { users } from "@/db/schema";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";
import { getEnv, readEnvString, requireEnvString } from "./cloudflare";

async function buildConfig(): Promise<NextAuthConfig> {
  const env = await getEnv();
  const allowed = parseAllowedEmails(readEnvString(env, "ALLOWED_EMAILS"));

  return {
    secret: requireEnvString(env, "AUTH_SECRET"),
    trustHost: true,
    session: { strategy: "jwt" },
    // ログイン画面はトップページ
    pages: { signIn: "/", error: "/" },
    providers: [
      Google({
        clientId: requireEnvString(env, "AUTH_GOOGLE_ID"),
        clientSecret: requireEnvString(env, "AUTH_GOOGLE_SECRET"),
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
      // users.id は Google の sub（以前の ID トークン方式で作った行と揃える）。
      // ログイン時にだけ users 行を作り、以降は JWT に載せた id を使う（毎リクエストの書き込みを避ける）
      async jwt({ token, profile }) {
        if (profile?.sub && profile.email) {
          await getDB()
            .insert(users)
            .values({
              id: profile.sub,
              email: profile.email,
              name: profile.name ?? null,
              picture:
                typeof profile.picture === "string" ? profile.picture : null,
              createdAt: Date.now(),
            })
            .onConflictDoNothing();
          token.uid = profile.sub;
        }
        return token;
      },
      session({ session, token }) {
        if (typeof token.uid === "string") session.user.id = token.uid;
        return session;
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildConfig);

export type ApiUser = { id: string; email: string };

/**
 * API route の入り口で使う。ログイン済みならユーザを、未ログインなら 401 のレスポンスを返す。
 *
 * ページは全てクライアントコンポーネントで、データは必ず API から取るため、
 * ここで止めればデータは守られる（middleware はログイン画面へ送るだけ）。
 */
export async function requireApiUser(): Promise<ApiUser | NextResponse> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { id, email };
}
