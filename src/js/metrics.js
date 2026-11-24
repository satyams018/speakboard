// Measurements for user testing: how long and how many taps it takes to say
// something with SpeakBoard versus typing it on a keyboard.

/**
 * A task the tester is asked to say. `accept` lists the id sequences that count as
 * success, so "I need the toilet" can be said with one quick phrase or with words.
 * @typedef {{ id: string, prompt: Record<string, string | {m: string, f: string}>,
 *   accept: string[][] }} Task
 */

import { resolveForm } from "./sentence.js";

/** @type {Task[]} */
export const TASKS = [
  {
    id: "water",
    prompt: { en: "I want water", hi: "मुझे पानी चाहिए", es: "Quiero agua" },
    accept: [["i", "want", "water"], ["want", "water"], ["phrase-thirsty"]],
  },
  {
    id: "toilet",
    prompt: { en: "I need the toilet", hi: "मुझे शौचालय जाना है", es: "Necesito ir al baño" },
    accept: [["phrase-toilet"], ["i", "need", "toilet"], ["need", "toilet"]],
  },
  {
    id: "tired",
    prompt: {
      en: "I am tired",
      hi: { m: "मैं थका हुआ हूँ", f: "मैं थकी हुई हूँ" },
      es: { m: "Estoy cansado", f: "Estoy cansada" },
    },
    accept: [["i", "am", "tired"], ["phrase-tired"], ["tired"]],
  },
  {
    id: "home",
    prompt: { en: "I want to go home", hi: "मुझे घर जाना है", es: "Quiero ir a casa" },
    accept: [
      ["i", "want", "go", "home"],
      ["want", "go", "home"],
      ["go", "home"],
    ],
  },
  {
    id: "pain",
    prompt: { en: "I am in pain", hi: "मुझे दर्द हो रहा है", es: "Me duele" },
    accept: [["phrase-pain"], ["i", "am", "pain"], ["pain"]],
  },
];

/**
 * The prompt for a task in a language and word form, falling back to English.
 * @param {Task} task
 * @param {string} lang
 * @param {"m"|"f"} [gender]
 */
export function promptFor(task, lang, gender = "m") {
  return resolveForm(task.prompt[lang], gender) || resolveForm(task.prompt.en, gender);
}

/**
 * Did the spoken ids complete the task?
 * @param {Task} task
 * @param {string[]} ids
 */
export function isTaskComplete(task, ids) {
  return task.accept.some(
    (option) => option.length === ids.length && option.every((id, i) => id === ids[i]),
  );
}

/**
 * For the typing baseline: does the typed text match the prompt? Case, spacing and
 * punctuation are ignored.
 */
export function isTypedMatch(prompt, typed) {
  const normalise = (s) =>
    String(s)
      .toLocaleLowerCase()
      .replace(/[\p{P}\p{S}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  return normalise(prompt) === normalise(typed) && normalise(prompt) !== "";
}

/**
 * One measured attempt.
 * @typedef {{ taskId: string, condition: "board"|"typing", lang: string,
 *   seconds: number, taps: number, success: boolean }} Trial
 */

/** Median of a list of numbers (null for an empty list). */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

/**
 * Summary per condition: number of trials, success rate, and median seconds and taps
 * for successful trials.
 * @param {Trial[]} trials
 */
export function summarize(trials) {
  const result = {};
  for (const condition of ["board", "typing"]) {
    const all = trials.filter((trial) => trial.condition === condition);
    const ok = all.filter((trial) => trial.success);
    result[condition] = {
      trials: all.length,
      successRate: all.length ? Math.round((ok.length / all.length) * 100) : null,
      medianSeconds: round1(median(ok.map((trial) => trial.seconds))),
      medianTaps: median(ok.map((trial) => trial.taps)),
    };
  }
  const { board, typing } = result;
  result.speedup =
    board.medianSeconds && typing.medianSeconds
      ? round1(typing.medianSeconds / board.medianSeconds)
      : null;
  return result;
}

/** Quote a CSV field if needed. */
function csvField(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Trials as CSV, ready to download and paste into a spreadsheet.
 * @param {Trial[]} trials
 * @param {string} [tester] optional tester label (no real names needed)
 */
export function toCSV(trials, tester = "") {
  const header = ["tester", "task", "condition", "language", "seconds", "taps", "success"];
  const rows = trials.map((trial) => [
    tester,
    trial.taskId,
    trial.condition,
    trial.lang,
    trial.seconds.toFixed(2),
    trial.taps,
    trial.success ? "yes" : "no",
  ]);
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n") + "\n";
}
