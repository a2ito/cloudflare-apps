import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { upsertUser } from "@/db/queries";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";
import { getEnv, readEnvString, requireEnvString } from "./cloudflare";

async function buildConfig(): Promise<NextAuthConfig> {
	const env = await getEnv();
	const allowed = parseAllowedEmails(readEnvString(env, "ALLOWED_EMAILS"));

	return {
		secret: requireEnvString(env, "AUTH_SECRET"),
		trustHost: true,
		session: { strategy: "jwt" },
		pages: { signIn: "/login", error: "/login" },
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
					{ email: profile?.email ?? user.email, emailVerified: profile?.email_verified },
					allowed,
				);
			},
			// ログイン時にだけ users 行を作り、以降は JWT に載せた id を使う（毎リクエストの書き込みを避ける）
			async jwt({ token, user }) {
				if (user?.email) {
					const db = await getDb();
					const row = await upsertUser(db, {
						email: user.email,
						name: user.name ?? null,
						image: user.image ?? null,
					});
					token.uid = row.id;
				}
				return token;
			},
			session({ session, token }) {
				if (typeof token.uid === "number") session.user.id = String(token.uid);
				return session;
			},
		},
	};
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildConfig);

export type AppUser = { id: number; email: string; name: string | null; image: string | null };

/** ログイン済みユーザを返す。未ログインなら /login へリダイレクトする */
export async function requireUser(): Promise<AppUser> {
	const session = await auth();
	const email = session?.user?.email;
	if (!email) redirect("/login");

	const id = Number(session.user?.id);
	const profile = { email, name: session.user?.name ?? null, image: session.user?.image ?? null };
	if (Number.isInteger(id) && id > 0) return { id, ...profile };

	// 古いセッションなど id が無い場合はここで補完する
	const db = await getDb();
	const row = await upsertUser(db, profile);
	return { id: row.id, ...profile };
}
