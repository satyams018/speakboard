import { describe, expect, it } from "vitest";
import { START, createModel, learn, parseModel, seedModel, suggest } from "../src/js/predict.js";
import { BUILT_IN_BY_ID, STARTER_SENTENCES } from "../src/js/vocab.js";

describe("next-picture suggestions", () => {
  it("counts word pairs including the sentence start", () => {
    const model = learn(createModel(), ["i", "want", "water"]);
    expect(model.counts[START]).toEqual({ i: 1 });
    expect(model.counts.i).toEqual({ want: 1 });
    expect(model.counts.want).toEqual({ water: 1 });
  });

  it("does not mutate the model it learns from", () => {
    const before = createModel();
    learn(before, ["i", "want"]);
    expect(before.counts).toEqual({});
  });

  it("ranks by count and breaks ties alphabetically", () => {
    let model = createModel();
    model = learn(model, ["want", "water"]);
    model = learn(model, ["want", "milk"]);
    model = learn(model, ["want", "water"]);
    model = learn(model, ["want", "juice"]);
    expect(suggest(model, "want")).toEqual(["water", "juice", "milk"]);
    expect(suggest(model, "want", 1)).toEqual(["water"]);
  });

  it("adapts to what this person actually says", () => {
    let model = seedModel(STARTER_SENTENCES);
    expect(suggest(model, "want", 1)).not.toEqual(["tea"]);
    for (let i = 0; i < 5; i++) model = learn(model, ["i", "want", "tea"], 2);
    expect(suggest(model, "want", 1)).toEqual(["tea"]);
  });

  it("suggests start words for an empty sentence", () => {
    const model = seedModel(STARTER_SENTENCES);
    expect(suggest(model, null)[0]).toBe("i");
  });

  it("filters out unavailable ids and never repeats the previous word", () => {
    let model = learn(createModel(), ["more", "more", "water"]);
    model = learn(model, ["more", "gone"]);
    expect(suggest(model, "more", 4, (id) => id !== "gone")).toEqual(["water"]);
  });

  it("falls back to the most-used words when a word has no history", () => {
    let model = learn(createModel(), ["i", "want", "water"]);
    model = learn(model, ["i", "want", "milk"]);
    // Nothing has ever followed "angry", so the row is filled with common words.
    expect(suggest(model, "angry", 3)).toEqual(["i", "want", "milk"]);
    // Words already suggested from history are not repeated.
    expect(suggest(model, "i", 3)).toEqual(["want", "milk", "water"]);
  });

  it("every starter sentence uses real vocabulary", () => {
    for (const sentence of STARTER_SENTENCES) {
      for (const id of sentence) expect(BUILT_IN_BY_ID.has(id), id).toBe(true);
    }
  });

  it("rejects malformed stored models", () => {
    expect(parseModel(null)).toEqual(createModel());
    expect(parseModel({ counts: { a: { b: "x" } } })).toEqual(createModel());
    expect(parseModel({ counts: { a: { b: -1 } } })).toEqual(createModel());
    expect(parseModel({ counts: { a: { b: 2 } } })).toEqual({ counts: { a: { b: 2 } } });
  });
});
