import { getRequestConfig } from "next-intl/server";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

const messagesMap: Record<Locale, typeof esMessages> = {
  es: esMessages,
  en: enMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  // Get locale from requestLocale (provided by middleware via headers)
  const requested = await requestLocale;
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: messagesMap[locale],
  };
});
