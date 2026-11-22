import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  negotiatedLanguage,
  SITE_LANGUAGES,
  stringsFor,
  SUPPORT_MESSAGE_IDS,
  supportMessages,
} from "../src/i18n.mjs";

const root = new URL("..", import.meta.url);

function htmlFiles(directory) {
  const found = [];
  for (const name of readdirSync(directory)) {
    if (name.startsWith(".") || name === "src" || name === "test" || name === "node_modules") continue;
    const path = join(directory, name);
    const info = statSync(path);
    if (info.isDirectory()) found.push(...htmlFiles(path));
    else if (name.endsWith(".html")) found.push(path);
  }
  return found;
}

function keysInHtml() {
  const keys = new Set();
  const pattern = /data-i18n(?:-aria|-content)?="([^"]+)"/g;
  for (const file of htmlFiles(root.pathname)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(pattern)) keys.add(match[1]);
  }
  return keys;
}

test("picks the first supported language, including a regional tag", () => {
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", "de-AT,en;q=0.8"), "de");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", "ja,de;q=0.8"), "de");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", "fr-CH,ja;q=0.9"), "fr");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", "en,de;q=0.9"), "en");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", "ja,zh-Hans;q=0.8"), "en");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", ""), "en");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/", null), "en");
  assert.equal(
    negotiatedLanguage("https://strandcontrol.com/", "de;q=0,pl;q=0.4,cs;q=0.8"),
    "cs",
  );
});

test("?lang= overrides the header, and an unknown value is ignored", () => {
  assert.equal(negotiatedLanguage("https://strandcontrol.com/?lang=pl", "de"), "pl");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/?lang=en", "de"), "en");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/?lang=ja", "nl"), "nl");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/?lang=", "es"), "es");
  assert.equal(negotiatedLanguage("https://strandcontrol.com/support?topic=privacy&lang=it", "en"), "it");
});

test("every page key and support message exists in every language", () => {
  const required = keysInHtml();
  for (const id of Object.values(SUPPORT_MESSAGE_IDS)) required.add(id);
  const german = stringsFor("de");
  assert.equal(SITE_LANGUAGES.length, 7);
  for (const lang of SITE_LANGUAGES) {
    const strings = stringsFor(lang);
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(german).sort(), lang);
    for (const key of required) {
      assert.equal(typeof strings[key], "string", `${lang} ${key}`);
      assert.notEqual(strings[key].trim(), "", `${lang} ${key}`);
    }
    const messages = supportMessages(lang);
    assert.equal(messages.ok.length > 0, true);
    assert.match(messages.remove, /\{name\}/);
  }
});
