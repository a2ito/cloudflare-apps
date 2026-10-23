import "server-only";
import i18next from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { defaultNS } from "./config";

export async function initI18n(lang: string) {
  const i18n = i18next.createInstance();

  await i18n
    .use(
      resourcesToBackend(
        (lng: string, ns: string) => import(`../locales/${lng}/${ns}.json`),
      ),
    )
    .init({
      lng: lang,
      fallbackLng: "ja",
      ns: [defaultNS],
      defaultNS,
      interpolation: { escapeValue: false },
    });

  return i18n;
}
