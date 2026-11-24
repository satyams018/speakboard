// SpeakBoard: main board UI. Wires the pure modules (sentence, predict, storage,
// speech) to the page. Caregiver tools and test mode live in their own modules and
// talk to the board through the small `app` object defined at the bottom.

import {
  BUILT_IN_BY_ID,
  CATEGORIES,
  LANGUAGES,
  PHRASES,
  STARTER_SENTENCES,
  WORDS,
} from "./vocab.js";
import { t } from "./i18n.js";
import { addItem, clear, labelFor, removeLast, toIds } from "./sentence.js";
import { learn, seedModel, suggest } from "./predict.js";
import { compose } from "./grammar.js";
import { addRecent, loadRecent, saveRecent } from "./recent.js";
import { playSiren, stopSiren } from "./siren.js";
import {
  getClip,
  listButtons,
  listClipKeys,
  loadModel,
  loadSettings,
  openDB,
  saveModel,
  saveSettings,
} from "./storage.js";
import { speakItems, stopSpeaking, voicesFor, voicesReady } from "./speech.js";
import { initCaregiver } from "./caregiver.js";
import { initTestMode } from "./testmode.js";

const $ = (selector) => document.querySelector(selector);

/** Tiny DOM builder: el("button", { class: "x", onclick }, "text", child). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child != null) node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

const state = {
  settings: loadSettings(),
  sentence: [],
  spoken: false, // true once the current sentence has been spoken
  category: "core",
  model: loadModel() ?? seedModel(STARTER_SENTENCES),
  recent: loadRecent(), // last sentences spoken, as lists of word ids
  custom: [],
  imageUrls: new Map(),
  clipKeys: new Set(),
  db: null,
  message: { start: null, taps: 0 }, // the message being composed now
  totalTaps: 0, // every tap since the page loaded (used by test mode)
  onMessage: null, // set by test mode
};

const lang = () => state.settings.lang;
const gender = () => state.settings.gender;
const itemById = (id) => BUILT_IN_BY_ID.get(id) ?? state.custom.find((b) => b.id === id);
const clipIds = () =>
  new Set(
    [...state.clipKeys].filter((key) => key.endsWith(`|${lang()}`)).map((key) => key.split("|")[0]),
  );

// ---------- Measuring each message (taps and seconds) ----------

function countTap() {
  if (state.message.start === null) state.message.start = performance.now();
  state.message.taps += 1;
  state.totalTaps += 1;
}

function resetMessage() {
  state.message = { start: null, taps: 0 };
}

function speak(items) {
  return speakItems({
    items,
    labelOf: (item) => labelFor(item, lang(), gender()),
    clipIds: clipIds(),
    getClip: (id) => (state.db ? getClip(state.db, id, lang()) : Promise.resolve(null)),
    speechLang: LANGUAGES[lang()].speechLang,
    rate: state.settings.rate,
    text: compose(items, lang(), gender()),
  });
}

// Simplified Fitzgerald key: the colour bar under a picture says what kind of word it is.
const KEY = {
  core: "core",
  quick: "social",
  recent: "core",
  needs: "thing",
  food: "thing",
  places: "thing",
  feelings: "feeling",
  people: "person",
  actions: "action",
  mine: "mine",
};
const keyOf = (item) => KEY[item.category] ?? "core";

// ---------- The hero sentence and its spoken-word highlight ----------

let highlightTimer = null;
let heroOverride = null; // a quick phrase shown in the hero while it is spoken

/** Draw the big sentence. `now` is the index of the word being spoken (or -1). */
function renderHero(now = -1) {
  const hero = $("#sentence-text");
  const items = heroOverride ?? state.sentence;
  if (items.length === 0) {
    hero.classList.add("is-empty");
    hero.textContent = t(lang(), "emptyStrip");
    return;
  }
  hero.classList.remove("is-empty");
  const words = compose(items, lang(), gender()).split(" ").filter(Boolean);
  // Spaces between the spans keep textContent equal to the spoken sentence.
  hero.replaceChildren(
    ...words.flatMap((word, i) => [
      i ? " " : "",
      el("span", { class: i === now ? "w now" : "w" }, word),
    ]),
  );
}

/**
 * Speak a whole message and light up its words one by one. Browsers don't reliably
 * report word timings, so the highlight is paced from the speech rate and always
 * ends when speaking actually finishes.
 */
function speakWithHighlight(items, { phrase = false } = {}) {
  clearInterval(highlightTimer);
  heroOverride = phrase ? items : null;
  const spoken = speak(items);
  const count = compose(items, lang(), gender()).split(" ").filter(Boolean).length;
  let i = 0;
  document.body.classList.add("speaking");
  renderHero(0);
  highlightTimer = setInterval(() => {
    i = Math.min(i + 1, count - 1);
    renderHero(i);
  }, 380 / state.settings.rate);
  const mine = highlightTimer;
  spoken.finally(() => {
    if (highlightTimer !== mine) return; // a newer message took over
    clearInterval(highlightTimer);
    highlightTimer = null;
    heroOverride = null;
    document.body.classList.remove("speaking");
    renderHero();
  });
  return spoken;
}

/** Stop the highlight straight away (Undo, Clear, a new sentence). */
function stopHighlight() {
  clearInterval(highlightTimer);
  highlightTimer = null;
  heroOverride = null;
  document.body.classList.remove("speaking");
}

/** A message is finished: speak it, learn from it and report how long it took. */
function completeMessage(items) {
  const seconds =
    state.message.start === null ? 0 : (performance.now() - state.message.start) / 1000;
  const taps = state.message.taps;
  const ids = toIds(items);
  const isPhrase = items.length === 1 && items[0].category === "quick";
  const spoken = speakWithHighlight(items, { phrase: isPhrase });
  if (!isPhrase) {
    state.model = learn(state.model, ids, 2);
    saveModel(state.model);
    state.recent = addRecent(state.recent, ids);
    saveRecent(state.recent);
    if (state.category === "recent") renderGrid();
  }
  $("#stats").textContent = t(lang(), taps === 1 ? "lastMessageOne" : "lastMessage", {
    taps,
    seconds: seconds.toFixed(1),
  });
  resetMessage();
  state.onMessage?.({ ids, taps, seconds, spoken });
}

// ---------- Actions ----------

/** A short buzz confirms a tap on phones that support it (setting: Vibrate). */
function buzz() {
  if (state.settings.vibrate) navigator.vibrate?.(15);
}

function onTile(item) {
  buzz();
  if (item.category === "quick") {
    // Quick phrases speak straight away and leave the strip alone.
    countTap();
    completeMessage([item]);
    return;
  }
  if (state.spoken) {
    state.sentence = clear();
    state.spoken = false;
  }
  stopHighlight();
  countTap();
  state.sentence = addItem(state.sentence, item);
  if (state.settings.speakOnTap) speak([item]);
  renderStrip();
  renderSuggestions();
}

function onSpeak() {
  if (state.sentence.length === 0) return;
  if (state.spoken) {
    speakWithHighlight(state.sentence); // repeat without counting it as a new message
    return;
  }
  countTap();
  state.spoken = true;
  completeMessage(state.sentence);
  renderStrip();
  renderSuggestions();
}

function onUndo() {
  if (state.sentence.length === 0) return;
  countTap();
  stopSpeaking();
  stopHighlight();
  state.sentence = removeLast(state.sentence);
  state.spoken = false;
  renderStrip();
  renderSuggestions();
}

function onClear() {
  if (state.sentence.length === 0) return;
  countTap();
  stopSpeaking();
  stopHighlight();
  state.sentence = clear();
  state.spoken = false;
  resetMessage(); // starting over: the abandoned attempt doesn't count toward the next message
  renderStrip();
  renderSuggestions();
}

// ---------- Rendering ----------

function visual(item) {
  const url = state.imageUrls.get(item.id);
  if (url) return el("img", { src: url, alt: "" });
  return el("span", { class: "emoji", "aria-hidden": "true" }, item.emoji || "💬");
}

function renderStrip() {
  const strip = $("#strip");
  const empty = state.sentence.length === 0;
  strip.classList.toggle("spoken", state.spoken);
  // Speak, Undo and Clear do nothing on an empty strip, so show them as disabled.
  for (const id of ["#speak", "#undo", "#clear"]) $(id).disabled = empty;
  strip.replaceChildren(
    ...state.sentence.map((item) =>
      el(
        "span",
        { class: "chip", "data-key": keyOf(item) },
        visual(item),
        labelFor(item, lang(), gender()),
      ),
    ),
  );
  strip.scrollLeft = strip.scrollWidth;
  // The big sentence, exactly as it will be spoken (word order fixed for Hindi etc.).
  if (!highlightTimer) renderHero();
}

function renderSuggestions() {
  const prev = state.spoken || state.sentence.length === 0 ? null : state.sentence.at(-1).id;
  const ids = suggest(state.model, prev, 4, (id) => {
    const item = itemById(id);
    return Boolean(item) && item.category !== "quick";
  });
  $("#suggestions").replaceChildren(
    ...ids.map((id) => {
      const item = itemById(id);
      return el(
        "button",
        {
          class: "suggestion",
          type: "button",
          "data-key": keyOf(item),
          onclick: () => onTile(item),
        },
        visual(item),
        labelFor(item, lang(), gender()),
      );
    }),
  );
}

function renderTabs() {
  const tabs = $("#tabs");
  tabs.replaceChildren(
    ...CATEGORIES.map((category) =>
      el(
        "button",
        {
          class: "tab",
          type: "button",
          "data-key": KEY[category.id],
          "data-cat": category.id,
          "aria-pressed": String(category.id === state.category),
          onclick: () => {
            state.category = category.id;
            renderTabs();
            renderGrid();
          },
        },
        el("span", { class: "tab-emoji", "aria-hidden": "true" }, category.emoji),
        category.label[lang()] ?? category.label.en,
      ),
    ),
  );
}

function itemsForCategory(categoryId) {
  if (categoryId === "quick") return PHRASES;
  // "My buttons" lists every caregiver button; the others also show caregiver
  // buttons the caregiver put in that category.
  if (categoryId === "mine") return state.custom;
  return [
    ...WORDS.filter((word) => word.category === categoryId),
    ...state.custom.filter((button) => button.category === categoryId),
  ];
}

/** Recent sentences as items, skipping any whose words no longer exist. */
function recentSentences() {
  return state.recent
    .map((ids) => ids.map(itemById))
    .filter((items) => items.length > 0 && items.every(Boolean));
}

/** Say a recent sentence again: it goes into the strip and is spoken at once. */
function onRecent(items) {
  buzz();
  stopHighlight();
  state.sentence = [...items];
  countTap();
  state.spoken = true;
  completeMessage(state.sentence);
  renderStrip();
  renderSuggestions();
}

function renderRecent(grid) {
  const sentences = recentSentences();
  if (sentences.length === 0) {
    grid.replaceChildren(el("p", { class: "empty" }, t(lang(), "recentEmpty")));
    return;
  }
  grid.replaceChildren(
    ...sentences.map((items) => {
      const text = compose(items, lang(), gender());
      return el(
        "button",
        {
          class: "tile recent",
          "data-key": "core",
          type: "button",
          "aria-label": text,
          onclick: () => onRecent(items),
        },
        el(
          "span",
          { class: "recent-pics", "aria-hidden": "true" },
          ...items.slice(0, 4).map(visual),
        ),
        el("span", { class: "label" }, text),
      );
    }),
  );
}

function renderGrid() {
  const grid = $("#grid");
  if (state.category === "recent") {
    renderRecent(grid);
    return;
  }
  const items = itemsForCategory(state.category);
  const voiced = clipIds();
  if (items.length === 0) {
    grid.replaceChildren(el("p", { class: "empty" }, t(lang(), "noCustomButtons")));
    return;
  }
  grid.replaceChildren(
    ...items.map((item) => {
      const label = labelFor(item, lang(), gender());
      return el(
        "button",
        {
          class: item.category === "quick" ? "tile phrase" : "tile",
          "data-key": keyOf(item),
          type: "button",
          "aria-label": label,
          onclick: () => onTile(item),
        },
        visual(item),
        el("span", { class: "label" }, label),
        voiced.has(item.id) ? el("span", { class: "has-voice", "aria-hidden": "true" }, "🎙") : null,
      );
    }),
  );
}

function renderAll() {
  renderStrip();
  renderSuggestions();
  renderTabs();
  renderGrid();
}

// ---------- Settings and language ----------

function applySettings() {
  const { size } = state.settings;
  document.body.classList.remove("size-small", "size-medium", "size-large");
  document.body.classList.add(`size-${size}`);
  document.documentElement.lang = lang();
  for (const node of document.querySelectorAll("[data-t]"))
    node.textContent = t(lang(), node.dataset.t);
  for (const node of document.querySelectorAll("[data-t-title]"))
    node.title = t(lang(), node.dataset.tTitle);
  checkVoice();
}

async function checkVoice() {
  const banner = $("#banner");
  const wanted = lang();
  await voicesReady();
  if (wanted !== lang()) return; // language changed while waiting
  const missing =
    typeof speechSynthesis === "undefined" || voicesFor(LANGUAGES[wanted].speechLang).length === 0;
  banner.hidden = !missing;
  banner.textContent = missing ? t(wanted, "noVoice", { lang: LANGUAGES[wanted].name }) : "";
}

function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  saveSettings(state.settings);
  applySettings();
  renderAll();
}

function initSettings() {
  const dialog = $("#settings-dialog");
  const langSelect = $("#set-lang");
  langSelect.replaceChildren(
    ...Object.entries(LANGUAGES).map(([code, { name }]) => el("option", { value: code }, name)),
  );
  $("#open-settings").addEventListener("click", () => {
    langSelect.value = state.settings.lang;
    $("#set-size").value = state.settings.size;
    $("#set-speak-on-tap").checked = state.settings.speakOnTap;
    $("#set-rate").value = String(state.settings.rate);
    $("#set-gender").value = state.settings.gender;
    $("#set-vibrate").checked = state.settings.vibrate;
    dialog.showModal();
  });
  langSelect.addEventListener("change", () => updateSettings({ lang: langSelect.value }));
  $("#set-size").addEventListener("change", (e) => updateSettings({ size: e.target.value }));
  $("#set-speak-on-tap").addEventListener("change", (e) =>
    updateSettings({ speakOnTap: e.target.checked }),
  );
  $("#set-gender").addEventListener("change", (e) => updateSettings({ gender: e.target.value }));
  $("#set-vibrate").addEventListener("change", (e) =>
    updateSettings({ vibrate: e.target.checked }),
  );
  $("#set-rate").addEventListener("change", (e) =>
    updateSettings({ rate: Number(e.target.value) }),
  );
}

// ---------- Caregiver data (IndexedDB) ----------

async function reloadCustom() {
  if (!state.db) return;
  for (const url of state.imageUrls.values()) URL.revokeObjectURL(url);
  state.imageUrls.clear();
  state.custom = await listButtons(state.db);
  for (const button of state.custom) {
    if (button.image) state.imageUrls.set(button.id, URL.createObjectURL(button.image));
  }
  state.clipKeys = new Set(await listClipKeys(state.db));
  // A deleted custom button must also disappear from the sentence strip.
  state.sentence = state.sentence.filter((item) => !item.custom || itemById(item.id));
  if (state.sentence.length === 0) state.spoken = false;
  renderAll();
}

/** The caregiver button needs a 1-second press so the user can't open it by accident. */
function initCaregiverHold(open) {
  const button = $("#open-caregiver");
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    button.classList.remove("holding");
  };
  button.addEventListener("pointerdown", () => {
    button.classList.add("holding");
    timer = setTimeout(() => {
      cancel();
      open();
    }, 1000);
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"])
    button.addEventListener(type, cancel);
  button.addEventListener("contextmenu", (e) => e.preventDefault());
  // Keyboard users (click with detail 0) open it directly.
  button.addEventListener("click", (e) => {
    if (e.detail === 0) open();
  });
}

// ---------- Help (SOS) ----------

let alarmOn = false;

/** Siren, then "I need help" spoken and shown full screen, repeating until Stop. */
async function startAlarm() {
  const dialog = $("#alarm-dialog");
  if (alarmOn) return;
  alarmOn = true;
  const help = BUILT_IN_BY_ID.get("phrase-help");
  $("#alarm-text").textContent = labelFor(help, lang(), gender());
  stopHighlight();
  dialog.showModal();
  $("#alarm-stop").focus();
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  while (alarmOn) {
    await playSiren(1600);
    if (!alarmOn) break;
    await speak([help]);
    if (!alarmOn) break;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
}

function stopAlarm() {
  alarmOn = false;
  stopSiren();
  stopSpeaking();
  navigator.vibrate?.(0);
}

function initAlarm() {
  const dialog = $("#alarm-dialog");
  $("#sos").addEventListener("click", startAlarm);
  $("#alarm-stop").addEventListener("click", () => dialog.close());
  // However it closes (Stop or Escape), the sound stops.
  dialog.addEventListener("close", stopAlarm);
}

// ---------- Toasts and offline ----------

let toastTimer = null;
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), 3000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const firstInstall = !navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => firstInstall && toast(t(lang(), "offlineReady")))
    .catch((error) => console.warn("Offline mode unavailable:", error));
}

// ---------- The interface other modules use ----------

const app = {
  el,
  lang,
  gender,
  itemById,
  get db() {
    return state.db;
  },
  /** Every item a caregiver can record a voice for, in display order. */
  allItems: () => [...PHRASES, ...WORDS, ...state.custom],
  hasClip: (id) => clipIds().has(id),
  imageUrl: (id) => state.imageUrls.get(id),
  reloadCustom,
  speak,
  toast,
  clearSentence() {
    stopSpeaking();
    stopHighlight();
    state.sentence = clear();
    state.spoken = false;
    renderStrip();
    renderSuggestions();
  },
  resetMessage,
  totalTaps: () => state.totalTaps,
  setOnMessage(fn) {
    state.onMessage = fn;
  },
  setTaskBanner(content) {
    const banner = $("#task-banner");
    banner.hidden = !content;
    banner.replaceChildren(...(content ? [content].flat().filter((node) => node != null) : []));
  },
  showCategory(categoryId) {
    state.category = categoryId;
    renderTabs();
    renderGrid();
  },
};

// ---------- Start ----------

async function start() {
  $("#speak").addEventListener("click", onSpeak);
  $("#undo").addEventListener("click", onUndo);
  $("#clear").addEventListener("click", onClear);
  initSettings();
  initAlarm();
  applySettings();
  renderAll();

  try {
    state.db = await openDB();
    await reloadCustom();
  } catch (error) {
    console.warn("Storage unavailable; caregiver buttons are disabled.", error);
  }

  const caregiver = initCaregiver(app);
  initCaregiverHold(caregiver.open);
  const testMode = initTestMode(app);
  $("#open-test").addEventListener("click", testMode.open);
  registerServiceWorker();
}

start();
