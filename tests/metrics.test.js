import { describe, expect, it } from "vitest";
import {
  TASKS,
  isTaskComplete,
  isTypedMatch,
  median,
  promptFor,
  summarize,
  toCSV,
} from "../src/js/metrics.js";
import { safeFileName } from "../src/js/testmode.js";
import { BUILT_IN_BY_ID, LANGUAGE_CODES } from "../src/js/vocab.js";

describe("test-mode tasks", () => {
  it("every accepted answer uses real vocabulary and every prompt is translated", () => {
    for (const task of TASKS) {
      for (const lang of LANGUAGE_CODES) {
        for (const gender of ["m", "f"]) {
          expect(promptFor(task, lang, gender), `${task.id}/${lang}/${gender}`).toBeTruthy();
        }
      }
      for (const option of task.accept) {
        for (const id of option) expect(BUILT_IN_BY_ID.has(id), id).toBe(true);
      }
    }
  });

  it("gives the prompt in the right word form", () => {
    const tired = TASKS.find((t) => t.id === "tired");
    expect(promptFor(tired, "hi", "f")).toBe("मैं थकी हुई हूँ");
    expect(promptFor(tired, "es", "m")).toBe("Estoy cansado");
    expect(promptFor(tired, "xx", "f")).toBe("I am tired");
  });

  it("makes safe download file names from tester labels", () => {
    expect(safeFileName("T1")).toBe("T1");
    expect(safeFileName("../a b/c")).toBe("a-b-c");
    expect(safeFileName("टेस्टर 2")).toBe("टेस्टर-2");
    expect(safeFileName("///")).toBe("tester");
  });

  it("accepts any listed answer, in order only", () => {
    const water = TASKS.find((t) => t.id === "water");
    expect(isTaskComplete(water, ["i", "want", "water"])).toBe(true);
    expect(isTaskComplete(water, ["phrase-thirsty"])).toBe(true);
    expect(isTaskComplete(water, ["water", "want", "i"])).toBe(false);
    expect(isTaskComplete(water, [])).toBe(false);
  });

  it("matches typed text ignoring case, spaces and punctuation", () => {
    expect(isTypedMatch("I want water", "  i WANT   water! ")).toBe(true);
    expect(isTypedMatch("मुझे पानी चाहिए", "मुझे पानी चाहिए।")).toBe(true);
    expect(isTypedMatch("I want water", "I want milk")).toBe(false);
    expect(isTypedMatch("", "")).toBe(false);
  });
});

describe("summaries", () => {
  it("computes medians", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("summarises board vs typing, using only successful trials for timing", () => {
    const trials = [
      { taskId: "water", condition: "board", lang: "en", seconds: 4, taps: 3, success: true },
      { taskId: "toilet", condition: "board", lang: "en", seconds: 2, taps: 1, success: true },
      { taskId: "home", condition: "board", lang: "en", seconds: 30, taps: 9, success: false },
      { taskId: "water", condition: "typing", lang: "en", seconds: 12, taps: 13, success: true },
      { taskId: "toilet", condition: "typing", lang: "en", seconds: 18, taps: 18, success: true },
    ];
    const s = summarize(trials);
    expect(s.board).toEqual({ trials: 3, successRate: 67, medianSeconds: 3, medianTaps: 2 });
    expect(s.typing).toEqual({ trials: 2, successRate: 100, medianSeconds: 15, medianTaps: 15.5 });
    expect(s.speedup).toBe(5);
  });

  it("handles no trials", () => {
    const s = summarize([]);
    expect(s.board.successRate).toBeNull();
    expect(s.speedup).toBeNull();
  });

  it("exports CSV with quoting", () => {
    const csv = toCSV(
      [{ taskId: "water", condition: "board", lang: "hi", seconds: 3.456, taps: 3, success: true }],
      'Tester "A", group 1',
    );
    expect(csv).toBe(
      'tester,task,condition,language,seconds,taps,success\n"Tester ""A"", group 1",water,board,hi,3.46,3,yes\n',
    );
  });
});
