# Design decisions

Short records of the key choices, the alternatives considered, and why.

## 1. Static web app (PWA) with no framework and no build step

**Chosen:** plain HTML, CSS and JavaScript ES modules, served as static files.

**Alternatives:** React or Svelte with Vite; a native Android app; Django or Node with a server.

**Why:** the target users have cheap Android phones and unreliable internet. A PWA installs from a link,
works offline and updates itself, with no app store. The app is small enough (a board, a strip and two
dialogs) that a framework would add more than it saves, and no build step means fewer things can break
before a deadline. A server would add hosting cost and a privacy risk without adding features.

**Trade-off:** no component model, so DOM updates are written by hand (`el()` helper plus full
re-render of small regions). Acceptable at this size; a framework is worth it if the UI grows a lot.

## 2. Everything stays on the device

**Chosen:** localStorage for settings and the suggestion model; IndexedDB for photos and voice clips.

**Alternatives:** a backend with accounts; Firebase; storing images as data URLs in localStorage.

**Why:** family photos and voices are private, and the app must work offline. IndexedDB stores Blobs
directly and has a much larger quota than localStorage (about 5 MB), so photos and recordings fit.
Photos are resized to 320 px JPEG (a few KB each) before saving.

**Trade-off:** data does not sync between devices and is lost if the browser data is cleared. Next
step: export/import as a file.

## 3. On-device text-to-speech, with recorded clips first

**Chosen:** the browser's Web Speech API, overridden per button by caregiver recordings
(MediaRecorder).

**Alternatives:** a cloud TTS API; bundling pre-recorded audio for every word.

**Why:** cloud TTS needs internet and keys and costs money. Bundled audio for 3 languages would be large
and would need native voice actors. Device voices are free and offline, and recordings cover the gaps
(and let the board speak in a familiar voice, which families value).

**Trade-off:** voice quality and language coverage depend on the device; the app detects a missing voice
and tells the caregiver.

## 4. Bigram model for next-picture suggestions, not an LLM

**Chosen:** count which word follows which, seeded from starter sentences and updated from what the
person actually says (real use weighted ×2). Falls back to the most-used words when a word has no
history.

**Alternatives:** a hosted LLM; a small on-device neural model; no suggestions.

**Why:** it runs instantly offline, needs no data leaving the phone, is easy to explain and to test, and
adapts to one person's vocabulary, which matters more than general language knowledge for AAC.

**Trade-off:** it only looks one word back, so it can't use longer context.

## 5. Emoji as symbols

**Chosen:** Unicode emoji plus a text label, colour-coded by category (simplified Fitzgerald key).

**Alternatives:** ARASAAC pictograms (CC BY-NC-SA); Mulberry Symbols (CC BY-SA); custom drawings.

**Why:** emoji need no download, have no licence issues and render offline on every device. Caregiver
photos cover personal items that no symbol set has.

**Trade-off:** emoji look different across platforms and some concepts ("am", "finished") have weak
emoji. Mulberry Symbols is the planned upgrade.

## 6. Built-in, measurable user test

**Chosen:** a test mode that times 5 fixed tasks on the board and then by typing, and exports CSV.

**Why:** the claim "faster than typing" should be measured, not asserted. Fixed tasks make sessions
comparable; medians (of successful attempts) are robust to one slow attempt; tester labels avoid
collecting names.

**Trade-off:** testers are mostly not AAC users, so this measures interface efficiency, not clinical
benefit. Results are reported with that caveat.

## 7. "Voice" visual design: the sentence is the hero

**Chosen:** the composed sentence is shown in very large type, and each word lights up as it is
spoken. Pictures are quiet white tiles with a thin colour bar (simplified Fitzgerald key).
Categories sit in a side rail on a laptop and a bottom tab bar on a phone. Fonts: Lexend (designed
for reading ease) and Mukta for Hindi, bundled in `src/fonts` so they work offline.

**Alternatives:** "Laminate" (looks like physical PECS cards on a velcro strip) and "Calm" (a
low-stimulation dark indigo theme). All three were built as clickable mockups in `design/`.

**Why:** the sentence is what the person is trying to say, so it should be the most visible thing on
screen; it also makes the app understandable in seconds in a demo. The word highlight is paced from
the speech rate because browsers don't report word timings reliably, and it always ends when
speaking really finishes.

**Trade-off:** big type uses vertical space, so the sentence card is sticky and compact on phones.
Calm's low-stimulation palette is a good future option for sensory-sensitive users.
