// vinext の Worker に、サブスクを計上する Cron の入口を足す。
// https://vinext.dev/docs/getting-started/migrating-from-opennext#custom-worker-entry
import handler from "vinext/server/fetch-handler";
import { drizzle } from "drizzle-orm/d1";
import { postDueSubscriptionExpenses, todayInJst } from "../src/lib/subscriptions";

export default {
  fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    const today = todayInJst(new Date(controller.scheduledTime));
    ctx.waitUntil(
      postDueSubscriptionExpenses(drizzle(env.DB), today).then((count) =>
        console.log(`subscriptions: ${count} expense(s) posted for ${today}`),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
