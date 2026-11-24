// A two-tone alarm generated with the Web Audio API, so it needs no sound file and
// works offline. Used by the Help button.

let context = null;

/**
 * Play the alarm for `ms` milliseconds. Resolves when it ends (or right away if the
 * browser has no Web Audio).
 * @param {number} ms
 */
export function playSiren(ms = 1600) {
  const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioCtx) return Promise.resolve();
  context ??= new AudioCtx();
  context.resume?.();
  const start = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "square";
  // Alternate between two pitches every 0.25 s, like an emergency siren.
  for (let t = 0; t < ms / 1000; t += 0.25) {
    osc.frequency.setValueAtTime(Math.round(t / 0.25) % 2 ? 720 : 960, start + t);
  }
  gain.gain.setValueAtTime(0.25, start);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + ms / 1000);
  return new Promise((resolve) => {
    osc.onended = resolve;
    setTimeout(resolve, ms + 200); // in case "ended" never fires
  });
}

/** Silence the alarm immediately. */
export function stopSiren() {
  if (!context) return;
  context.close?.();
  context = null;
}
