// Test mode: a small, repeatable user test.
//
// The tester says 5 everyday messages with SpeakBoard, then types the same 5 messages
// on the keyboard. The app times each one and counts taps or keystrokes, then shows
// a summary and lets you download the raw results as CSV. No names are needed: use a
// label such as "T1".

import { TASKS, isTaskComplete, isTypedMatch, promptFor, summarize, toCSV } from "./metrics.js";

import { t } from "./i18n.js";

const SESSIONS_KEY = "speakboard.test-sessions.v1";
const $ = (selector) => document.querySelector(selector);

function loadSessions() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Storage is blocked: results are still shown and can be downloaded.
  }
}

/** A safe file name from a tester label ("T1/a b" -> "T1-a-b"). */
export function safeFileName(label) {
  return (
    String(label)
      // Keep letters, combining marks (needed for Hindi), digits, "_" and "-".
      .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "tester"
  );
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initTestMode(app) {
  const dialog = $("#test-dialog");
  const body = $("#test-body");
  const el = app.el;
  let session = null;

  const elapsed = () => (performance.now() - session.taskStart) / 1000;

  function record(success, taps) {
    const task = TASKS[session.index];
    session.trials.push({
      taskId: task.id,
      condition: session.phase,
      lang: session.lang,
      seconds: elapsed(),
      taps,
      success,
    });
  }

  function stop() {
    app.setOnMessage(null);
    app.setTaskBanner(null);
    session = null;
  }

  const promptOf = (task) => promptFor(task, session.lang, session.gender);

  // Escape closes a <dialog> without going through our buttons. If that happens in the
  // middle of the typing tasks, end the test instead of leaving it stuck half-way.
  dialog.addEventListener("close", () => {
    if (session?.phase === "typing") {
      stop();
      app.toast("Test stopped. Results were not saved.");
    }
  });

  // ----- Intro -----

  function renderIntro() {
    const tester = el("input", {
      id: "tester",
      maxlength: "20",
      placeholder: "e.g. T1",
      value: "",
    });
    body.replaceChildren(
      el(
        "p",
        {},
        `The tester says ${TASKS.length} everyday messages with SpeakBoard, then types the same messages on the keyboard. Each one is timed. Use a label, not a real name.`,
      ),
      el("label", {}, "Tester label", tester),
      el(
        "div",
        { class: "row end" },
        el("button", { type: "button", onclick: () => dialog.close() }, "Cancel"),
        el(
          "button",
          {
            type: "button",
            class: "primary",
            onclick: () => startBoard(tester.value.trim().slice(0, 20) || "anonymous"),
          },
          "Start",
        ),
      ),
      renderPastSessions(),
    );
  }

  function renderPastSessions() {
    const sessions = loadSessions();
    if (sessions.length === 0) return el("p", { class: "hint" }, "No saved sessions yet.");
    const allTrials = sessions.flatMap((s) => s.trials);
    return el(
      "section",
      {},
      el("h3", {}, `All saved sessions (${sessions.length})`),
      renderSummary(summarize(allTrials)),
      el(
        "div",
        { class: "row" },
        el(
          "button",
          {
            type: "button",
            onclick: () =>
              download(
                "speakboard-all-sessions.csv",
                sessions
                  .map((s, i) =>
                    toCSV(s.trials, s.tester)
                      .split("\n")
                      .slice(i === 0 ? 0 : 1)
                      .join("\n"),
                  )
                  .join(""),
              ),
          },
          "Download all as CSV",
        ),
        el(
          "button",
          {
            type: "button",
            onclick: () => {
              if (!confirm("Delete all saved test sessions on this device?")) return;
              saveSessions([]);
              renderIntro();
            },
          },
          "Delete saved sessions",
        ),
      ),
    );
  }

  // ----- Board condition -----

  function startBoard(tester) {
    session = {
      tester,
      lang: app.lang(),
      gender: app.gender(),
      trials: [],
      phase: "board",
      index: 0,
      taps: 0,
      advancing: false, // true between a correct answer and the next task
    };
    dialog.close();
    app.setOnMessage(onBoardMessage);
    showBoardTask();
  }

  function showBoardTask(feedback = "") {
    const task = TASKS[session.index];
    if (!feedback) {
      app.clearSentence();
      app.resetMessage();
      session.startTaps = app.totalTaps();
      session.taskStart = performance.now();
    }
    app.setTaskBanner([
      el("span", {}, `Task ${session.index + 1}/${TASKS.length}: say `),
      el("strong", {}, `“${promptOf(task)}”`),
      feedback ? el("span", { class: "feedback" }, feedback) : null,
      el(
        "button",
        {
          type: "button",
          class: "tool",
          onclick: () => {
            if (!session || session.advancing) return;
            record(false, app.totalTaps() - session.startTaps);
            nextBoardTask();
          },
        },
        "Skip",
      ),
      el(
        "button",
        {
          type: "button",
          class: "tool",
          onclick: () => {
            stop();
            app.clearSentence();
          },
        },
        "Stop test",
      ),
    ]);
  }

  async function onBoardMessage({ ids, spoken }) {
    if (session.advancing) return; // already correct; waiting for the next task
    if (!isTaskComplete(TASKS[session.index], ids)) {
      showBoardTask("Not quite, try again.");
      return;
    }
    record(true, app.totalTaps() - session.startTaps);
    session.advancing = true;
    const current = session;
    // Let the message finish speaking (at most 4 s) before the next task appears.
    await Promise.race([spoken, new Promise((resolve) => setTimeout(resolve, 4000))]);
    if (session !== current) return; // the test was stopped meanwhile
    session.advancing = false;
    nextBoardTask();
  }

  function nextBoardTask() {
    session.index += 1;
    if (session.index < TASKS.length) showBoardTask();
    else startTyping();
  }

  // ----- Typing condition (the baseline) -----

  function startTyping() {
    app.setOnMessage(null);
    app.setTaskBanner(null);
    app.clearSentence();
    session.phase = "typing";
    session.index = 0;
    dialog.showModal();
    showTypingTask();
  }

  function showTypingTask(feedback = "", keepTimer = false, previousText = "") {
    const task = TASKS[session.index];
    const prompt = promptOf(task);
    if (!keepTimer) {
      session.taps = 0;
      session.taskStart = performance.now();
    }
    const input = el("input", {
      autocomplete: "off",
      autocapitalize: "off",
      lang: session.lang,
      "aria-label": "Type the message",
      value: previousText, // keep what was typed when asking to try again
      onkeydown: () => (session.taps += 1),
    });
    const form = el(
      "form",
      {
        class: "stack",
        onsubmit: (event) => {
          event.preventDefault();
          if (isTypedMatch(prompt, input.value)) {
            record(true, session.taps);
            nextTypingTask();
          } else {
            showTypingTask("Not quite, check the spelling and try again.", true, input.value);
          }
        },
      },
      el(
        "p",
        {},
        `Typing ${session.index + 1}/${TASKS.length}: type this message, then press Enter.`,
      ),
      el("p", { class: "big-number" }, prompt),
      input,
      feedback ? el("p", { class: "error" }, feedback) : null,
      el(
        "div",
        { class: "row end" },
        el(
          "button",
          {
            type: "button",
            onclick: () => {
              record(false, session.taps);
              nextTypingTask();
            },
          },
          "Skip",
        ),
        el("button", { type: "submit", class: "primary" }, "Done"),
      ),
    );
    body.replaceChildren(form);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function nextTypingTask() {
    session.index += 1;
    if (session.index < TASKS.length) showTypingTask();
    else showResults();
  }

  // ----- Results -----

  function renderSummary(summary) {
    const cell = (value, suffix = "") => (value === null ? "–" : `${value}${suffix}`);
    return el(
      "div",
      { class: "stack" },
      summary.speedup === null
        ? null
        : summary.speedup > 1
          ? el("p", { class: "big-number" }, `${summary.speedup}× faster than typing`)
          : el("p", { class: "hint" }, "Typing was as fast or faster for this tester."),
      el(
        "table",
        { class: "results" },
        el("tr", {}, el("th", {}, ""), el("th", {}, "SpeakBoard"), el("th", {}, "Typing")),
        el(
          "tr",
          {},
          el("td", {}, "Median time"),
          el("td", {}, cell(summary.board.medianSeconds, " s")),
          el("td", {}, cell(summary.typing.medianSeconds, " s")),
        ),
        el(
          "tr",
          {},
          el("td", {}, "Median taps / keys"),
          el("td", {}, cell(summary.board.medianTaps)),
          el("td", {}, cell(summary.typing.medianTaps)),
        ),
        el(
          "tr",
          {},
          el("td", {}, "Completed"),
          el("td", {}, cell(summary.board.successRate, "%")),
          el("td", {}, cell(summary.typing.successRate, "%")),
        ),
      ),
    );
  }

  function showResults() {
    const finished = session;
    stop();
    const sessions = loadSessions();
    sessions.push({
      tester: finished.tester,
      date: new Date().toISOString(),
      trials: finished.trials,
    });
    saveSessions(sessions);
    body.replaceChildren(
      el("h3", {}, `Results for ${finished.tester}`),
      renderSummary(summarize(finished.trials)),
      el(
        "div",
        { class: "row end" },
        el(
          "button",
          {
            type: "button",
            onclick: () =>
              download(
                `speakboard-${safeFileName(finished.tester)}.csv`,
                toCSV(finished.trials, finished.tester),
              ),
          },
          "Download CSV",
        ),
        el("button", { type: "button", onclick: renderIntro }, "New tester"),
        el("button", { type: "button", class: "primary", onclick: () => dialog.close() }, "Close"),
      ),
    );
  }

  return {
    open() {
      if (session) {
        app.toast(t(app.lang(), "testRunning"));
        return;
      }
      renderIntro();
      dialog.showModal();
    },
  };
}
