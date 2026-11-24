// Recently spoken sentences, so a person can say something again with one tap.
// Pure functions plus guarded localStorage access (same pattern as storage.js).

const RECENT_KEY = "speakboard.recent.v1";
export const MAX_RECENT = 10;

/**
 * Put a sentence (word ids) at the front of the list. Saying the same sentence again
 * moves it to the front instead of adding a duplicate.
 * @param {string[][]} list
 * @param {string[]} ids
 * @param {number} [max]
 * @returns {string[][]}
 */
export function addRecent(list, ids, max = MAX_RECENT) {
  if (!Array.isArray(ids) || ids.length === 0) return list;
  const key = ids.join("|");
  return [ids, ...list.filter((other) => other.join("|") !== key)].slice(0, max);
}

/** Keep only valid entries (arrays of non-empty strings) from stored data. */
export function parseRecent(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (ids) =>
        Array.isArray(ids) &&
        ids.length > 0 &&
        ids.every((id) => typeof id === "string" && id.length > 0),
    )
    .slice(0, MAX_RECENT);
}

const defaultStorage = () => (typeof localStorage === "undefined" ? null : localStorage);

export function loadRecent(storage = defaultStorage()) {
  try {
    return parseRecent(JSON.parse(storage?.getItem(RECENT_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveRecent(list, storage = defaultStorage()) {
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
