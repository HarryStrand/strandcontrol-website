import { translations } from "./locales/index.mjs";

// Dartopia’s catalog, besides English. Regional tags such as de-AT use the base language.
export const SITE_LANGUAGES = ["cs", "de", "es", "fr", "it", "nl", "pl"];

// Keys in the injected support-form catalog. Values are locale string ids.
export const SUPPORT_MESSAGE_IDS = {
  ok: "msg.ok",
  missing: "msg.missing",
  invalid: "msg.invalid",
  attachment: "msg.attachment",
  turnstile: "msg.turnstile",
  rate: "msg.rate",
  send: "msg.send",
  "not-configured": "msg.notConfigured",
  offline: "msg.offline",
  network: "msg.network",
  attachmentsUnavailable: "msg.attachmentsUnavailable",
  limit: "msg.limit",
  remove: "msg.remove",
};

// ?lang= wins when it names English or a translated language. Anything else is ignored
// and the Accept-Language list is used. The first supported language in that list wins.
export function negotiatedLanguage(requestUrl, acceptLanguage) {
  const override = new URL(requestUrl).searchParams.get("lang");
  if (override !== null && override.trim() !== "") {
    const code = override.trim().toLowerCase();
    if (code === "en" || SITE_LANGUAGES.includes(code)) return code;
  }
  return matchAcceptLanguage(acceptLanguage);
}

export function matchAcceptLanguage(header) {
  if (!header || typeof header !== "string") return "en";
  const ranges = [];
  header.split(",").forEach((part, index) => {
    const [rawTag, ...params] = part.split(";").map((piece) => piece.trim());
    if (!rawTag) return;
    let q = 1;
    for (const param of params) {
      const [name, value] = param.split("=").map((piece) => piece.trim());
      if (name === "q") q = Number(value);
    }
    if (!Number.isFinite(q) || q <= 0) return;
    ranges.push({ tag: rawTag.toLowerCase(), q, index });
  });
  ranges.sort((left, right) => right.q - left.q || left.index - right.index);
  for (const range of ranges) {
    if (range.tag === "*") return "en";
    const base = range.tag.split("-")[0];
    if (base === "en") return "en";
    if (SITE_LANGUAGES.includes(base)) return base;
  }
  return "en";
}

export function stringsFor(lang) {
  return translations[lang] || null;
}

export function supportMessages(lang) {
  const strings = stringsFor(lang);
  if (!strings) return null;
  const messages = {};
  for (const [id, key] of Object.entries(SUPPORT_MESSAGE_IDS)) {
    if (typeof strings[key] === "string") messages[id] = strings[key];
  }
  return messages;
}
