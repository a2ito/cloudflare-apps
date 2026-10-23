"use client";

import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { defaultNS } from "./config";

if (!i18next.isInitialized) {
  i18next
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (lng: string, ns: string) => import(`../locales/${lng}/${ns}.json`),
      ),
    )
    .init({
      fallbackLng: "ja",
      ns: [defaultNS],
      defaultNS,
      interpolation: { escapeValue: false },
    });
}

export default i18next;
