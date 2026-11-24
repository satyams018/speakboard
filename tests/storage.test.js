import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  addButton,
  deleteButton,
  getClip,
  listButtons,
  listClipKeys,
  loadModel,
  loadSettings,
  openDB,
  sanitizeSettings,
  saveClip,
  saveModel,
  saveSettings,
  updateButton,
  validateButtonInput,
} from "../src/js/storage.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

describe("settings and model in localStorage", () => {
  it("round-trips settings and falls back to defaults", () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    const custom = {
      lang: "hi",
      size: "large",
      speakOnTap: false,
      rate: 1.2,
      gender: "f",
      vibrate: false,
    };
    saveSettings(custom, storage);
    expect(loadSettings(storage)).toEqual(custom);
  });

  it("replaces invalid settings with defaults", () => {
    expect(
      sanitizeSettings({
        lang: "fr",
        size: "huge",
        speakOnTap: "yes",
        rate: 9,
        gender: "x",
        vibrate: "no",
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps working when storage is blocked or corrupt", () => {
    expect(loadSettings(throwingStorage)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS, throwingStorage)).toBe(false);
    const storage = memoryStorage();
    storage.setItem("speakboard.settings.v1", "{not json");
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(loadModel(null)).toBeNull();
  });

  it("round-trips the suggestion model", () => {
    const storage = memoryStorage();
    saveModel({ counts: { i: { want: 3 } } }, storage);
    expect(loadModel(storage)).toEqual({ counts: { i: { want: 3 } } });
  });
});

describe("caregiver buttons and clips in IndexedDB", () => {
  let db;
  beforeEach(async () => {
    db?.close();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("speakboard");
      req.onsuccess = req.onerror = resolve;
    });
    db = await openDB();
  });

  it("validates input", () => {
    expect(validateButtonInput({ label: "  " })).toMatch(/label/);
    expect(validateButtonInput({ label: "x".repeat(41) })).toMatch(/40/);
    expect(validateButtonInput({ label: "Nani", image: { size: 10, type: "text/plain" } })).toMatch(
      /image/,
    );
    expect(validateButtonInput({ label: "Nani", image: { size: 3e6, type: "image/png" } })).toMatch(
      /large/,
    );
    expect(validateButtonInput({ label: "Nani" })).toBeNull();
  });

  it("adds, lists and deletes buttons, removing their clips", async () => {
    const nani = await addButton(db, { label: "  Nani  " });
    await addButton(db, { label: "Dal" });
    expect(nani.label).toEqual({ en: "Nani", hi: "Nani", es: "Nani" });
    expect((await listButtons(db)).map((b) => b.label.en)).toEqual(["Nani", "Dal"]);

    await saveClip(db, nani.id, "hi", new Blob(["voice"], { type: "audio/webm" }));
    await saveClip(db, "water", "hi", new Blob(["voice"], { type: "audio/webm" }));
    expect(await getClip(db, nani.id, "hi")).not.toBeNull();

    await deleteButton(db, nani.id);
    expect((await listButtons(db)).map((b) => b.label.en)).toEqual(["Dal"]);
    expect(await listClipKeys(db)).toEqual(["water|hi"]);
  });

  it("puts a button in a chosen category and rejects unknown ones", async () => {
    const dal = await addButton(db, { label: "Dal", category: "food" });
    expect(dal.category).toBe("food");
    await expect(addButton(db, { label: "X", category: "quick" })).rejects.toThrow(/category/);
  });

  it("edits a button but keeps its id, photo and recordings", async () => {
    const photo = new Blob(["img"], { type: "image/jpeg" });
    const nani = await addButton(db, { label: "Nani", image: photo });
    await saveClip(db, nani.id, "hi", new Blob(["voice"], { type: "audio/webm" }));
    const edited = await updateButton(db, nani.id, { label: " Grandma ", category: "people" });
    expect(edited).toMatchObject({ id: nani.id, category: "people", createdAt: nani.createdAt });
    expect(edited.label).toEqual({ en: "Grandma", hi: "Grandma", es: "Grandma" });
    const [stored] = await listButtons(db);
    expect(stored.image).not.toBeNull(); // the old photo was kept
    expect(await getClip(db, nani.id, "hi")).not.toBeNull();
    await expect(updateButton(db, nani.id, { label: "", category: "people" })).rejects.toThrow(
      /label/,
    );
    await expect(updateButton(db, "custom-gone", { label: "A", category: "mine" })).rejects.toThrow(
      /no longer exists/,
    );
  });

  it("rejects bad buttons and clips", async () => {
    await expect(addButton(db, { label: "" })).rejects.toThrow(/label/);
    await expect(saveClip(db, "water", "fr", new Blob(["x"]))).rejects.toThrow();
    await expect(saveClip(db, "water", "en", new Blob([]))).rejects.toThrow(/empty/);
    expect(await getClip(db, "water", "en")).toBeNull();
  });
});
