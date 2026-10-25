// OpenNext が生成する Worker に、サブスクを計上する Cron の入口を足すためのラッパー。
// https://opennext.js.org/cloudflare/howtos/custom-worker
import { drizzle } from "drizzle-orm/d1";
// `.open-next/worker.js` はビルド時に生成される。未ビルドだと型が解決できず、ビルド後は解決できるため、
// エラーが無いと失敗する ts-expect-error ではなく ts-ignore で抑える
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";
import {
  postDueSubscriptionExpenses,
  todayInJst,
} from "./src/lib/subscriptions";

export default {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    const today = todayInJst(new Date(controller.scheduledTime));
    ctx.waitUntil(
      postDueSubscriptionExpenses(drizzle(env.DB), today).then((count) =>
        console.log(`subscriptions: ${count} expense(s) posted for ${today}`),
      ),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
