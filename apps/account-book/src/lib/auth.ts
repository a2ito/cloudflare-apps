import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "@/db/schema";

/** セッションの有効期間（30 日）。以前の自前のセッション Cookie と同じ */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Google に登録してあるリダイレクト URI のパス。better-auth の既定（/api/auth/callback/google）ではなく、
 * 以前から使っているものに揃える（Google Cloud Console の設定を変えずに済むように）。
 * このパスの Route Handler が better-auth の callback に中継する。
 */
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

/** better-auth の Google の callback（GOOGLE_CALLBACK_PATH から中継する先） */
export const BETTER_AUTH_GOOGLE_CALLBACK_PATH = "/api/auth/callback/google";

function requireEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "ORIGIN"): string {
  const value = env[name];
  if (typeof value !== "string" || value === "") {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

/**
 * better-auth のインスタンスを作る。
 *
 * better-auth 自身は DB を持たない（ステートレス）。セッションは暗号化した Cookie（JWE）に載せ、
 * OAuth の state も Cookie に置く。
 *
 * 誰が入れるかは以前と同じ。users 表に事前登録されたメールアドレスだけがログインでき、
 * そのユーザの id（uid）をセッションに載せる。グループに所属しているかは middleware と API が毎回見る。
 *
 * 署名鍵は GOOGLE_CLIENT_SECRET から作る。Client secret を作り直すと全員ログアウトになる。
 */
function createAuth() {
  const origin = requireEnv("ORIGIN");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const db = drizzle(env.DB);

  return betterAuth({
    baseURL: origin,
    secret: `account-book-better-auth:${clientSecret}`,
    socialProviders: {
      google: {
        clientId: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret,
        redirectURI: `${origin}${GOOGLE_CALLBACK_PATH}`,
      },
    },
    user: {
      additionalFields: {
        // users 表の id。ログインのときに databaseHooks で入れる
        uid: { type: "string", required: false, input: false },
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
          // 事前登録されていないアカウント・メール未確認のアカウントはここで弾く
          // （/login?error=unable_to_create_user に戻る）。
          // DB を持たないため、better-auth のユーザは isolate のメモリにしか無い。同じ isolate に
          // 前のログインのユーザが残っているとここは通らないが、uid はそのユーザに載ったまま残る。
          async before(user) {
            if (!user.emailVerified) return false;
            const row = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, user.email))
              .get();
            if (!row) return false;
            return { data: { ...user, uid: row.id } };
          },
        },
      },
    },
    // state を読む前に失敗したときの戻り先。既定の /api/auth/error ではなくログイン画面に出す
    onAPIError: { errorURL: "/login" },
  });
}

type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

/** env は Worker の中でしか読めないので、モジュールの読み込み時ではなく初回の呼び出しで作る */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}

/**
 * セッションからユーザの id（users.id）を返す。未ログイン・期限切れ・改ざんは null。
 * グループに所属しているかは見ない（呼び出し側が見る）。
 */
export async function getSessionUser(request: Request): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  const uid = session?.user.uid;
  return typeof uid === "string" && uid !== "" ? uid : null;
}
