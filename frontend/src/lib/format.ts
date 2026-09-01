import type { Lang } from "../i18n/I18nProvider";

/** `0x70997970c5…17dc79C8` — keeps head and tail, elides the middle. */
export function truncateMiddle(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

const localeFor = (lang: Lang) => (lang === "bn" ? "bn-BD" : "en-GB");

export function formatDateTime(iso: string, lang: Lang): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(localeFor(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string, lang: Lang): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: "medium" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}
