import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
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
		},
	};
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildConfig);

export type AppUser = { email: string; name: string | null; image: string | null };

/** ログイン済みユーザを返す。未ログインなら /login へリダイレクトする */
export async function requireUser(): Promise<AppUser> {
	const session = await auth();
	const email = session?.user?.email;
	if (!email) redirect("/login");
	return { email, name: session.user?.name ?? null, image: session.user?.image ?? null };
}
