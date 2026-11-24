// Caregiver tools: add, edit and delete photo buttons, and record voices. Everything is saved on the
// device only (IndexedDB), so private family photos never leave the phone.

import { labelFor } from "./sentence.js";
import { CATEGORIES } from "./vocab.js";
import {
  CUSTOM_CATEGORIES,
  addButton,
  deleteButton,
  deleteClip,
  getClip,
  saveClip,
  updateButton,
  validateButtonInput,
} from "./storage.js";
import { canRecord, playBlob, startRecording } from "./speech.js";

const $ = (selector) => document.querySelector(selector);

/**
 * Shrink a photo so it loads fast and uses little storage. Keeps the aspect ratio.
 * @param {Blob} file
 * @param {number} maxSide longest side in pixels
 * @returns {Promise<Blob>}
 */
export async function resizeImage(file, maxSide = 320) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be opened. Try a JPG or PNG image.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not read the photo."))),
      "image/jpeg",
      0.85,
    ),
  );
}

export function initCaregiver(app) {
  const dialog = $("#caregiver-dialog");
  const form = $("#add-form");
  const labelInput = $("#add-label");
  const photoInput = $("#add-photo");
  const errorBox = $("#add-error");
  const recSelect = $("#rec-button");
  const recStart = $("#rec-start");
  const recStop = $("#rec-stop");
  const recPlay = $("#rec-play");
  const recDelete = $("#rec-delete");
  const recStatus = $("#rec-status");
  const categorySelect = $("#add-category");
  const saveButton = $("#add-save");
  const cancelButton = $("#add-cancel");
  let recording = null;
  let editingId = null; // id of the button being edited, or null when adding

  const categoryName = (id) => CATEGORIES.find((c) => c.id === id)?.label.en ?? id;
  categorySelect.replaceChildren(
    ...CUSTOM_CATEGORIES.map((id) =>
      app.el("option", { value: id }, id === "mine" ? "My buttons only" : categoryName(id)),
    ),
  );

  /** Switch the form between "add" and "edit this button". */
  function setEditing(button) {
    editingId = button?.id ?? null;
    form.reset();
    showError(null);
    labelInput.value = button?.label.en ?? "";
    categorySelect.value = button?.category ?? "mine";
    $("#add-title").textContent = button ? `Edit "${button.label.en}"` : "Add a picture button";
    $("#add-photo-label").textContent = button
      ? "New photo (optional, keeps the current one if empty)"
      : "Photo (optional)";
    saveButton.textContent = button ? "Save changes" : "Save button";
    cancelButton.hidden = !button;
    if (button) labelInput.focus();
  }

  const showError = (message) => {
    errorBox.hidden = !message;
    errorBox.textContent = message ?? "";
  };

  function renderList() {
    const list = $("#custom-list");
    const buttons = app.allItems().filter((item) => item.custom);
    if (buttons.length === 0) {
      list.replaceChildren(app.el("li", { class: "hint" }, "No custom buttons yet."));
      return;
    }
    list.replaceChildren(
      ...buttons.map((button) => {
        const img = app.imageUrl(button.id)
          ? app.el("img", { src: app.imageUrl(button.id), alt: "" })
          : app.el("span", { class: "no-photo", "aria-hidden": "true" }, "💬");
        return app.el(
          "li",
          {},
          img,
          app.el(
            "span",
            { class: "name" },
            button.label.en,
            app.el("span", { class: "hint" }, ` in ${categoryName(button.category)}`),
          ),
          app.el(
            "button",
            {
              type: "button",
              "aria-label": `Edit ${button.label.en}`,
              onclick: () => setEditing(button),
            },
            "✏️ Edit",
          ),
          app.el(
            "button",
            {
              type: "button",
              "aria-label": `Delete ${button.label.en}`,
              onclick: async () => {
                if (!confirm(`Delete the "${button.label.en}" button and its recordings?`)) return;
                await deleteButton(app.db, button.id);
                if (editingId === button.id) setEditing(null);
                await app.reloadCustom();
                refresh();
              },
            },
            "🗑 Delete",
          ),
        );
      }),
    );
  }

  function renderRecordOptions() {
    const lang = app.lang();
    const previous = recSelect.value;
    recSelect.replaceChildren(
      ...app
        .allItems()
        .map((item) =>
          app.el(
            "option",
            { value: item.id },
            `${app.hasClip(item.id) ? "🎙 " : ""}${item.emoji ? `${item.emoji} ` : ""}${labelFor(item, lang, app.gender())}`,
          ),
        ),
    );
    if (previous && app.itemById(previous)) recSelect.value = previous;
    updateRecordButtons();
  }

  function updateRecordButtons() {
    const has = app.hasClip(recSelect.value);
    recSelect.disabled = Boolean(recording); // the target button can't change mid-recording
    recStart.disabled = Boolean(recording) || !canRecord() || !app.db;
    recStop.disabled = !recording;
    recPlay.disabled = !has || Boolean(recording);
    recDelete.disabled = !has || Boolean(recording);
    if (!canRecord()) recStatus.textContent = "This browser cannot record audio.";
  }

  function refresh() {
    renderList();
    renderRecordOptions();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(null);
    if (!app.db) return showError("Storage is not available on this device.");
    if (saveButton.disabled) return; // already saving: a double tap must not add two buttons
    saveButton.disabled = true;
    try {
      const file = photoInput.files?.[0] ?? null;
      const image = file ? await resizeImage(file) : null;
      const error = validateButtonInput({ label: labelInput.value, image });
      if (error) return showError(error);
      const category = categorySelect.value;
      const wasEditing = editingId;
      if (wasEditing)
        await updateButton(app.db, wasEditing, { label: labelInput.value, category, image });
      else await addButton(app.db, { label: labelInput.value, image, category });
      setEditing(null);
      await app.reloadCustom();
      app.showCategory(category);
      refresh();
      app.toast(wasEditing ? "Changes saved" : "Button saved");
    } catch (error) {
      showError(error.message || "Could not save the button.");
    } finally {
      saveButton.disabled = false;
    }
  });

  cancelButton.addEventListener("click", () => setEditing(null));

  recSelect.addEventListener("change", updateRecordButtons);

  recStart.addEventListener("click", async () => {
    // Remember which button and language this recording is for before anything async.
    const buttonId = recSelect.value;
    const lang = app.lang();
    try {
      recStart.disabled = true; // no double start while the microphone prompt is open
      recording = await startRecording();
      recStatus.textContent = "Recording… say the word now (stops after 8 seconds).";
      updateRecordButtons();
      const blob = await recording.finished;
      recording = null;
      await saveClip(app.db, buttonId, lang, blob);
      await app.reloadCustom();
      recStatus.textContent = "Saved. This button now plays the recording.";
      renderRecordOptions();
    } catch (error) {
      recording = null;
      recStatus.textContent =
        error.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : error.message || "Recording failed.";
      updateRecordButtons();
    }
  });

  recStop.addEventListener("click", () => recording?.stop());

  recPlay.addEventListener("click", async () => {
    const blob = await getClip(app.db, recSelect.value, app.lang());
    if (blob) await playBlob(blob);
  });

  recDelete.addEventListener("click", async () => {
    await deleteClip(app.db, recSelect.value, app.lang());
    await app.reloadCustom();
    recStatus.textContent = "Recording deleted. The device voice will be used.";
    renderRecordOptions();
  });

  $("#caregiver-close").addEventListener("click", () => dialog.close());
  // However the dialog closes (Done or Escape), stop any recording; it is still saved.
  dialog.addEventListener("close", () => recording?.stop());

  return {
    open() {
      setEditing(null);
      showError(null);
      recStatus.textContent = "";
      refresh();
      dialog.showModal();
    },
  };
}
