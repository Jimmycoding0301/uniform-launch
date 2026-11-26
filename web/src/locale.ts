export type Language = "zh" | "en";

function readLanguage(): Language {
  const requested = new URLSearchParams(location.search).get("lang");
  if (requested === "en" || requested === "zh") {
    try { localStorage.setItem("uniform.language", requested); } catch { /* The URL still works without storage. */ }
    return requested;
  }
  try { return localStorage.getItem("uniform.language") === "en" ? "en" : "zh"; } catch { return "zh"; }
}

export const language = readLanguage();
export const t = (zh: string, en: string) => language === "en" ? en : zh;
document.documentElement.lang = language === "en" ? "en" : "zh-CN";
document.title = t("同价发射", "Uniform Launch · One-Price Auctions");

export function localizedHref(path: string): string {
  const url = new URL(path.replace(/^\//, ""), new URL(import.meta.env.BASE_URL, location.origin));
  if (language === "en") url.searchParams.set("lang", "en");
  return url.pathname + url.search + url.hash;
}

export function languageHref(scene?: number): string {
  const url = new URL(location.href);
  url.searchParams.set("lang", language === "en" ? "zh" : "en");
  if (scene !== undefined) url.searchParams.set("scene", String(scene + 1));
  return url.pathname + url.search + url.hash;
}
