// End-to-end check: presses every control in a real Chrome and verifies the result.
//
//   npm run test:e2e
//
// Needs Google Chrome installed. Set CHROME_PATH if it is not in the default place.
// Speech output, audio playback and file downloads are recorded instead of played, so
// the checks can see exactly what would have been said. The microphone is Chrome's
// built-in fake device.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 5190);
const URL_ = `http://localhost:${PORT}/`;
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ---------- tiny test harness ----------

const results = [];
let section = "";
function check(name, ok, detail = "") {
  results.push({ section, name, ok: Boolean(ok), detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  ${mark}  ${name}${ok || !detail ? "" : `  →  ${detail}`}`);
}
function begin(name) {
  section = name;
  console.log(`\n${name}`);
}

// ---------- stubs injected before the app loads ----------

function stubs() {
  window.__spoken = [];
  window.__played = [];
  window.__downloads = [];
  window.__vibes = [];
  Object.defineProperty(navigator, "vibrate", {
    value: (pattern) => {
      window.__vibes.push(pattern);
      return true;
    },
    configurable: true,
  });
  window.__voiceList = [
    { lang: "en-US", name: "Test English", localService: true, default: true },
    { lang: "hi-IN", name: "Test Hindi", localService: true },
    { lang: "es-ES", name: "Test Spanish", localService: true },
  ];
  const fakeSynth = {
    getVoices: () => window.__voiceList,
    speak(u) {
      window.__spoken.push({ text: u.text, lang: u.lang, rate: u.rate });
      setTimeout(() => u.onend?.(), window.__speakMs ?? 30);
    },
    cancel() {},
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: fakeSynth, configurable: true });
  // The real utterance only accepts real SpeechSynthesisVoice objects.
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.src);
    setTimeout(() => this.dispatchEvent(new Event("ended")), 30);
    return Promise.resolve();
  };
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download) return;
    const name = this.download;
    fetch(this.href)
      .then((r) => r.text())
      .then((text) => window.__downloads.push({ name, text }));
  };
}

// ---------- page helpers ----------

async function main() {
  const server = spawn(
    `${ROOT}node_modules/.bin/serve`,
    ["src", "-l", String(PORT), "--no-clipboard", "--no-port-switching"],
    { cwd: ROOT, stdio: "ignore" },
  );
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL_)).ok) break;
    } catch {
      await sleep(100);
    }
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const consoleErrors = [];

  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1100, height: 800 });
    await page.evaluateOnNewDocument(stubs);
    page.on("dialog", (d) => d.accept());
    page.on("pageerror", (e) => consoleErrors.push(e.message));
    page.on("console", (m) => {
      // Service workers are not registered in this context, which is expected.
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    await page.goto(URL_, { waitUntil: "networkidle0" });

    const $eval = (sel, fn) => page.$eval(sel, fn);
    const text = (sel) => page.$eval(sel, (n) => n.textContent.trim());
    const exists = (sel) => page.$(sel).then(Boolean);
    const isDisabled = (sel) => page.$eval(sel, (n) => n.disabled);
    const isHidden = (sel) => page.$eval(sel, (n) => n.hidden);
    const dialogOpen = (id) => page.$eval(id, (n) => n.open);
    const spoken = () => page.evaluate(() => window.__spoken);
    const lastSpoken = () => page.evaluate(() => window.__spoken.at(-1) ?? null);
    const played = () => page.evaluate(() => window.__played.length);
    const resetSpoken = () => page.evaluate(() => (window.__spoken = []));
    const stripLabels = () =>
      page.$$eval("#strip .chip", (chips) => chips.map((c) => c.textContent.trim()));
    const tiles = () =>
      page.$$eval("#grid .tile", (ts) => ts.map((t) => t.getAttribute("aria-label")));
    const pressedTab = () => page.$eval('.tab[aria-pressed="true"]', (t) => t.textContent.trim());
    const clickTab = async (name) => {
      const tabsList = await page.$$(".tab");
      for (const tab of tabsList) {
        if ((await tab.evaluate((t) => t.textContent)).includes(name)) return tab.click();
      }
      throw new Error(`No tab ${name}`);
    };
    const clickTile = async (label) => {
      const tile = await page.$(`#grid .tile[aria-label="${label}"]`);
      if (!tile) throw new Error(`No tile "${label}"`);
      await tile.click();
    };
    const clickButtonText = async (scope, label) => {
      const buttons = await page.$$(`${scope} button`);
      for (const b of buttons) {
        if ((await b.evaluate((n) => n.textContent.trim())) === label) return b.click();
      }
      throw new Error(`No button "${label}" in ${scope}`);
    };
    const tap = async (tab, ...labels) => {
      await clickTab(tab);
      for (const l of labels) await clickTile(l);
    };
    const clearStrip = async () => {
      if (!(await isDisabled("#clear"))) await page.click("#clear");
    };
    const setSetting = async (sel, value) => {
      await page.click("#open-settings");
      await page.$eval(
        sel,
        (n, v) => {
          if (n.type === "checkbox") n.checked = v;
          else n.value = v;
          n.dispatchEvent(new Event("change"));
        },
        value,
      );
      await sleep(50);
      await page.click("#settings-dialog button.primary");
    };
    const waitFor = (fn, arg) =>
      page.waitForFunction(fn, { timeout: 8000 }, arg).then(
        () => true,
        () => false,
      );
    // Tap every picture in every category (except My buttons) and check that it is
    // spoken with its own label in the right language.
    const checkEveryTile = async (speechLang) => {
      const bad = [];
      let count = 0;
      const tabCount = (await page.$$(".tab")).length;
      for (let i = 0; i < tabCount; i++) {
        const tab = (await page.$$(".tab"))[i];
        // Recent and My buttons hold sentences / caregiver buttons, not built-in pictures.
        if (["recent", "mine"].includes(await tab.evaluate((n) => n.dataset.cat))) continue;
        await tab.click();
        for (const label of await tiles()) {
          await resetSpoken();
          await clickTile(label);
          await sleep(10);
          const said = await lastSpoken();
          count++;
          if (said?.text !== label || said.lang !== speechLang)
            bad.push(`${label} / ${said?.text}`);
          if (!(await isDisabled("#clear"))) await page.click("#clear");
        }
      }
      return { count, bad };
    };
    const hold = async (sel, ms) => {
      const box = await (await page.$(sel)).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await sleep(ms);
      await page.mouse.up();
      await sleep(50);
    };

    // ======================================================================
    begin("1. Start state");
    check(
      "big sentence shows the placeholder",
      (await text("#sentence-text")).includes("Tap pictures"),
    );
    check("Speak is disabled on an empty strip", await isDisabled("#speak"));
    check("Undo is disabled on an empty strip", await isDisabled("#undo"));
    check("Clear is disabled on an empty strip", await isDisabled("#clear"));
    check("10 category buttons", (await page.$$(".tab")).length === 10);
    check("Help button is visible", await page.$eval("#sos", (n) => n.offsetParent !== null));
    check("Core is selected", (await pressedTab()).includes("Core"));
    check("4 suggestions shown", (await page.$$(".suggestion")).length === 4);
    check("no task banner", await isHidden("#task-banner"));
    check("no missing-voice banner", await isHidden("#banner"));

    // ======================================================================
    begin("2. Every category button");
    const expected = {
      Quick: 12,
      Core: 16,
      Needs: 9,
      Feelings: 7,
      People: 7,
      Food: 7,
      Actions: 8,
      Places: 5,
    };
    for (const [name, count] of Object.entries(expected)) {
      await clickTab(name);
      const n = (await tiles()).length;
      check(
        `${name}: ${count} buttons, tab marked selected`,
        n === count && (await pressedTab()).includes(name),
        `${n} tiles`,
      );
    }
    await clickTab("My buttons");
    check(
      "My buttons: empty message when there are none",
      (await tiles()).length === 0 && (await text("#grid")).includes("No buttons yet"),
    );
    await clickTab("Recent");
    check(
      "Recent: explains itself when nothing has been said yet",
      (await tiles()).length === 0 && (await text("#grid")).includes("will appear here"),
    );

    // ======================================================================
    begin("3. Every picture button (English)");
    const allTiles = {};
    for (const name of Object.keys(expected)) {
      await clickTab(name);
      allTiles[name] = await tiles();
    }
    let wordsOk = 0;
    let wordsBad = [];
    for (const [tab, labels] of Object.entries(allTiles)) {
      if (tab === "Quick") continue;
      for (const label of labels) {
        await clearStrip();
        await resetSpoken();
        await tap(tab, label);
        await sleep(20);
        const s = await lastSpoken();
        const strip = await stripLabels();
        const ok =
          strip.length === 1 && strip[0].endsWith(label) && s?.text === label && s.lang === "en-US";
        if (ok) wordsOk++;
        else wordsBad.push(`${label} (strip=${strip}, said=${s?.text})`);
      }
    }
    check(
      `all ${wordsOk + wordsBad.length} word buttons add a chip and speak their label`,
      wordsBad.length === 0,
      wordsBad.join("; "),
    );
    await clearStrip();
    let phrasesBad = [];
    for (const label of allTiles.Quick) {
      await resetSpoken();
      await tap("Quick", label);
      await sleep(20);
      const s = await lastSpoken();
      if (s?.text !== label || (await stripLabels()).length !== 0) phrasesBad.push(label);
    }
    check(
      `all ${allTiles.Quick.length} quick phrases speak at once and leave the strip empty`,
      phrasesBad.length === 0,
      phrasesBad.join(", "),
    );
    check(
      "a quick phrase counts as 1 tap",
      /Last message: 1 tap,/.test(await text("#stats")),
      await text("#stats"),
    );

    // ======================================================================
    begin("4. Speak, repeat, Undo, Clear");
    await tap("Core", "I", "want", "go"); // "go" is a core word
    await tap("Places", "home");
    check(
      "strip shows 4 chips in order",
      (await stripLabels()).join("|") === "🙋I|🤲want|➡️go|🏠home",
      (await stripLabels()).join("|"),
    );
    check(
      "Speak/Undo/Clear enabled",
      !(await isDisabled("#speak")) &&
        !(await isDisabled("#undo")) &&
        !(await isDisabled("#clear")),
    );
    check(
      "sentence line shows the composed sentence",
      (await text("#sentence-text")) === "I want to go home",
      await text("#sentence-text"),
    );
    await resetSpoken();
    await page.click("#speak");
    await sleep(50);
    check(
      "Speak says the composed sentence",
      (await lastSpoken())?.text === "I want to go home",
      JSON.stringify(await lastSpoken()),
    );
    check(
      "strip is marked as spoken",
      await $eval("#strip", (n) => n.classList.contains("spoken")),
    );
    check(
      "stats: 5 taps",
      /Last message: 5 taps,/.test(await text("#stats")),
      await text("#stats"),
    );
    await resetSpoken();
    await page.click("#speak");
    await sleep(50);
    check(
      "Speak again repeats the sentence",
      (await spoken()).length === 1 && (await lastSpoken()).text === "I want to go home",
    );
    check("repeat does not change the stats", /5 taps/.test(await text("#stats")));
    await tap("Feelings", "happy");
    check(
      "next tap after speaking starts a new sentence",
      (await stripLabels()).join("|") === "😀happy",
      (await stripLabels()).join("|"),
    );
    await tap("Core", "more");
    await page.click("#undo");
    check("Undo removes the last chip", (await stripLabels()).join("|") === "😀happy");
    await page.click("#undo");
    check(
      "Undo to empty disables Speak/Undo/Clear",
      (await stripLabels()).length === 0 &&
        (await isDisabled("#undo")) &&
        (await isDisabled("#speak")),
    );
    await tap("Core", "I", "want");
    await page.click("#clear");
    check(
      "Clear empties the strip",
      (await stripLabels()).length === 0 && (await isDisabled("#clear")),
    );
    await tap("Quick", "I need help");
    check(
      "Clear starts a fresh count (next phrase = 1 tap)",
      /1 tap,/.test(await text("#stats")),
      await text("#stats"),
    );
    await page.click("#undo").catch(() => {});
    check("Undo on an empty strip does nothing", (await stripLabels()).length === 0);
    await clickTab("Core");
    for (let i = 0; i < 25; i++) await clickTile("more");
    check("strip stops at 20 pictures", (await stripLabels()).length === 20);
    await page.click("#clear");

    // ======================================================================
    begin("5. Suggestions");
    await tap("Core", "I");
    const sugg = await page.$$eval(".suggestion", (b) => b.map((x) => x.textContent.trim()));
    check(
      "after 'I', 'want' is suggested",
      sugg.some((s) => s.endsWith("want")),
      sugg.join(", "),
    );
    const wantSuggestion = await page.$$(".suggestion");
    for (const b of wantSuggestion) {
      if ((await b.evaluate((n) => n.textContent.trim())).endsWith("want")) {
        await b.click();
        break;
      }
    }
    check("tapping a suggestion adds it", (await stripLabels()).join("|") === "🙋I|🤲want");
    check("suggestions never empty", (await page.$$(".suggestion")).length === 4);
    await page.click("#clear");

    // ======================================================================
    begin("6. Settings: every control");
    await page.click("#open-settings");
    check("Settings opens", await dialogOpen("#settings-dialog"));
    check(
      "dialog shows current values",
      (await $eval("#set-lang", (n) => n.value)) === "en" &&
        (await $eval("#set-size", (n) => n.value)) === "medium" &&
        (await $eval("#set-speak-on-tap", (n) => n.checked)) === true &&
        (await $eval("#set-gender", (n) => n.value)) === "m",
    );
    await page.click("#settings-dialog button.primary");
    check("Close closes Settings", !(await dialogOpen("#settings-dialog")));
    await page.click("#open-settings");
    await page.keyboard.press("Escape");
    check("Escape closes Settings", !(await dialogOpen("#settings-dialog")));

    await setSetting("#set-lang", "hi");
    check(
      "Hindi: Speak button text",
      (await text("#speak")).includes("बोलो"),
      await text("#speak"),
    );
    check("Hindi: category names", (await pressedTab()).includes("मुख्य"), await pressedTab());
    check(
      "Hindi: Test mode / Settings / Caregiver labels",
      (await text("#open-settings")).includes("सेटिंग्स"),
    );
    await resetSpoken();
    await tap("मुख्य", "मैं", "चाहिए");
    await tap("ज़रूरतें", "पानी");
    await page.click("#speak");
    await sleep(50);
    check(
      "Hindi: 'I want water' is spoken as 'मुझे पानी चाहिए'",
      (await lastSpoken())?.text === "मुझे पानी चाहिए",
      JSON.stringify(await lastSpoken()),
    );
    check("Hindi: speech language hi-IN", (await lastSpoken())?.lang === "hi-IN");
    check("Hindi: stats text", (await text("#stats")).includes("टैप"), await text("#stats"));
    await page.click("#clear");

    await setSetting("#set-gender", "f");
    await clickTab("भावनाएँ");
    check(
      "Female word forms: 'थकी हुई' button",
      (await tiles()).includes("थकी हुई"),
      (await tiles()).join(","),
    );
    await tap("मुख्य", "मैं", "हूँ");
    await tap("भावनाएँ", "थकी हुई");
    await resetSpoken();
    await page.click("#speak");
    await sleep(50);
    check(
      "Female: 'I am tired' → 'मैं थकी हुई हूँ'",
      (await lastSpoken())?.text === "मैं थकी हुई हूँ",
      (await lastSpoken())?.text,
    );
    await page.click("#clear");
    await setSetting("#set-gender", "m");
    await clickTab("भावनाएँ");
    check("Male word forms: 'थका हुआ' button", (await tiles()).includes("थका हुआ"));

    await setSetting("#set-lang", "es");
    await resetSpoken();
    await tap("Básico", "yo", "quiero");
    await tap("Necesidades", "agua");
    await page.click("#speak");
    await sleep(50);
    check(
      "Spanish: 'yo quiero agua', es-ES",
      (await lastSpoken())?.text === "yo quiero agua" && (await lastSpoken())?.lang === "es-ES",
      JSON.stringify(await lastSpoken()),
    );
    await page.click("#clear");

    for (const [code, speechLang] of [
      ["hi", "hi-IN"],
      ["es", "es-ES"],
    ]) {
      for (const g of ["m", "f"]) {
        await setSetting("#set-lang", code);
        await setSetting("#set-gender", g);
        const { count, bad } = await checkEveryTile(speechLang);
        check(
          `${code} ${g === "m" ? "male" : "female"}: all ${count} pictures speak their own label (${speechLang})`,
          bad.length === 0 && count === 71,
          bad.join(", ") || `${count} pictures`,
        );
      }
    }
    await setSetting("#set-gender", "m");
    await setSetting("#set-lang", "en");

    await page.evaluate(
      () => (window.__voiceList = window.__voiceList.filter((v) => !v.lang.startsWith("hi"))),
    );
    await setSetting("#set-lang", "hi");
    await sleep(100);
    check(
      "missing Hindi voice → warning banner",
      !(await isHidden("#banner")) && (await text("#banner")).includes("हिन्दी"),
      await text("#banner"),
    );
    await setSetting("#set-lang", "en");
    await sleep(100);
    check("English voice present → banner hidden", await isHidden("#banner"));

    await setSetting("#set-size", "large");
    const largeH = await page.$eval("#grid .tile", (n) => n.getBoundingClientRect().height);
    await setSetting("#set-size", "small");
    const smallH = await page.$eval("#grid .tile", (n) => n.getBoundingClientRect().height);
    check(
      "Button size changes tile size",
      largeH > smallH + 20,
      `large ${largeH}px, small ${smallH}px`,
    );
    await setSetting("#set-size", "medium");

    await setSetting("#set-speak-on-tap", false);
    await resetSpoken();
    await tap("Core", "yes");
    check("Speak-on-tap off: tapping does not speak", (await spoken()).length === 0);
    await page.click("#speak");
    await sleep(50);
    check("…but Speak still speaks", (await lastSpoken())?.text === "yes");
    await page.click("#clear");
    await setSetting("#set-speak-on-tap", true);

    await setSetting("#set-rate", "1.3");
    await resetSpoken();
    await tap("Core", "no");
    check(
      "Speech speed is applied",
      Math.abs(((await lastSpoken())?.rate ?? 0) - 1.3) < 0.001,
      (await lastSpoken())?.rate,
    );
    await setSetting("#set-rate", "0.9");
    await page.click("#clear");

    await setSetting("#set-lang", "hi");
    await page.reload({ waitUntil: "networkidle0" });
    check("Settings are remembered after reload", (await text("#speak")).includes("बोलो"));
    await setSetting("#set-lang", "en");

    // ======================================================================
    begin("7. Caregiver tools");
    await page.click("#open-caregiver"); // a normal click must not open it
    await sleep(100);
    check("a quick tap does NOT open caregiver tools", !(await dialogOpen("#caregiver-dialog")));
    await hold("#open-caregiver", 300);
    check("a 0.3 s press does NOT open them", !(await dialogOpen("#caregiver-dialog")));
    await hold("#open-caregiver", 1150);
    check("a 1 s press opens them", await dialogOpen("#caregiver-dialog"));
    await page.click("#caregiver-close");
    check("Done closes caregiver tools", !(await dialogOpen("#caregiver-dialog")));
    await page.focus("#open-caregiver");
    await page.keyboard.press("Enter");
    await sleep(50);
    check("keyboard Enter opens them (accessibility)", await dialogOpen("#caregiver-dialog"));

    await page.$eval("#add-label", (n) => (n.value = "   "));
    await page.click("#add-form button[type=submit]");
    await sleep(100);
    check(
      "blank label → error",
      (await text("#add-error")) === "Please enter a label.",
      await text("#add-error"),
    );

    await page.$eval("#add-label", (n) => (n.value = "Notes"));
    await (await page.$("#add-photo")).uploadFile(`${ROOT}README.md`);
    await page.click("#add-form button[type=submit]");
    await sleep(300);
    check(
      "non-image file → friendly error",
      (await text("#add-error")).includes("could not be opened"),
      await text("#add-error"),
    );

    await page.$eval("#add-label", (n) => (n.value = "Nani"));
    await (await page.$("#add-photo")).uploadFile(`${ROOT}src/icons/icon-512.png`);
    await page.click("#add-form button[type=submit]");
    await page.click("#add-form button[type=submit]"); // double tap while saving
    check(
      "Save is disabled while saving",
      await page.$eval("#add-form button[type=submit]", (n) => n.disabled),
    );
    await waitFor(() => document.querySelector("#add-label").value === "");
    await sleep(100);
    check(
      "a double tap on Save adds only one button",
      (await tiles()).filter((t) => t === "Nani").length === 1,
      (await tiles()).join(","),
    );
    check("Save button: no error", await isHidden("#add-error"));
    check("form is cleared after saving", (await $eval("#add-label", (n) => n.value)) === "");
    check(
      "new button appears in My buttons with its photo",
      (await tiles()).includes("Nani") && (await exists('#grid .tile[aria-label="Nani"] img')),
    );
    check("My buttons tab is selected", (await pressedTab()).includes("My buttons"));
    check("listed under My buttons in the dialog", (await text("#custom-list")).includes("Nani"));
    check("'Button saved' toast", (await text("#toast")) === "Button saved");

    await page.$eval("#add-label", (n) => (n.value = "Dal"));
    await page.click("#add-form button[type=submit]");
    await waitFor(() => document.querySelector('#grid .tile[aria-label="Dal"]'));
    check("a button without a photo can be saved", (await tiles()).includes("Dal"));

    // Recording
    await page.select("#rec-button", "water");
    check(
      "Record enabled, Stop/Play/Delete disabled before recording",
      !(await isDisabled("#rec-start")) &&
        (await isDisabled("#rec-stop")) &&
        (await isDisabled("#rec-play")) &&
        (await isDisabled("#rec-delete")),
    );
    await page.click("#rec-start");
    await waitFor(() => document.querySelector("#rec-status").textContent.startsWith("Recording"));
    check(
      "while recording: Stop enabled, Record and button choice locked",
      !(await isDisabled("#rec-stop")) &&
        (await isDisabled("#rec-start")) &&
        (await isDisabled("#rec-button")),
      await text("#rec-status"),
    );
    await sleep(600);
    await page.click("#rec-stop");
    await waitFor(() => document.querySelector("#rec-status").textContent.startsWith("Saved"));
    check(
      "Stop saves the recording",
      (await text("#rec-status")).startsWith("Saved"),
      await text("#rec-status"),
    );
    check(
      "Play and Delete enabled once a recording exists",
      !(await isDisabled("#rec-play")) && !(await isDisabled("#rec-delete")),
    );
    check(
      "dropdown marks it with 🎙",
      (await $eval("#rec-button", (n) => n.selectedOptions[0].textContent)).startsWith("🎙"),
    );
    const playedBefore = await played();
    await page.click("#rec-play");
    await sleep(100);
    check("Play plays the recording", (await played()) === playedBefore + 1);
    await page.click("#caregiver-close");

    await clickTab("Needs");
    check(
      "water tile shows the 🎙 mark",
      await exists('#grid .tile[aria-label="water"] .has-voice'),
    );
    await resetSpoken();
    const p0 = await played();
    await clickTile("water");
    await sleep(100);
    check(
      "tapping water plays the recording, not the device voice",
      (await played()) === p0 + 1 && (await spoken()).length === 0,
    );
    await page.click("#clear");
    await tap("Core", "I", "want");
    await tap("Needs", "water");
    await resetSpoken();
    const p1 = await played();
    await page.click("#speak");
    await waitFor((n) => window.__played.length > n, p1);
    check(
      "sentence with a recording: voice for 'I want', clip for 'water'",
      (await spoken()).map((s) => s.text).join("|") === "I want" && (await played()) === p1 + 1,
      `said ${JSON.stringify(await spoken())}, clips played ${(await played()) - p1}`,
    );
    await page.click("#clear");

    // A recording belongs to one language only.
    await setSetting("#set-lang", "es");
    await clickTab("Necesidades");
    check(
      "recording is per language (no 🎙 in Spanish)",
      !(await exists('#grid .tile[aria-label="agua"] .has-voice')),
    );
    await setSetting("#set-lang", "en");

    // Escape while recording stops and saves it.
    await page.focus("#open-caregiver");
    await page.keyboard.press("Enter");
    await page.select("#rec-button", "milk");
    await page.click("#rec-start");
    await waitFor(() => document.querySelector("#rec-status").textContent.startsWith("Recording"));
    await sleep(300);
    await page.keyboard.press("Escape");
    await waitFor(() => document.querySelector("#rec-status").textContent.startsWith("Saved"));
    check(
      "Escape while recording closes the dialog and still saves",
      !(await dialogOpen("#caregiver-dialog")) &&
        (await page.evaluate(() => document.querySelector("#rec-status").textContent)).startsWith(
          "Saved",
        ),
      await page.evaluate(() => document.querySelector("#rec-status").textContent),
    );

    await page.focus("#open-caregiver");
    await page.keyboard.press("Enter");
    await page.select("#rec-button", "water");
    await page.click("#rec-delete");
    await waitFor(() => document.querySelector("#rec-status").textContent.includes("deleted"));
    check(
      "Delete removes the recording",
      (await isDisabled("#rec-play")) && (await text("#rec-status")).includes("deleted"),
    );
    await page.click("#caregiver-close");
    await clickTab("Needs");
    check(
      "water tile no longer shows 🎙",
      !(await exists('#grid .tile[aria-label="water"] .has-voice')),
    );

    // Custom button in the strip, then delete it.
    await tap("My buttons", "Nani");
    check(
      "custom button adds a chip with its photo",
      (await stripLabels()).join() === "Nani" && (await exists("#strip .chip img")),
    );
    check("custom button speaks its label", (await lastSpoken())?.text === "Nani");
    await page.focus("#open-caregiver");
    await page.keyboard.press("Enter");
    await clickButtonText("#custom-list", "🗑 Delete"); // first one = Nani
    await waitFor(() => !document.querySelector("#custom-list").textContent.includes("Nani"));
    check("Delete removes it from the dialog list", !(await text("#custom-list")).includes("Nani"));
    await page.click("#caregiver-close");
    check("…from My buttons", !(await tiles()).includes("Nani"));
    check("…and from the sentence strip", (await stripLabels()).length === 0);

    // Edit a button: new label and category, photo and id kept.
    await page.focus("#open-caregiver");
    await page.keyboard.press("Enter");
    await clickButtonText("#custom-list", "✏️ Edit"); // Dal
    check(
      "Edit fills the form with the button",
      (await $eval("#add-label", (n) => n.value)) === "Dal" &&
        (await text("#add-save")) === "Save changes" &&
        !(await isHidden("#add-cancel")),
    );
    await clickButtonText("#add-form", "Cancel editing");
    check(
      "Cancel editing goes back to adding",
      (await $eval("#add-label", (n) => n.value)) === "" &&
        (await text("#add-save")) === "Save button",
    );
    await clickButtonText("#custom-list", "✏️ Edit");
    await page.$eval("#add-label", (n) => (n.value = "Dal rice"));
    await page.select("#add-category", "food");
    await page.click("#add-save");
    await waitFor(() => document.querySelector("#toast").textContent === "Changes saved");
    check("Save changes shows 'Changes saved'", (await text("#toast")) === "Changes saved");
    check(
      "list shows the new label and category",
      (await text("#custom-list")).includes("Dal rice") &&
        (await text("#custom-list")).includes("in Food"),
    );
    check("still only one caregiver button", (await page.$$("#custom-list li")).length === 1);
    await page.click("#caregiver-close");
    check(
      "edited button appears in Food, after the built-in food",
      (await pressedTab()).includes("Food") && (await tiles()).at(-1) === "Dal rice",
    );
    await tap("Food", "Dal rice");
    check(
      "…has the Food colour and speaks its new label",
      (await page.$eval("#strip .chip", (n) => n.dataset.key)) === "thing" &&
        (await lastSpoken())?.text === "Dal rice",
    );
    await page.click("#clear");
    await clickTab("My buttons");
    check("My buttons still lists it", (await tiles()).includes("Dal rice"));

    // ======================================================================
    begin("7b. Recent sentences, Help and vibration");
    await tap("Core", "I", "want");
    await tap("Needs", "water");
    await page.click("#speak");
    await sleep(100);
    await clickTab("Recent");
    const recent = await tiles();
    check(
      "Recent lists spoken sentences, newest first",
      recent[0] === "I want water",
      recent.join(" | "),
    );
    check("Recent holds at most 10", recent.length <= 10);
    await page.click("#clear");
    await resetSpoken();
    await clickTile(recent.find((r) => r.includes("go home")));
    await sleep(100);
    check(
      "tapping a recent sentence says it again at once",
      (await lastSpoken())?.text === "I want to go home" &&
        (await stripLabels()).length === 4 &&
        /1 tap,/.test(await text("#stats")),
      `${JSON.stringify(await lastSpoken())} ${await text("#stats")}`,
    );
    check("…and moves it to the front", (await tiles())[0] === "I want to go home");
    await page.click("#clear");

    await page.evaluate(() => (window.__vibes = []));
    await tap("Core", "yes");
    check("tapping a picture vibrates", (await page.evaluate(() => window.__vibes)).includes(15));
    await setSetting("#set-vibrate", false);
    await page.evaluate(() => (window.__vibes = []));
    await tap("Core", "no");
    check("Vibrate off: no vibration", (await page.evaluate(() => window.__vibes.length)) === 0);
    await setSetting("#set-vibrate", true);
    await page.click("#clear");

    await resetSpoken();
    await page.click("#sos");
    check("Help opens the full-screen alarm", await dialogOpen("#alarm-dialog"));
    check("alarm shows 'I need help'", (await text("#alarm-text")) === "I need help");
    await waitFor(() => window.__spoken.some((s) => s.text === "I need help"));
    check(
      "after the siren, 'I need help' is spoken",
      (await spoken()).some((s) => s.text === "I need help"),
    );
    await page.click("#alarm-stop");
    check("Stop closes the alarm", !(await dialogOpen("#alarm-dialog")));
    const afterStop = (await spoken()).length;
    await sleep(3000);
    check("…and nothing more is said", (await spoken()).length === afterStop);
    await page.click("#sos");
    await sleep(200);
    await page.keyboard.press("Escape");
    check("Escape also stops the alarm", !(await dialogOpen("#alarm-dialog")));

    // ======================================================================
    begin("8. Test mode");
    await page.click("#open-test");
    check("Test mode opens the intro", await dialogOpen("#test-dialog"));
    await clickButtonText("#test-body", "Cancel");
    check("Cancel closes it", !(await dialogOpen("#test-dialog")));

    await page.click("#open-test");
    await page.$eval("#tester", (n) => (n.value = "T1/../x"));
    await clickButtonText("#test-body", "Start");
    await sleep(100);
    check(
      "Start closes the dialog and shows task 1",
      !(await dialogOpen("#test-dialog")) && (await text("#task-banner")).includes("Task 1/5"),
    );
    check("no stray text in the banner", !(await text("#task-banner")).includes("null"));
    await page.click("#open-test");
    await sleep(50);
    check(
      "Test mode button during a test shows a hint, not a second test",
      !(await dialogOpen("#test-dialog")) && (await text("#toast")).includes("test is running"),
    );

    // Task 1: wrong answer, then right.
    await tap("Food", "milk");
    await page.click("#speak");
    await sleep(50);
    check(
      "wrong answer → 'Not quite, try again.' and same task",
      (await text("#task-banner")).includes("Not quite") &&
        (await text("#task-banner")).includes("Task 1/5"),
    );
    await tap("Core", "I", "want");
    await tap("Needs", "water");
    await page.evaluate(() => (window.__speakMs = 600)); // slow speech so the pause is long
    await page.click("#speak");
    await sleep(50);
    // Skip pressed during the pause after a correct answer must not skip task 2.
    await clickButtonText("#task-banner", "Skip");
    check(
      "while the answer is being spoken, task 1 is still shown",
      (await text("#task-banner")).includes("Task 1/5"),
    );
    await page.evaluate(() => (window.__speakMs = 30));
    await sleep(800);
    check(
      "right answer → task 2 (and an early Skip is ignored)",
      (await text("#task-banner")).includes("Task 2/5"),
      await text("#task-banner"),
    );
    await tap("Quick", "I need the toilet");
    await sleep(300);
    check("quick phrase completes task 2", (await text("#task-banner")).includes("Task 3/5"));
    await tap("Core", "I", "am");
    await tap("Feelings", "tired");
    await page.click("#speak");
    await sleep(300);
    check("task 3 done", (await text("#task-banner")).includes("Task 4/5"));
    await clickButtonText("#task-banner", "Skip");
    await sleep(100);
    check("Skip moves to task 5", (await text("#task-banner")).includes("Task 5/5"));
    await tap("Quick", "I am in pain");
    await sleep(300);
    check(
      "after 5 board tasks the typing tasks open",
      (await dialogOpen("#test-dialog")) &&
        (await text("#test-body")).includes("Typing 1/5") &&
        (await isHidden("#task-banner")),
    );

    const typeAnswer = async (value) => {
      await page.$eval("#test-body input", (n) => (n.value = ""));
      await page.type("#test-body input", value);
      await page.keyboard.press("Enter");
      await sleep(50);
    };
    await typeAnswer("I want milk");
    check(
      "wrong typing → error and the text is kept",
      (await text("#test-body")).includes("Not quite") &&
        (await $eval("#test-body input", (n) => n.value)) === "I want milk",
    );
    await typeAnswer("i want water!");
    check("typing ignores case and punctuation", (await text("#test-body")).includes("Typing 2/5"));
    await clickButtonText("#test-body", "Skip");
    check("typing Skip moves on", (await text("#test-body")).includes("Typing 3/5"));
    await typeAnswer("I am tired");
    await typeAnswer("I want to go home");
    await typeAnswer("I am in pain");
    const resultsText = await text("#test-body");
    check(
      "results screen shows the summary table",
      resultsText.includes("Results for T1/../x") &&
        resultsText.includes("Median time") &&
        resultsText.includes("Completed"),
    );
    check(
      "completion: board 80%, typing 80%",
      /Completed\s*80%\s*80%/.test(resultsText.replace(/\n/g, " ")),
      resultsText,
    );
    await clickButtonText("#test-body", "Download CSV");
    await sleep(200);
    const dl = await page.evaluate(() => window.__downloads.at(-1));
    const rows = dl?.text.trim().split("\n") ?? [];
    check("Download CSV: safe file name", dl?.name === "speakboard-T1-x.csv", dl?.name);
    check(
      "Download CSV: header + 10 rows (no double-counted task)",
      rows.length === 11 && rows[0].startsWith("tester,task"),
      `${rows.length} lines`,
    );
    await clickButtonText("#test-body", "New tester");
    check(
      "New tester → intro with 1 saved session",
      (await text("#test-body")).includes("All saved sessions (1)"),
    );
    await clickButtonText("#test-body", "Download all as CSV");
    await sleep(200);
    const all = await page.evaluate(() => window.__downloads.at(-1));
    check(
      "Download all as CSV",
      all?.name === "speakboard-all-sessions.csv" && all.text.trim().split("\n").length === 11,
    );

    // Escape during typing ends the test cleanly.
    await page.$eval("#tester", (n) => (n.value = "T2"));
    await clickButtonText("#test-body", "Start");
    for (let i = 0; i < 5; i++) {
      await clickButtonText("#task-banner", "Skip");
      await sleep(30);
    }
    check("T2 reaches typing", await dialogOpen("#test-dialog"));
    await page.keyboard.press("Escape");
    await sleep(100);
    check(
      "Escape during typing stops the test with a message",
      !(await dialogOpen("#test-dialog")) && (await text("#toast")).includes("Test stopped"),
    );
    await page.click("#open-test");
    check(
      "Test mode can be opened again afterwards",
      (await text("#test-body")).includes("Tester label"),
    );
    check(
      "the stopped test was not saved",
      (await text("#test-body")).includes("All saved sessions (1)"),
    );
    await clickButtonText("#test-body", "Delete saved sessions");
    check("Delete saved sessions", (await text("#test-body")).includes("No saved sessions yet"));
    await clickButtonText("#test-body", "Cancel");

    // Stop test from the banner.
    await page.click("#open-test");
    await clickButtonText("#test-body", "Start");
    await tap("Core", "I");
    await clickButtonText("#task-banner", "Stop test");
    check(
      "Stop test hides the banner and clears the strip",
      (await isHidden("#task-banner")) && (await stripLabels()).length === 0,
    );

    // ======================================================================
    begin("9. Phone layout");
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: "networkidle0" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check("no sideways scrolling at 375 px", !overflow);
    const targets = await page.$$eval(
      "button",
      (bs) =>
        bs
          .filter((b) => b.offsetParent && !b.closest("dialog"))
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.height < 32 || r.width < 32).length,
    );
    check("every visible button is at least 32 px", targets === 0, `${targets} too small`);

    check(
      "no JavaScript errors during the whole run",
      consoleErrors.length === 0,
      consoleErrors.join(" | "),
    );
    await context.close();

    // ======================================================================
    begin("10. Offline");
    const offlineContext = await browser.createBrowserContext();
    const off = await offlineContext.newPage();
    await off.goto(URL_, { waitUntil: "networkidle0" });
    await off.evaluate(async () => navigator.serviceWorker.ready);
    await off.reload({ waitUntil: "networkidle0" });
    await off.setOfflineMode(true);
    await off.reload({ waitUntil: "load" });
    await sleep(500);
    const offlineTiles = await off.$$eval("#grid .tile", (t) => t.length);
    check("loads with the network off", offlineTiles === 16, `${offlineTiles} tiles`);
    const grammarCached = await off.evaluate(async () =>
      Boolean(await caches.match("js/grammar.js")),
    );
    check("grammar.js is in the offline cache", grammarCached);
    await offlineContext.close();
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  [${f.section}] ${f.name}  →  ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
