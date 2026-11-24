// Turns tapped words into a more natural sentence for speaking and display.
//
// Picture boards produce "telegraphic" input: words in the order they were tapped.
// That is fine in English ("I want water") but wrong in Hindi, which puts the verb
// last ("मुझे पानी चाहिए", not "मैं चाहिए पानी"). These small rules fix the most common
// patterns. Anything they don't cover is spoken in tap order, as before.
//
// All functions are pure, so every rule is covered by unit tests.

import { labelFor } from "./sentence.js";

// Words that behave like infinitive verbs ("go", "eat", "sleep").
export const VERB_IDS = new Set([
  "go",
  "sleep",
  "change-clothes",
  "eat",
  "drink",
  "play",
  "watch-tv",
  "wash",
  "sit",
  "walk",
  "hug",
]);

// Things you "feel" rather than "are" (I am hot -> I feel hot).
const EXPERIENCES = new Set(["hot", "cold", "pain"]);

// ---------- Hindi ----------

// The verb part that goes at the end of the sentence, keyed by word id.
const HI_FINAL = {
  want: "चाहिए",
  need: "की ज़रूरत है",
  like: "पसंद है",
  "dont-like": "पसंद नहीं है",
  am: "हूँ",
};
// These verbs take a "to me" subject: मुझे पानी चाहिए (literally "to me water is needed").
const HI_DATIVE_VERBS = new Set(["want", "need", "like", "dont-like"]);
const HI_DATIVE = { i: "मुझे", you: "आपको" };
const HI_EXPERIENCE = { hot: "गर्मी लग रही है", cold: "ठंड लग रही है", pain: "दर्द हो रहा है" };

function hindi(items, gender) {
  const ids = items.map((item) => item.id);
  const finals = items.filter((item) => item.id in HI_FINAL);
  if (finals.length === 0) return null; // no verb to move; tap order is fine

  const label = (item) => labelFor(item, "hi", gender);
  const subject = items[0].id === "i" || items[0].id === "you" ? items[0] : null;
  const rest = items.filter((item) => item !== subject && !(item.id in HI_FINAL));

  // "I am hot" -> "मुझे गर्मी लग रही है"
  const experience = rest.find((item) => EXPERIENCES.has(item.id));
  if (ids.includes("am") && experience && finals.length === 1) {
    const others = rest.filter((item) => item !== experience).map(label);
    const who = subject ? [HI_DATIVE[subject.id]] : [];
    return [...who, ...others, HI_EXPERIENCE[experience.id]].join(" ");
  }

  const dative = finals.some((item) => HI_DATIVE_VERBS.has(item.id));
  const who = subject ? [dative ? HI_DATIVE[subject.id] : label(subject)] : [];
  const nouns = rest.filter((item) => !VERB_IDS.has(item.id)).map(label);
  const verbs = rest.filter((item) => VERB_IDS.has(item.id)).map(label);
  // "हूँ" only agrees with "मैं"; without that subject, leave it out.
  const ends = finals
    .filter((item) => item.id !== "am" || subject?.id === "i")
    .map((item) => HI_FINAL[item.id]);
  return [...who, ...nouns, ...verbs, ...ends].join(" ");
}

// ---------- English ----------

function english(items, gender) {
  const out = [];
  items.forEach((item, i) => {
    const prev = items[i - 1]?.id;
    // "want go" -> "want to go"
    if (VERB_IDS.has(item.id) && ["want", "need", "like", "dont-like"].includes(prev)) {
      out.push("to");
    }
    // "am pain" -> "am in pain"
    if (item.id === "pain" && prev === "am") out.push("in");
    out.push(labelFor(item, "en", gender));
  });
  return out.join(" ");
}

// ---------- Spanish ----------

const ES_EXPERIENCE = { hot: "tengo calor", cold: "tengo frío", pain: "me duele" };

function spanish(items, gender) {
  const ids = items.map((item) => item.id);
  const label = (item) => labelFor(item, "es", gender);
  let rest = items;
  // "yo me gusta" is wrong: "me gusta" already means "I like".
  if (ids[0] === "i" && ["like", "dont-like"].includes(ids[1])) rest = items.slice(1);
  // "yo estoy calor" -> "tengo calor"
  if (ids[0] === "i" && ids[1] === "am" && EXPERIENCES.has(ids[2])) {
    return [ES_EXPERIENCE[ids[2]], ...items.slice(3).map(label)].join(" ");
  }
  return rest.map(label).join(" ");
}

/**
 * The sentence to speak and show for a list of tapped items.
 * @param {{id: string, label: object}[]} items
 * @param {string} lang
 * @param {"m"|"f"} [gender]
 */
export function compose(items, lang, gender = "m") {
  if (items.length === 0) return "";
  // A single picture always says exactly what is written on it.
  if (items.length === 1) return labelFor(items[0], lang, gender);
  if (lang === "hi") {
    // Hindi rules can return "" (e.g. a lone "हूँ" with no subject); fall back to tap order.
    return hindi(items, gender) || items.map((i) => labelFor(i, lang, gender)).join(" ");
  }
  if (lang === "es") return spanish(items, gender);
  if (lang === "en") return english(items, gender);
  return items.map((item) => labelFor(item, lang, gender)).join(" ");
}
