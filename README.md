# Mandarin Speaking Practice — Version 0.9.0

A bilingual, iPad-friendly classroom tool for differentiated primary-school Mandarin speaking practice. Teachers save reusable Core + Challenge bundles in a persistent Practice Library, then publish one current saved practice per Australian primary year level. Student devices update through Firestore realtime listeners.

Pinyin is intentionally lowercase and has no tone marks. The app does not generate Pinyin or English meanings.

## Year levels and URLs

Supported publishing channels are `prep`, `year-1`, `year-2`, `year-3`, `year-4`, `year-5`, and `year-6`. Friendly labels are shown in the interface.

Student links use this format:

```text
https://<your-github-pages-domain>/speaking/student.html?year=year-6
```

Without a valid `year` parameter, Student Mode presents a year-level selector.

## Persistent practice and publishing model

Each reusable practice is stored at `speakingPractices/{practiceId}` with a stable ID, year level, title, Core and Challenge definitions, shared display/audio settings, and creation/update audit fields. Save writes this document and any pending Teacher Voice replacement. It does not affect students.

Publishing writes `speakingState/{yearLevelId}` with `currentPracticeId`, `publishedAt`, and `publishedBy`. Normal Student Mode follows that pointer. The same atomic batch also writes the legacy `yearLevels/{yearLevelId}` snapshot, preserving v0.8 clients and existing year-level URLs.

Teacher preview and Unit Library links may open a saved practice directly:

```text
https://<your-github-pages-domain>/speaking/student.html?practice=year4-australian-states-territories
```

The migration action imports existing published Year 2–6 documents with deterministic IDs. It is idempotent and retains all legacy documents and audio paths.

## Lesson model

Each year level has one Lesson Title, shared display/audio settings, and exactly two independent activities:

1. Core Practice
2. Challenge Practice

Both activities retain the word-level `id`, `hanzi`, `pinyin`, and `meaning` model. They have separate Teacher Voice files and separate session-local student recorders. A teacher may optionally select one sentence word and publish up to 20 Interactive Vocabulary choices for that position.

The current published document is:

```text
yearLevels/{yearLevelId}
```

Its shape is:

```js
{
  yearLevelId,
  yearLevelLabel,
  lessonTitle,
  practices: {
    core: { label, words, teacherAudio?, substitution? },
    challenge: { label, words, teacherAudio?, substitution? }
  },
  displaySettings: { showPinyin, showMeanings, enableHover, enableTap },
  audioSettings: { modelAudio, speechRate },
  published: true,
  updatedAt
}
```

An optional manual `substitution` contains `{ enabled: true, targetWordId, keyVocabSource: "manual", vocabulary }`. Each manual item has a stable `id`, `hanzi`, lowercase toneless `pinyin`, `meaning`, and optional `imageUrl` and `emoji`. Older documents without `keyVocabSource` remain Manual and fully compatible.

Vocabulary Library mode instead stores only `{ enabled: true, targetWordId, keyVocabSource: "vocabulary-library", vocabularySetId }`. Speaking reads the current published set from `vocabularySets/{vocabularySetId}` and each available item recording from `vocabularyTeacherVoices/{vocabularySetId}--{itemId}`. It never copies Library items or audio into the Speaking lesson. Set metadata is queried for the compact teacher selector; selected set items and voice metadata are fetched only for the active reference. Vocabulary Library remains the owner and editor of this data.

## Interactive Vocabulary behaviour

- A vocabulary choice replaces exactly one word, matched by stable word ID; the published example is never mutated.
- Students can restore the example at any time. Choices are not written to Firestore or browser storage.
- Vocabulary Listen buttons use the Vocabulary Library Teacher Voice when present and otherwise use device AI speech. The two paths remain independent.
- AI Voice reads the current personalised sentence. Teacher Voice plays the original recorded model and the interface explains this when a choice is active.
- Changing or restoring a choice clears that practice's temporary student recording so recordings cannot be mistaken for a different sentence.
- Images are remote URL references only. Versions 0.6.0–0.7.0 add no image upload or Cloud Storage path.

## Student presentation

- Voice selection and recording controls appear before the sentence so students can track the text while listening.
- Each semantic word remains an independent control, with its Pinyin centred directly above its Hanzi. Hanzi units touch visually without English-style spacing.
- Existing teacher-authored punctuation is kept outside the interactive word control. When a sentence has no ending punctuation, a Practice Title ending in `?` uses `？`, one ending in `!` uses `！`, and all other titles use `。`. AI Voice uses the same complete sentence.
- English meanings are on-demand: tapping or clicking a sentence word or vocabulary row opens a viewport-safe popover for about two seconds.
- On screens at least 900px wide, the practice and compact vocabulary list use an approximately 3:1 layout. Tablet portrait and phone layouts stack without horizontal scrolling.

## Teacher Voice storage

New recordings use one fixed Cloud Storage object per stable saved practice and activity:

```text
teacher-recordings/practices/{practiceId}/core/latest
teacher-recordings/practices/{practiceId}/challenge/latest
```

Legacy recordings remain available at:

```text
teacher-recordings/{yearLevelId}/core/latest
teacher-recordings/{yearLevelId}/challenge/latest
```

Saving a replacement overwrites only that saved practice activity’s object. Firestore stores its download URL, content type, and cache-safe revision. Only active authorised teachers can upload, replace, or delete these objects.

## Privacy boundaries

- Students do not sign in.
- No student names, identifiers, results, or submissions are collected.
- Core and Challenge student recordings use separate temporary browser object URLs.
- Student recordings disappear on reload and have no Firestore or Cloud Storage write path.
- Teacher Voice is the only cloud-hosted audio.
- No service-account keys belong in this repository.

## Firebase setup and rules

1. Configure the public web app in `js/firebase-config.js`.
2. Enable Google Authentication and add the GitHub Pages host to authorised domains.
3. Create Firestore and Cloud Storage in production mode.
4. Create `authorizedTeachers/{teacherUid}` with `active: true` for each teacher.
5. Enable the documented Storage Rules cross-service permission so Storage can read the Firestore allowlist.
6. Deploy both rulesets:

```sh
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage
```

`firestore.rules` permits public reads of published approved year levels, published Vocabulary Library sets, and individual Teacher Voice metadata; it does not allow Speaking to write either Vocabulary Library collection. `storage.rules` permits public audio reads and teacher-only writes. All other paths are denied.

## Classroom validation workflow

1. Sign in to Teacher Mode with an active allowlisted Google account.
2. Select a year level and enter its Lesson Title.
3. Edit Core and Challenge independently and configure the shared settings.
4. Optionally enable Interactive Vocabulary, choose one replaceable word, add/reorder choices, and verify the preview.
5. Record distinct Core and Challenge Teacher Voice audio.
6. Save the practice and confirm `speakingPractices/{practiceId}` contains both activities and optional substitution data.
7. Publish it and confirm `speakingState/{yearLevelId}.currentPracticeId` plus the compatibility `yearLevels/{yearLevelId}` snapshot.
8. Confirm Storage contains only one `latest` object per Core/Challenge slot for the stable practice.
9. Open the matching student URL on a laptop, iPad, and iPhone; confirm both cards and vocabulary update without reload.
10. Select, switch, and restore vocabulary; verify only the chosen word changes and prior local recordings clear.
11. Verify vocabulary Listen and personalised AI Voice, then confirm Teacher Voice still plays the original model.
12. Replace Core audio and confirm Challenge is unchanged, then replace Challenge and confirm Core is unchanged.
13. Test AI and Teacher Voice, including independent fallback in both cards.
14. Record Core and Challenge student attempts independently, reload, and confirm both disappear and no student audio reaches Firebase.
15. Verify unauthorised users cannot publish or upload.

## File map

- `teacher.html`, `js/teacher.js` — persistent library UI, editor, Save/Publish controls, and dual Teacher Voice
- `js/speaking-practices.js` — stable practice persistence, migration, duplication, soft deletion, pointers, and compatibility snapshots
- `student.html`, `js/student.js` — pointer/direct-reference realtime Core/Challenge practice with independent local recorders
- `js/year-levels.js` — stable year-level and practice IDs
- `js/data.js` — word-level models and differentiated defaults
- `js/teacher-audio.js` — authenticated fixed-path upload, replacement, deletion, and revisions
- `js/storage.js` — year/practice-scoped local drafts, Teacher Voice drafts, and voice preferences
- `firestore.rules`, `storage.rules`, `firebase.json` — Firebase security configuration
- `js/version.js`, `js/footer.js` — shared application version and footer
