// Speaking out loud.
//
// The browser's built-in text-to-speech works offline on most phones, but not every
// device has a voice for every language. Recorded clips (made by a caregiver, often in
// a family member's own voice) are used first; text-to-speech fills in the rest.

/**
 * Plan what to play for a list of items. Consecutive items without a clip are joined
 * into one text-to-speech segment so the sentence sounds natural.
 * @param {{id: string}[]} items
 * @param {(item: {id: string}) => string} labelOf
 * @param {(id: string) => boolean} hasClip
 * @returns {({type: "tts", text: string} | {type: "clip", id: string})[]}
 */
export function planSegments(items, labelOf, hasClip) {
  const segments = [];
  for (const item of items) {
    if (hasClip(item.id)) {
      segments.push({ type: "clip", id: item.id });
      continue;
    }
    const text = labelOf(item);
    const last = segments.at(-1);
    if (last?.type === "tts") last.text = `${last.text} ${text}`;
    else segments.push({ type: "tts", text });
  }
  return segments;
}

const synth = () => (typeof speechSynthesis === "undefined" ? null : speechSynthesis);

/** Voices for a BCP-47 language such as "hi-IN" (matches on the "hi" prefix too). */
export function voicesFor(speechLang) {
  const voices = synth()?.getVoices() ?? [];
  const exact = voices.filter((v) => v.lang?.toLowerCase() === speechLang.toLowerCase());
  if (exact.length) return exact;
  const prefix = speechLang.split("-")[0].toLowerCase();
  return voices.filter((v) => v.lang?.toLowerCase().split(/[-_]/)[0] === prefix);
}

/** Resolve once the browser has loaded its voice list (it loads asynchronously). */
export function voicesReady(timeoutMs = 1500) {
  const s = synth();
  if (!s) return Promise.resolve([]);
  if (s.getVoices().length) return Promise.resolve(s.getVoices());
  return new Promise((resolve) => {
    const finish = () => resolve(s.getVoices());
    s.addEventListener?.("voiceschanged", finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

// Each call to speakItems gets a new "generation". Starting a new one (or calling
// stopSpeaking) makes any older sequence stop before its next segment, so two
// sentences never talk over each other.
let generation = 0;
let currentAudio = null;
let finishCurrentAudio = null;

/** Stop anything currently being spoken or played. */
export function stopSpeaking() {
  generation += 1;
  synth()?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    finishCurrentAudio?.(); // a paused clip never fires "ended", so finish it here
  }
}

/** Speak text with the best local voice. Resolves when finished (or immediately if unsupported). */
export function speakText(text, speechLang, rate = 0.9) {
  const s = synth();
  if (!s || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang;
    utterance.rate = rate;
    const voices = voicesFor(speechLang);
    const voice = voices.find((v) => v.localService) ?? voices[0];
    if (voice) utterance.voice = voice;
    // Some browsers occasionally never fire "end"; don't let that block the next segment.
    const safety = setTimeout(resolve, 2000 + (text.length * 150) / rate);
    utterance.onend = utterance.onerror = () => {
      clearTimeout(safety);
      resolve();
    };
    s.speak(utterance);
  });
}

/** Play a recorded clip. Resolves when it ends, fails or is stopped. */
export function playBlob(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      if (currentAudio === audio) {
        currentAudio = null;
        finishCurrentAudio = null;
      }
      resolve();
    };
    currentAudio = audio;
    finishCurrentAudio = finish;
    audio.onended = audio.onerror = finish;
    audio.play().catch(finish);
  });
}

/**
 * Speak items in order, using clips where they exist.
 * @param {object} options
 * @param {{id: string}[]} options.items
 * @param {(item: object) => string} options.labelOf
 * @param {Set<string>} options.clipIds ids that have a clip in the current language
 * @param {(id: string) => Promise<Blob|null>} options.getClip
 * @param {string} options.speechLang
 * @param {number} options.rate
 * @param {string} [options.text] the whole sentence, used when no item has a clip
 * @returns {Promise<void>} resolves when everything has been said (or it was interrupted)
 */
export async function speakItems({ items, labelOf, clipIds, getClip, speechLang, rate, text }) {
  stopSpeaking();
  const mine = generation;
  // With no recordings involved, speak the grammatically composed sentence in one go.
  const segments =
    text && !items.some((item) => clipIds.has(item.id))
      ? [{ type: "tts", text }]
      : planSegments(items, labelOf, (id) => clipIds.has(id));
  for (const segment of segments) {
    if (mine !== generation) return; // interrupted by a newer message
    if (segment.type === "tts") {
      await speakText(segment.text, speechLang, rate);
    } else {
      const blob = await getClip(segment.id);
      if (blob && mine === generation) await playBlob(blob);
    }
  }
}

/** True if this browser can record audio. */
export function canRecord() {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
}

/**
 * Start recording from the microphone. Stops by itself after `maxMs`.
 * @returns {Promise<{ stop: () => Promise<Blob> }>}
 */
export async function startRecording(maxMs = 8000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const finished = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
  });
  recorder.start();
  const timer = setTimeout(() => recorder.state === "recording" && recorder.stop(), maxMs);
  return {
    stop() {
      clearTimeout(timer);
      if (recorder.state === "recording") recorder.stop();
      return finished;
    },
    finished,
  };
}
