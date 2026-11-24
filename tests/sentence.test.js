import { describe, expect, it } from "vitest";
import {
  MAX_SENTENCE_LENGTH,
  addItem,
  clear,
  labelFor,
  resolveForm,
  removeLast,
  toIds,
  toText,
} from "../src/js/sentence.js";
import { BUILT_IN_BY_ID } from "../src/js/vocab.js";

const item = (id) => BUILT_IN_BY_ID.get(id);

describe("sentence strip", () => {
  it("adds items without mutating the original", () => {
    const empty = [];
    const one = addItem(empty, item("i"));
    expect(empty).toEqual([]);
    expect(toIds(one)).toEqual(["i"]);
  });

  it("builds text in each language", () => {
    const s = ["i", "want", "water"].reduce((acc, id) => addItem(acc, item(id)), []);
    expect(toText(s, "en")).toBe("I want water");
    expect(toText(s, "hi")).toBe("मैं चाहिए पानी");
    expect(toText(s, "es")).toBe("yo quiero agua");
  });

  it("uses the male or female form of gendered words", () => {
    const s = ["i", "am", "tired"].map(item);
    expect(toText(s, "hi", "m")).toBe("मैं हूँ थका हुआ");
    expect(toText(s, "hi", "f")).toBe("मैं हूँ थकी हुई");
    expect(toText(s, "es", "f")).toBe("yo estoy cansada");
    expect(toText(s, "en", "f")).toBe("I am tired");
    expect(labelFor(item("phrase-love"), "hi", "f")).toBe("मैं आपसे प्यार करती हूँ");
    // Default is the male form.
    expect(labelFor(item("tired"), "es")).toBe("cansado");
    expect(resolveForm({ m: "", f: "only f" }, "m")).toBe("only f");
    expect(resolveForm(undefined)).toBe("");
  });

  it("falls back to English, then the id, for missing labels", () => {
    expect(labelFor({ id: "x", label: { en: "thing" } }, "hi")).toBe("thing");
    expect(labelFor({ id: "x", label: {} }, "hi")).toBe("x");
  });

  it("undo removes the last item and clear empties it", () => {
    const s = [item("i"), item("want")];
    expect(toIds(removeLast(s))).toEqual(["i"]);
    expect(removeLast([])).toEqual([]);
    expect(clear()).toEqual([]);
  });

  it("stops growing at the maximum length", () => {
    let s = [];
    for (let i = 0; i < MAX_SENTENCE_LENGTH + 5; i++) s = addItem(s, item("more"));
    expect(s).toHaveLength(MAX_SENTENCE_LENGTH);
  });

  it("rejects items without an id", () => {
    expect(() => addItem([], {})).toThrow();
  });
});
