import { describe, expect, it } from "vitest";
import { MAX_RECENT, addRecent, loadRecent, parseRecent, saveRecent } from "../src/js/recent.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

describe("recent sentences", () => {
  it("adds new sentences to the front", () => {
    let list = addRecent([], ["i", "want", "water"]);
    list = addRecent(list, ["i", "am", "tired"]);
    expect(list).toEqual([
      ["i", "am", "tired"],
      ["i", "want", "water"],
    ]);
  });

  it("moves a repeated sentence to the front instead of duplicating it", () => {
    let list = addRecent([], ["a"]);
    list = addRecent(list, ["b"]);
    list = addRecent(list, ["a"]);
    expect(list).toEqual([["a"], ["b"]]);
  });

  it("keeps at most 10 and ignores empty sentences", () => {
    let list = [];
    for (let i = 0; i < 15; i++) list = addRecent(list, [`w${i}`]);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toEqual(["w14"]);
    expect(addRecent(list, [])).toBe(list);
  });

  it("drops malformed stored data", () => {
    expect(parseRecent("nope")).toEqual([]);
    expect(parseRecent([["ok"], [], [1], "x", ["", "a"], ["fine", "too"]])).toEqual([
      ["ok"],
      ["fine", "too"],
    ]);
  });

  it("round-trips through storage and survives blocked storage", () => {
    const storage = memoryStorage();
    saveRecent([["i", "want", "water"]], storage);
    expect(loadRecent(storage)).toEqual([["i", "want", "water"]]);
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(loadRecent(blocked)).toEqual([]);
    expect(saveRecent([], blocked)).toBe(false);
  });
});
