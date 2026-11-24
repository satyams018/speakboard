// Everything is stored on the device. Nothing is sent to a server.
//
// - Settings and the suggestion model are small, so they live in localStorage.
// - Caregiver photos and voice clips are binary and can be large, so they live in
//   IndexedDB, which stores Blobs directly and has a much bigger quota.

import { GENDERS, LANGUAGE_CODES } from "./vocab.js";
import { parseModel } from "./predict.js";

const SETTINGS_KEY = "speakboard.settings.v1";
const MODEL_KEY = "speakboard.model.v1";
const DB_NAME = "speakboard";
const DB_VERSION = 1;

export const BUTTON_SIZES = ["small", "medium", "large"];
export const MAX_LABEL_LENGTH = 40;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_CLIP_BYTES = 2 * 1024 * 1024;

// Categories a caregiver button can go in ("mine" = only under My buttons).
export const CUSTOM_CATEGORIES = [
  "mine",
  "people",
  "food",
  "places",
  "needs",
  "feelings",
  "actions",
  "core",
];

export const DEFAULT_SETTINGS = Object.freeze({
  lang: "en",
  size: "medium",
  speakOnTap: true,
  rate: 0.9,
  gender: "m",
  vibrate: true,
});

/** Keep only valid settings, replacing anything invalid with the default. */
export function sanitizeSettings(value) {
  const s = value && typeof value === "object" ? value : {};
  const rate = Number(s.rate);
  return {
    lang: LANGUAGE_CODES.includes(s.lang) ? s.lang : DEFAULT_SETTINGS.lang,
    size: BUTTON_SIZES.includes(s.size) ? s.size : DEFAULT_SETTINGS.size,
    speakOnTap: typeof s.speakOnTap === "boolean" ? s.speakOnTap : DEFAULT_SETTINGS.speakOnTap,
    rate: Number.isFinite(rate) && rate >= 0.5 && rate <= 1.5 ? rate : DEFAULT_SETTINGS.rate,
    gender: GENDERS.includes(s.gender) ? s.gender : DEFAULT_SETTINGS.gender,
    vibrate: typeof s.vibrate === "boolean" ? s.vibrate : DEFAULT_SETTINGS.vibrate,
  };
}

// localStorage can be missing or throw (private mode, blocked storage), so every
// access is wrapped and the app keeps working with defaults.
function readJSON(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const defaultStorage = () => (typeof localStorage === "undefined" ? null : localStorage);

export function loadSettings(storage = defaultStorage()) {
  return sanitizeSettings(readJSON(storage, SETTINGS_KEY));
}

export function saveSettings(settings, storage = defaultStorage()) {
  return writeJSON(storage, SETTINGS_KEY, sanitizeSettings(settings));
}

export function loadModel(storage = defaultStorage()) {
  const value = readJSON(storage, MODEL_KEY);
  return value ? parseModel(value) : null;
}

export function saveModel(model, storage = defaultStorage()) {
  return writeJSON(storage, MODEL_KEY, model);
}

// ---------- IndexedDB: caregiver buttons and voice clips ----------

/** Wrap an IDBRequest in a promise. */
function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Resolve when a transaction finishes. */
function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

/**
 * Open the database. `factory` is injectable so tests can use fake-indexeddb.
 * @param {IDBFactory} [factory]
 * @returns {Promise<IDBDatabase>}
 */
export function openDB(factory = globalThis.indexedDB) {
  if (!factory) return Promise.reject(new Error("IndexedDB is not available"));
  const req = factory.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains("buttons"))
      db.createObjectStore("buttons", { keyPath: "id" });
    if (!db.objectStoreNames.contains("clips")) db.createObjectStore("clips", { keyPath: "key" });
  };
  return request(req);
}

/** Check caregiver input for a new button. Returns an error message or null. */
export function validateButtonInput({ label, image }) {
  const text = typeof label === "string" ? label.trim() : "";
  if (!text) return "Please enter a label.";
  if (text.length > MAX_LABEL_LENGTH)
    return `Labels can be at most ${MAX_LABEL_LENGTH} characters.`;
  if (image != null) {
    if (typeof image.size !== "number" || !String(image.type).startsWith("image/")) {
      return "The photo must be an image file.";
    }
    if (image.size > MAX_IMAGE_BYTES) return "The photo is too large (max 2 MB).";
  }
  return null;
}

const newId = () =>
  `custom-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

/**
 * Save a caregiver-made button. The label is used in every language, because the
 * caregiver writes it in the language the family speaks.
 * @returns {Promise<object>} the saved button
 */
export async function addButton(db, { label, image = null, category = "mine" }) {
  const error = validateButtonInput({ label, image });
  if (error) throw new Error(error);
  if (!CUSTOM_CATEGORIES.includes(category)) throw new Error("Unknown category.");
  const text = label.trim();
  const button = {
    id: newId(),
    category,
    emoji: "",
    label: Object.fromEntries(LANGUAGE_CODES.map((lang) => [lang, text])),
    image,
    custom: true,
    createdAt: Date.now(),
  };
  const tx = db.transaction("buttons", "readwrite");
  tx.objectStore("buttons").put(button);
  await done(tx);
  return button;
}

/**
 * Change a caregiver button's label, category or photo. A null `image` keeps the
 * current photo. Its id, recordings and position in the list stay the same.
 * @returns {Promise<object>} the updated button
 */
export async function updateButton(db, id, { label, category, image = null }) {
  const error = validateButtonInput({ label, image });
  if (error) throw new Error(error);
  if (!CUSTOM_CATEGORIES.includes(category)) throw new Error("Unknown category.");
  const read = db.transaction("buttons", "readonly");
  const existing = await request(read.objectStore("buttons").get(id));
  if (!existing) throw new Error("This button no longer exists.");
  const text = label.trim();
  const button = {
    ...existing,
    category,
    label: Object.fromEntries(LANGUAGE_CODES.map((lang) => [lang, text])),
    image: image ?? existing.image,
  };
  const tx = db.transaction("buttons", "readwrite");
  tx.objectStore("buttons").put(button);
  await done(tx);
  return button;
}

/** All caregiver buttons, oldest first. */
export async function listButtons(db) {
  const tx = db.transaction("buttons", "readonly");
  const buttons = await request(tx.objectStore("buttons").getAll());
  return buttons.sort((a, b) => a.createdAt - b.createdAt);
}

/** Delete a caregiver button and all of its voice clips. */
export async function deleteButton(db, id) {
  const keys = (await listClipKeys(db)).filter((key) => key.startsWith(`${id}|`));
  const tx = db.transaction(["buttons", "clips"], "readwrite");
  tx.objectStore("buttons").delete(id);
  for (const key of keys) tx.objectStore("clips").delete(key);
  await done(tx);
}

const clipKey = (buttonId, lang) => `${buttonId}|${lang}`;

/** Save a recorded voice clip for a button (built-in or custom) in one language. */
export async function saveClip(db, buttonId, lang, blob) {
  if (!buttonId || !LANGUAGE_CODES.includes(lang)) throw new Error("Unknown button or language.");
  if (!blob || typeof blob.size !== "number" || blob.size === 0)
    throw new Error("The recording is empty.");
  if (blob.size > MAX_CLIP_BYTES) throw new Error("The recording is too long.");
  const tx = db.transaction("clips", "readwrite");
  tx.objectStore("clips").put({ key: clipKey(buttonId, lang), buttonId, lang, blob });
  await done(tx);
}

/** The voice clip for a button in a language, or null. */
export async function getClip(db, buttonId, lang) {
  const tx = db.transaction("clips", "readonly");
  const record = await request(tx.objectStore("clips").get(clipKey(buttonId, lang)));
  return record?.blob ?? null;
}

export async function deleteClip(db, buttonId, lang) {
  const tx = db.transaction("clips", "readwrite");
  tx.objectStore("clips").delete(clipKey(buttonId, lang));
  await done(tx);
}

/** Keys ("buttonId|lang") of every saved clip. */
export async function listClipKeys(db) {
  const tx = db.transaction("clips", "readonly");
  return request(tx.objectStore("clips").getAllKeys());
}
