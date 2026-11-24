// Shared, clickable logic for the design mockups. It uses the app's real vocabulary
// and grammar so every direction shows real content; only the look differs.
// Serve the project root (not src/) so these imports resolve.

import { CATEGORIES, LANGUAGES, PHRASES, WORDS } from "../src/js/vocab.js";
import { compose } from "../src/js/grammar.js";
import { labelFor } from "../src/js/sentence.js";

// Simplified Fitzgerald key: the colour says what kind of word it is.
const KEY = {
  core: "core",
  quick: "social",
  needs: "thing",
  food: "thing",
  places: "thing",
  feelings: "feeling",
  people: "person",
  actions: "action",
  mine: "mine",
};

const UI = {
  en: {
    speak: "Speak",
    undo: "Undo",
    clear: "Clear",
    next: "Next",
    empty: "Tap pictures to build a sentence",
  },
  hi: {
    speak: "बोलो",
    undo: "वापस",
    clear: "मिटाओ",
    next: "अगला",
    empty: "वाक्य बनाने के लिए चित्र दबाएँ",
  },
  es: {
    speak: "Hablar",
    undo: "Deshacer",
    clear: "Borrar",
    next: "Siguiente",
    empty: "Toca imágenes para formar una frase",
  },
};

const $ = (s) => document.querySelector(s);
const byId = new Map([...WORDS, ...PHRASES].map((w) => [w.id, w]));

const state = {
  lang: "en",
  category: "core",
  sentence: ["i", "want", "water"].map((id) => byId.get(id)),
  spoken: false,
};

const label = (item) => labelFor(item, state.lang, "m");

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids.filter((k) => k != null));
  return n;
}

function picture(item, tag) {
  return el(
    tag,
    {
      class: tag === "button" ? "tile" : "chip",
      "data-key": KEY[item.category],
      type: tag === "button" ? "button" : null,
    },
    el("span", { class: "pic", "aria-hidden": "true" }, item.emoji),
    el("span", { class: "word" }, label(item)),
  );
}

function renderSentence(highlight = -1) {
  const strip = $("#strip");
  strip.classList.toggle("is-spoken", state.spoken);
  strip.replaceChildren(
    ...(state.sentence.length
      ? state.sentence.map((item) => picture(item, "span"))
      : [el("span", { class: "empty" }, UI[state.lang].empty)]),
  );
  const words = compose(state.sentence, state.lang).split(" ").filter(Boolean);
  $("#sentence").replaceChildren(
    ...words.map((w, i) => el("span", { class: i === highlight ? "w now" : "w" }, w)),
  );
  for (const id of ["#speak", "#undo", "#clear"]) $(id).disabled = state.sentence.length === 0;
}

function renderSuggestions() {
  const ids = ["want", "need", "am", "like"];
  $("#suggestions").replaceChildren(
    ...ids.map((id) => {
      const b = picture(byId.get(id), "button");
      b.className = "suggestion";
      b.addEventListener("click", () => add(byId.get(id)));
      return b;
    }),
  );
}

function renderTabs() {
  $("#tabs").replaceChildren(
    ...CATEGORIES.filter((c) => c.id !== "mine").map((c) =>
      el(
        "button",
        {
          class: "tab",
          type: "button",
          "data-key": KEY[c.id],
          "aria-pressed": String(c.id === state.category),
          onclick: () => {
            state.category = c.id;
            renderTabs();
            renderGrid();
          },
        },
        el("span", { class: "pic", "aria-hidden": "true" }, c.emoji),
        el("span", { class: "word" }, c.label[state.lang]),
      ),
    ),
  );
}

function renderGrid() {
  const items =
    state.category === "quick" ? PHRASES : WORDS.filter((w) => w.category === state.category);
  $("#grid").replaceChildren(
    ...items.map((item) => {
      const b = picture(item, "button");
      b.addEventListener("click", () => (item.category === "quick" ? say([item]) : add(item)));
      return b;
    }),
  );
}

function add(item) {
  if (state.spoken) {
    state.sentence = [];
    state.spoken = false;
  }
  state.sentence.push(item);
  renderSentence();
  speakText(label(item));
}

function speakText(text, onWord) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGUAGES[state.lang].speechLang;
  u.rate = 0.9;
  if (onWord) {
    let i = 0;
    u.onboundary = (e) => e.name === "word" && onWord(i++);
    u.onend = () => onWord(-1);
  }
  speechSynthesis.speak(u);
}

// Speak with a karaoke-style highlight that walks through the words.
function say(items) {
  const text = compose(items, state.lang);
  const words = text.split(" ");
  let i = 0;
  renderSentence(0);
  // Fallback timer in case the browser gives no word boundaries.
  const timer = setInterval(() => {
    i += 1;
    renderSentence(i < words.length ? i : -1);
    if (i >= words.length) clearInterval(timer);
  }, 420);
  speakText(text, () => {});
  document.body.classList.add("speaking");
  setTimeout(() => document.body.classList.remove("speaking"), words.length * 420 + 200);
}

export function init() {
  $("#speak").addEventListener("click", () => {
    if (!state.sentence.length) return;
    state.spoken = true;
    say(state.sentence);
  });
  $("#undo").addEventListener("click", () => {
    state.sentence.pop();
    state.spoken = false;
    renderSentence();
  });
  $("#clear").addEventListener("click", () => {
    state.sentence = [];
    state.spoken = false;
    renderSentence();
  });
  for (const b of document.querySelectorAll("[data-lang]")) {
    b.addEventListener("click", () => {
      state.lang = b.dataset.lang;
      document.documentElement.lang = state.lang;
      for (const o of document.querySelectorAll("[data-lang]"))
        o.setAttribute("aria-pressed", String(o === b));
      for (const n of document.querySelectorAll("[data-ui]"))
        n.textContent = UI[state.lang][n.dataset.ui];
      renderAll();
    });
  }
  renderAll();
}

function renderAll() {
  renderSentence();
  renderSuggestions();
  renderTabs();
  renderGrid();
}
