// The sentence strip: an ordered list of tapped items. All functions are pure and
// return a new sentence, which keeps the UI simple and makes them easy to test.

export const MAX_SENTENCE_LENGTH = 20;

/** @typedef {{ id: string, emoji?: string, label: Record<string, string | {m: string, f: string}> }} Item */

/**
 * Add an item to the end of the sentence. Ignored once the sentence is full.
 * @param {Item[]} sentence
 * @param {Item} item
 * @returns {Item[]}
 */
export function addItem(sentence, item) {
  if (!item || !item.id) throw new Error("addItem needs an item with an id");
  if (sentence.length >= MAX_SENTENCE_LENGTH) return sentence;
  return [...sentence, item];
}

/** Remove the last item (the "undo" button). */
export function removeLast(sentence) {
  return sentence.slice(0, -1);
}

/** Empty the sentence. */
export function clear() {
  return [];
}

/**
 * Pick the right form of a label. Labels are plain strings, or { m, f } when the word
 * changes with the speaker's gender.
 * @param {string | {m: string, f: string} | undefined} value
 * @param {"m"|"f"} [gender]
 */
export function resolveForm(value, gender = "m") {
  if (value && typeof value === "object") return value[gender] || value.m || value.f || "";
  return value || "";
}

/**
 * Label of one item in a language, falling back to English, then to the id.
 * @param {Item} item
 * @param {string} lang
 * @param {"m"|"f"} [gender]
 */
export function labelFor(item, lang, gender = "m") {
  return resolveForm(item.label?.[lang], gender) || resolveForm(item.label?.en, gender) || item.id;
}

/**
 * The text that is spoken or shown for the whole sentence.
 * @param {Item[]} sentence
 * @param {string} lang
 * @param {"m"|"f"} [gender]
 */
export function toText(sentence, lang, gender = "m") {
  return sentence
    .map((item) => labelFor(item, lang, gender))
    .join(" ")
    .trim();
}

/** Word ids in order, used for learning suggestions and checking test tasks. */
export function toIds(sentence) {
  return sentence.map((item) => item.id);
}
