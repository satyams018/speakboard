// Next-picture suggestions using a small bigram model.
//
// The model counts which word follows which. It starts from a few starter sentences
// and then learns from the sentences this person actually speaks, so suggestions
// adapt to them. It runs entirely on the device: no network and no AI service.

export const START = "<start>";

/** Create an empty model. Counts look like { prevId: { nextId: count } }. */
export function createModel() {
  return { counts: {} };
}

/**
 * Learn from one spoken sentence (a list of word ids).
 * @param {{counts: Record<string, Record<string, number>>}} model
 * @param {string[]} ids
 * @param {number} [weight] how much this sentence counts; real usage counts more than seeds
 */
export function learn(model, ids, weight = 1) {
  if (!Array.isArray(ids) || ids.length === 0) return model;
  const counts = structuredClone(model.counts);
  let prev = START;
  for (const id of ids) {
    counts[prev] ??= {};
    counts[prev][id] = (counts[prev][id] ?? 0) + weight;
    prev = id;
  }
  return { counts };
}

/** Build a model from starter sentences. */
export function seedModel(sentences) {
  return sentences.reduce((model, ids) => learn(model, ids, 1), createModel());
}

/**
 * Suggest up to `limit` next word ids after `prevId` (or START for an empty sentence).
 * Ties are broken alphabetically so results are stable.
 * @param {{counts: Record<string, Record<string, number>>}} model
 * @param {string|null} prevId
 * @param {number} [limit]
 * @param {(id: string) => boolean} [isAvailable] filter out ids that no longer exist
 * @returns {string[]}
 */
export function suggest(model, prevId, limit = 4, isAvailable = () => true) {
  const rank = (row) =>
    Object.entries(row)
      .filter(([id]) => isAvailable(id) && id !== prevId)
      .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))
      .map(([id]) => id);

  const picks = rank(model.counts[prevId ?? START] ?? {}).slice(0, limit);
  if (picks.length >= limit) return picks;

  // Not enough data after this word: fill up with the most-used words overall, so
  // the suggestion row is never empty.
  const overall = {};
  for (const row of Object.values(model.counts)) {
    for (const [id, count] of Object.entries(row)) overall[id] = (overall[id] ?? 0) + count;
  }
  for (const id of rank(overall)) {
    if (picks.length >= limit) break;
    if (!picks.includes(id)) picks.push(id);
  }
  return picks;
}

/** Validate a model loaded from storage; returns a fresh model if it is malformed. */
export function parseModel(value) {
  if (!value || typeof value !== "object" || typeof value.counts !== "object") {
    return createModel();
  }
  for (const row of Object.values(value.counts)) {
    if (!row || typeof row !== "object") return createModel();
    for (const count of Object.values(row)) {
      if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return createModel();
    }
  }
  return { counts: value.counts };
}
