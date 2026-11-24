import { describe, expect, it } from "vitest";
import { BUILT_IN, CATEGORIES, LANGUAGE_CODES, LANGUAGES } from "../src/js/vocab.js";
import { STRING_KEYS, STRING_LANGS, t } from "../src/js/i18n.js";

describe("vocabulary data", () => {
  it("has unique ids", () => {
    const ids = BUILT_IN.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("labels every item in every language and uses a known category", () => {
    const categories = new Set(CATEGORIES.map((c) => c.id));
    for (const item of BUILT_IN) {
      expect(categories.has(item.category), item.id).toBe(true);
      expect(item.emoji, item.id).toBeTruthy();
      for (const lang of LANGUAGE_CODES) {
        const label = item.label[lang];
        if (typeof label === "object") {
          // Gendered labels need both forms, and they must differ (otherwise use a string).
          expect(label.m, `${item.id}/${lang}/m`).toBeTruthy();
          expect(label.f, `${item.id}/${lang}/f`).toBeTruthy();
          expect(label.m, `${item.id}/${lang}`).not.toBe(label.f);
        } else {
          expect(label, `${item.id}/${lang}`).toBeTruthy();
        }
      }
    }
  });

  it("names every category in every language", () => {
    for (const category of CATEGORIES) {
      for (const lang of LANGUAGE_CODES) expect(category.label[lang]).toBeTruthy();
    }
  });

  it("has a speech language for every language", () => {
    for (const lang of LANGUAGE_CODES)
      expect(LANGUAGES[lang].speechLang).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
  });
});

describe("interface text", () => {
  it("translates every key in every language", () => {
    expect(STRING_LANGS.sort()).toEqual([...LANGUAGE_CODES].sort());
    for (const lang of STRING_LANGS) {
      for (const key of STRING_KEYS) expect(t(lang, key), `${lang}/${key}`).not.toBe(key);
    }
  });

  it("fills placeholders and falls back to English", () => {
    expect(t("en", "lastMessage", { taps: 3, seconds: 4.2 })).toBe("Last message: 3 taps, 4.2 s");
    expect(t("xx", "speak")).toBe("Speak");
    expect(t("en", "missing-key")).toBe("missing-key");
  });
});
