import { describe, expect, it } from "vitest";
import { planSegments } from "../src/js/speech.js";

const items = (...ids) => ids.map((id) => ({ id }));
const labelOf = (item) => item.id.toUpperCase();

describe("speech planning", () => {
  it("joins consecutive text-to-speech words into one segment", () => {
    expect(planSegments(items("i", "want", "water"), labelOf, () => false)).toEqual([
      { type: "tts", text: "I WANT WATER" },
    ]);
  });

  it("plays recorded clips in place and splits the text around them", () => {
    const hasClip = (id) => id === "nani";
    expect(planSegments(items("i", "want", "nani", "now"), labelOf, hasClip)).toEqual([
      { type: "tts", text: "I WANT" },
      { type: "clip", id: "nani" },
      { type: "tts", text: "NOW" },
    ]);
  });

  it("handles only clips, and an empty sentence", () => {
    expect(planSegments(items("a", "b"), labelOf, () => true)).toEqual([
      { type: "clip", id: "a" },
      { type: "clip", id: "b" },
    ]);
    expect(planSegments([], labelOf, () => true)).toEqual([]);
  });
});
