# Every control and how it should behave

This is the specification the automated browser check (`npm run test:e2e`) verifies.
Each row lists the control, what it must do, and what must _not_ happen.

## Board

| Control                         | Expected behaviour                                                                                                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Word picture** (59)           | Adds the word to the end of the sentence strip. If "Speak each picture" is on, says the word, using the caregiver's recording for this language if there is one. If the strip was just spoken, the strip is cleared first so a new sentence starts. The strip holds at most 20 pictures. |
| **Quick phrase** (12)           | Says the whole phrase straight away. Does not change the strip. Counts as one message.                                                                                                                                                                                                   |
| **Custom picture** (My buttons) | Same as a word picture; shows the caregiver's photo in the strip.                                                                                                                                                                                                                        |
| **Speak**                       | Says the sentence with word order fixed for the language (for example "मुझे पानी चाहिए"). Marks the strip as spoken and shows "Last message: N taps, X s". Pressing it again repeats the sentence without changing the stats. Disabled when the strip is empty.                            |
| **Undo**                        | Removes the last picture and stops any speech. Disabled when the strip is empty.                                                                                                                                                                                                         |
| **Clear**                       | Empties the strip, stops speech, and starts a fresh tap count for the next message. Disabled when the strip is empty.                                                                                                                                                                    |
| **Suggestion** (4 chips)        | Same as tapping that picture. Suggestions are the words this person most often says next, and the row is never empty.                                                                                                                                                                    |
| **Category** (9)                | Shows that category's pictures and is marked as selected. My buttons shows a hint when it is empty.                                                                                                                                                                                      |
| **Recent** category             | Lists the last 10 sentences spoken, newest first (a repeat moves to the front). Tapping one puts it in the strip and says it at once, as a 1-tap message. Explains itself when empty.                                                                                                    |
| **Big sentence**                | Shows the exact sentence Speak will say, in large type (word order fixed for the language). While speaking, each word lights up in turn; a quick phrase is shown there while it is spoken. Shows a hint when the strip is empty.                                                         |
| **Help** (red)                  | Opens a full-screen red "I need help" (in the board's language), vibrates, plays a siren and then speaks the phrase, repeating until **Stop** or Escape.                                                                                                                                 |

## Settings

| Control                              | Expected behaviour                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settings** button                  | Opens Settings showing the current values.                                                                                                                            |
| **Language**                         | Changes every picture, category, button label and the speech language (en-US, hi-IN, es-ES). If the device has no voice for it, a warning banner explains what to do. |
| **Button size**                      | Small, Medium or Large pictures.                                                                                                                                      |
| **Word forms**                       | Male or Female forms for words that change with the speaker (Hindi "थका हुआ / थकी हुई", Spanish "cansado / cansada").                                                   |
| **Speak each picture when tapped**   | When off, tapping a picture is silent; Speak still speaks.                                                                                                            |
| **Vibrate when a picture is tapped** | A short buzz on each tap (phones that support it). Off = no vibration.                                                                                                |
| **Speech speed**                     | Applied to the next thing spoken.                                                                                                                                     |
| **Close** / Escape                   | Closes Settings. All settings are remembered after reloading.                                                                                                         |

## Caregiver tools

| Control                   | Expected behaviour                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caregiver** button      | Opens only after a 1-second press (a tap or a short press does nothing), so the user can't open it by accident. Keyboard Enter opens it directly.                                             |
| **Label**                 | Required, up to 40 characters. Blank → "Please enter a label."                                                                                                                                |
| **Photo**                 | Optional. Camera or gallery. Shrunk to 320 px before saving. A file that isn't a readable image → a friendly error.                                                                           |
| **Category**              | Where the button appears: My buttons only, or also in People, Food, Places, Needs, Feelings, Actions or Core (with that category's colour).                                                   |
| **✏️ Edit** (My buttons)  | Fills the form with that button. **Save changes** keeps its photo (unless a new one is chosen), its recordings and its id, and shows "Changes saved". **Cancel editing** goes back to adding. |
| **Save button**           | Saves the button on this device, clears the form, switches to My buttons and shows "Button saved". Disabled while saving so a double tap adds only one button.                                |
| **Button (record list)**  | Every picture, in the current language. 🎙 marks those with a recording. Locked while recording.                                                                                               |
| **● Record**              | Asks for the microphone, records up to 8 seconds. Disabled while recording.                                                                                                                   |
| **■ Stop**                | Stops and saves the recording for the chosen picture and language. From then on that picture plays the recording instead of the device voice.                                                 |
| **▶ Play** / **🗑 Delete** | Play the recording / delete it (the device voice is used again). Disabled when there is no recording.                                                                                         |
| **🗑 Delete** (My buttons) | After confirming, deletes the button and its recordings, and removes it from the strip.                                                                                                       |
| **Done** / Escape         | Closes the tools. A recording in progress is stopped and saved.                                                                                                                               |

## Test mode

| Control                   | Expected behaviour                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test mode** button      | Opens the intro. During a running test it shows a hint instead of starting a second test.                                                                                             |
| **Start**                 | Closes the dialog and shows "Task 1/5" above the strip, in the board's language and word form.                                                                                        |
| Board task                | A wrong answer shows "Not quite, try again." A right answer is recorded, the sentence finishes speaking, then the next task appears.                                                  |
| **Skip** (board)          | Records the task as not completed and moves on. Ignored while a correct answer is still being spoken.                                                                                 |
| **Stop test**             | Ends the test without saving, hides the banner and clears the strip.                                                                                                                  |
| Typing task               | Enter or **Done** checks the text (case and punctuation ignored). A wrong answer keeps the typed text. **Skip** moves on. Escape ends the test with "Test stopped" and saves nothing. |
| Results                   | Board vs typing: median time, median taps/keys, % completed, and "N× faster" only if the board really was faster.                                                                     |
| **Download CSV**          | Downloads this tester's 10 rows. The file name is made safe (for example "T1/../x" → "speakboard-T1-x.csv").                                                                          |
| **New tester**            | Back to the intro, which lists all saved sessions.                                                                                                                                    |
| **Download all as CSV**   | One file with every saved session.                                                                                                                                                    |
| **Delete saved sessions** | After confirming, deletes all saved sessions on this device.                                                                                                                          |
| **Cancel** / **Close**    | Closes the dialog.                                                                                                                                                                    |

## Whole app

- No JavaScript errors during any of the above.
- No sideways scrolling on a 375 px wide phone, and every visible button is at least 32 px.
- After one visit, the app loads and works with the network switched off.
