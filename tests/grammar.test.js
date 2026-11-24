import { describe, expect, it } from "vitest";
import { compose } from "../src/js/grammar.js";
import { BUILT_IN_BY_ID } from "../src/js/vocab.js";

const say = (lang, ids, gender = "m") =>
  compose(
    ids.map((id) => BUILT_IN_BY_ID.get(id) ?? { id, label: { en: id, hi: id, es: id } }),
    lang,
    gender,
  );

describe("Hindi word order", () => {
  it("puts the verb last with a 'to me' subject", () => {
    expect(say("hi", ["i", "want", "water"])).toBe("मुझे पानी चाहिए");
    expect(say("hi", ["i", "want", "more", "water"])).toBe("मुझे और पानी चाहिए");
    expect(say("hi", ["i", "need", "help"])).toBe("मुझे मदद की ज़रूरत है");
    expect(say("hi", ["i", "like", "tea"])).toBe("मुझे चाय पसंद है");
    expect(say("hi", ["i", "dont-like", "rice"])).toBe("मुझे चावल पसंद नहीं है");
    expect(say("hi", ["you", "want", "tea"])).toBe("आपको चाय चाहिए");
  });

  it("puts nouns before verbs: 'I want go home' -> 'मुझे घर जाना चाहिए'", () => {
    expect(say("hi", ["i", "want", "go", "home"])).toBe("मुझे घर जाना चाहिए");
    expect(say("hi", ["i", "want", "eat", "rice"])).toBe("मुझे चावल खाना चाहिए");
  });

  it("handles 'I am …' with the right gender", () => {
    expect(say("hi", ["i", "am", "happy"])).toBe("मैं खुश हूँ");
    expect(say("hi", ["i", "am", "tired"], "m")).toBe("मैं थका हुआ हूँ");
    expect(say("hi", ["i", "am", "tired"], "f")).toBe("मैं थकी हुई हूँ");
  });

  it("uses 'feel' phrasing for hot, cold and pain", () => {
    expect(say("hi", ["i", "am", "hot"])).toBe("मुझे गर्मी लग रही है");
    expect(say("hi", ["i", "am", "pain"])).toBe("मुझे दर्द हो रहा है");
  });

  it("works without a subject and keeps tap order when there is no verb", () => {
    expect(say("hi", ["want", "milk"])).toBe("दूध चाहिए");
    expect(say("hi", ["more", "water", "please"])).toBe("और पानी कृपया");
    expect(say("hi", ["go", "home"])).toBe("जाना घर");
  });
});

describe("English", () => {
  it("adds 'to' and 'in' where needed", () => {
    expect(say("en", ["i", "want", "water"])).toBe("I want water");
    expect(say("en", ["i", "want", "go", "home"])).toBe("I want to go home");
    expect(say("en", ["i", "like", "play"])).toBe("I like to play");
    expect(say("en", ["i", "am", "pain"])).toBe("I am in pain");
    expect(say("en", ["i", "am", "tired"])).toBe("I am tired");
  });
});

describe("Spanish", () => {
  it("fixes 'me gusta' and 'tengo calor'", () => {
    expect(say("es", ["i", "want", "water"])).toBe("yo quiero agua");
    expect(say("es", ["i", "like", "tea"])).toBe("me gusta té");
    expect(say("es", ["i", "am", "cold"])).toBe("tengo frío");
    expect(say("es", ["i", "am", "tired"], "f")).toBe("yo estoy cansada");
  });
});

describe("other cases", () => {
  it("says a single picture exactly as labelled", () => {
    expect(say("hi", ["need"])).toBe("ज़रूरत");
    expect(say("hi", ["like"])).toBe("पसंद");
    expect(say("hi", ["am"])).toBe("हूँ");
    expect(say("en", ["pain"])).toBe("pain");
    expect(say("es", ["tired"], "f")).toBe("cansada");
  });

  it("never returns an empty sentence for real words", () => {
    expect(say("hi", ["am", "happy"])).toBe("खुश");
    expect(say("hi", ["am", "am"])).toBe("हूँ हूँ");
  });

  it("returns an empty string for no items and single labels as-is", () => {
    expect(compose([], "hi")).toBe("");
    expect(say("hi", ["phrase-help"])).toBe("मुझे मदद चाहिए");
  });

  it("keeps custom buttons in place", () => {
    expect(say("hi", ["i", "want", "custom-nani"])).toBe("मुझे custom-nani चाहिए");
  });
});
