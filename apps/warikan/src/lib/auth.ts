import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSignInAllowed, parseAllowedEmails } from "./allowlist";

/**
 * Secret は生成した Env の型に出てこないので、名前で引く。
 *
 * `cloudflare:workers` は workerd の中でしか解決できない。テストでは vitest.config.mts の
 * alias で src/test/cloudflare-workers.ts に差し替わり、触ると投げる env が返る。
 */
async function readEnv(name: string): Promise<string | undefined> {
  const { env } = await import("cloudflare:workers");
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

/**
 * セッションの有効期間。Auth.js の既定（30 日）に揃える。
 * 使っていても延びず、ログインから 30 日で必ずログインし直しになる（Cookie だけで持つため）。
 */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * better-auth のインスタンスを作る。ログインするのは管理画面（/admin）の管理者だけ。
 *
 * better-auth 自身は DB を持たない（ステートレス）。セッションは暗号化した Cookie（JWE）に
 * 載せ、OAuth の state も Cookie に置く。管理者は D1 に記録しない（users 表は無い）。
 *
 * env は Worker の中でしか読めないので、モジュールの読み込み時ではなく初回の呼び出しで作る。
 */
async function createAuth() {
  const [baseURL, secret, clientId, clientSecret, allowed] = await Promise.all([
    requireEnv("BETTER_AUTH_URL"),
    requireEnv("AUTH_SECRET"),
    requireEnv("AUTH_GOOGLE_ID"),
    requireEnv("AUTH_GOOGLE_SECRET"),
    allowedEmails(),
  ]);

  return betterAuth({
    baseURL,
    secret,
    socialProviders: {
      google: { clientId, clientSecret },
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
          // 許可リストに無い Google アカウントはここで弾く（/admin/login?error=unable_to_create_user に戻る）。
          // DB を持たないため、better-auth のユーザは isolate のメモリにしか無い。同じ isolate に
          // 前のログインのユーザが残っているとここは通らない（許可リストは requireAdmin が毎回見直す）。
          async before(user) {
            return isSignInAllowed(
              { email: user.email, emailVerified: user.emailVerified },
              allowed,
            );
          },
        },
      },
    },
    // state を読む前に失敗したときの戻り先。既定の /api/auth/error ではなくログイン画面に出す
    onAPIError: { errorURL: "/admin/login" },
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

type SessionAccount = { email: string; emailVerified: boolean };

/** セッションのアカウント。許可リストは見ない。未ログインなら null */
async function getSessionAccount(): Promise<SessionAccount | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.email) return null;
  return { email: user.email, emailVerified: user.emailVerified };
}

/**
 * ログイン中の管理者を返す。未ログイン、またはいまの許可リストに無ければ null。
 *
 * セッションは Cookie に載っていて取り消せないため、許可リストから外した人を
 * 次のリクエストから締め出すにはここで毎回見るしかない。
 */
export async function getSessionAdmin(): Promise<{ email: string } | null> {
  const [account, allowed] = await Promise.all([
    getSessionAccount(),
    allowedEmails(),
  ]);
  if (!account || !isSignInAllowed(account, allowed)) return null;
  return { email: account.email };
}

/**
 * 管理者としてログインしていなければ /admin/login へ送る。
 * ログイン時だけでなく毎回許可リストを見るのは、ALLOWED_EMAILS から外した人の
 * セッションを、期限切れを待たずに無効にするため。
 */
export async function requireAdmin(): Promise<{ email: string }> {
  const [account, allowed] = await Promise.all([
    getSessionAccount(),
    allowedEmails(),
  ]);
  if (!account) redirect("/admin/login");
  if (!isSignInAllowed(account, allowed)) {
    redirect("/admin/login?error=AccessDenied");
  }
  return { email: account.email };
}

/** Google のログイン画面へ送り、戻ったら /admin を開く。Server Action から呼ぶ */
export async function signInWithGoogle(): Promise<never> {
  const auth = await getAuth();
  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: "/admin",
      errorCallbackURL: "/admin/login",
    },
    headers: await headers(),
  });
  if (!result.url) throw new Error("Google のログイン URL を取得できませんでした");
  redirect(result.url);
}

/** ログアウトして /admin/login へ戻す。Server Action から呼ぶ */
export async function signOutUser(): Promise<never> {
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
