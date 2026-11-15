import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { upsertUser } from "@/db/queries";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";
import { getEnv, readEnvString, requireEnvString } from "./cloudflare";

/**
 * セッションの有効期間。Auth.js の既定（30 日）に揃える。
 * 使っていても延びず、ログインから 30 日で必ずログインし直しになる（Cookie だけで持つため）。
 */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * better-auth のインスタンスを作る。
 *
 * better-auth 自身は DB を持たない（ステートレス）。セッションは暗号化した Cookie（JWE）に
 * 載せ、OAuth の state も Cookie に置く。アプリの users 表の id（uid）はユーザの追加項目として
 * セッションに載せ、D1 に書くのはログインのときだけにする（毎リクエストの書き込みを避ける）。
 *
 * env は Worker の中でしか読めないので、モジュールの読み込み時ではなく初回の呼び出しで作る。
 */
async function createAuth() {
  const env = await getEnv();
  const allowed = parseAllowedEmails(readEnvString(env, "ALLOWED_EMAILS"));

  return betterAuth({
    baseURL: requireEnvString(env, "BETTER_AUTH_URL"),
    secret: requireEnvString(env, "AUTH_SECRET"),
    socialProviders: {
      google: {
        clientId: requireEnvString(env, "AUTH_GOOGLE_ID"),
        clientSecret: requireEnvString(env, "AUTH_GOOGLE_SECRET"),
      },
    },
    user: {
      additionalFields: {
        // users 表の id。ログインのときに databaseHooks で入れる
        uid: { type: "number", required: false, input: false },
      },
    },
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_MAX_AGE_SECONDS,
        strategy: "jwe",
        refreshCache: true,
      },
    },
    // OAuth の state は Cookie に置く。Google のトークンはアプリで使わないので Cookie に載せない
    account: { storeStateStrategy: "cookie", storeAccountCookie: false },
    databaseHooks: {
      user: {
        create: {
          // 許可リストに無い Google アカウントはここで弾く（/login?error=unable_to_create_user に戻る）。
          // 通したら users 行を作り（あれば更新し）、その id をセッションに載せる。
          // DB を持たないため、better-auth のユーザは isolate のメモリにしか無い。同じ isolate に
          // 前のログインのユーザが残っているとここは通らず、users の name / image も更新されない
          // （許可リストは getSessionUser が毎回見直すので、締め出しには影響しない）。
          async before(user) {
            if (
              !isSignInAllowed(
                { email: user.email, emailVerified: user.emailVerified },
                allowed,
              )
            ) {
              return false;
            }
            const row = await upsertUser(await getDb(), {
              email: user.email,
              name: user.name || null,
              image: user.image ?? null,
            });
            return { data: { ...user, uid: row.id } };
          },
        },
      },
    },
    // state を読む前に失敗したときの戻り先。既定の /api/auth/error ではなくログイン画面に出す
    onAPIError: { errorURL: "/login" },
    // Server Action から呼んだときに Set-Cookie を next/headers の cookies() へ流す
    plugins: [nextCookies()],
  });
}

type Auth = Awaited<ReturnType<typeof createAuth>>;

let authPromise: Promise<Auth> | undefined;

function getAuth(): Promise<Auth> {
  authPromise ??= createAuth().catch((error: unknown) => {
    // 設定漏れなどで失敗したら、次の呼び出しで作り直せるようにする
    authPromise = undefined;
    throw error;
  });
  return authPromise;
}

/** /api/auth/* のハンドラ */
export async function handleAuthRequest(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export type AppUser = {
  id: number;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * ログイン中のユーザを返す。未ログインなら null。
 *
 * セッションがあっても、いまの許可リストに無ければ未ログインとして扱う。
 * セッションは Cookie に載っていて取り消せないため、許可リストから外した人を
 * 次のリクエストから締め出すにはここで毎回見るしかない。
 */
export async function getSessionUser(): Promise<AppUser | null> {
  const [auth, env] = await Promise.all([getAuth(), getEnv()]);
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return null;

  const allowed = parseAllowedEmails(readEnvString(env, "ALLOWED_EMAILS"));
  if (
    !isSignInAllowed(
      { email: user.email, emailVerified: user.emailVerified },
      allowed,
    )
  ) {
    return null;
  }

  const profile = {
    email: user.email,
    name: user.name || null,
    image: user.image ?? null,
  };
  const uid = Number(user.uid);
  if (Number.isInteger(uid) && uid > 0) return { id: uid, ...profile };

  // uid が載っていないセッションはここで補完する
  const row = await upsertUser(await getDb(), profile);
  return { id: row.id, ...profile };
}

/** ログイン済みユーザを返す。未ログインなら /login へリダイレクトする */
export async function requireUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Google のログイン画面へ送る。Server Action から呼ぶ */
export async function signInWithGoogle(): Promise<never> {
  const auth = await getAuth();
  const result = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/", errorCallbackURL: "/login" },
    headers: await headers(),
  });
  if (!result.url)
    throw new Error("Google のログイン URL を取得できませんでした");
  redirect(result.url);
}

/** ログアウトして /login へ戻す。Server Action から呼ぶ */
export async function signOutUser(): Promise<never> {
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
