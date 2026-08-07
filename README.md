# Mandarin Speaking Practice — Version 0.6.1

A bilingual, iPad-friendly classroom tool for differentiated primary-school Mandarin speaking practice. Teachers publish one current lesson per Australian primary year level. Every lesson contains Core Practice followed by Challenge Practice, and student devices update through a Firestore realtime listener.

Pinyin is intentionally lowercase and has no tone marks. The app does not generate Pinyin or English meanings.

## Year levels and URLs

Supported publishing channels are `prep`, `year-1`, `year-2`, `year-3`, `year-4`, `year-5`, and `year-6`. Friendly labels are shown in the interface.

Student links use this format:

```text
https://<your-github-pages-domain>/speaking/student.html?year=year-6
```

Without a valid `year` parameter, Student Mode presents a year-level selector.

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

An optional `substitution` contains `{ enabled: true, targetWordId, vocabulary }`. Each vocabulary item has a stable `id`, `hanzi`, lowercase toneless `pinyin`, `meaning`, and optional `imageUrl` and `emoji`. Older documents without this field remain fully compatible.

## Interactive Vocabulary behaviour

- A vocabulary choice replaces exactly one word, matched by stable word ID; the published example is never mutated.
- Students can restore the example at any time. Choices are not written to Firestore or browser storage.
- Vocabulary Listen buttons always use device AI speech for the individual word.
- AI Voice reads the current personalised sentence. Teacher Voice plays the original recorded model and the interface explains this when a choice is active.
- Changing or restoring a choice clears that practice's temporary student recording so recordings cannot be mistaken for a different sentence.
- Images are remote URL references only. Versions 0.6.0 and 0.6.1 add no image upload or Cloud Storage path.

## Student presentation

- Voice selection and recording controls appear before the sentence so students can track the text while listening.
- Each semantic word remains an independent control, with its Pinyin centred directly above its Hanzi. Hanzi units touch visually without English-style spacing.
- Existing Chinese punctuation is kept outside the interactive word control. Older lessons without terminal punctuation receive a display-only `。` fallback.
- English meanings are on-demand: tapping or clicking a sentence word or vocabulary row opens a viewport-safe popover for about two seconds.
- On screens at least 900px wide, the practice and compact vocabulary list use an approximately 3:1 layout. Tablet portrait and phone layouts stack without horizontal scrolling.

## Teacher Voice storage

Each activity uses one fixed Cloud Storage object:

```text
teacher-recordings/{yearLevelId}/core/latest
teacher-recordings/{yearLevelId}/challenge/latest
```

Publishing a replacement overwrites only that activity’s object. Firestore stores its download URL, content type, and cache-safe revision. Only active authorised teachers can upload, replace, or delete these objects.

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

`firestore.rules` permits public reads of published approved year levels and teacher-only writes. `storage.rules` permits public reads of the two fixed Teacher Voice objects per approved year level and teacher-only writes. All other paths are denied.

## Classroom validation workflow

1. Sign in to Teacher Mode with an active allowlisted Google account.
2. Select a year level and enter its Lesson Title.
3. Edit Core and Challenge independently and configure the shared settings.
4. Optionally enable Interactive Vocabulary, choose one replaceable word, add/reorder choices, and verify the preview.
5. Record distinct Core and Challenge Teacher Voice audio.
6. Publish once and confirm the corresponding `yearLevels/{yearLevelId}` document contains both activities and optional substitution data.
7. Confirm Storage contains only `core/latest` and `challenge/latest` for that year level.
8. Open the matching student URL on a laptop, iPad, and iPhone; confirm both cards and vocabulary update without reload.
9. Select, switch, and restore vocabulary; verify only the chosen word changes and prior local recordings clear.
10. Verify vocabulary Listen and personalised AI Voice, then confirm Teacher Voice still plays the original model.
11. Replace Core audio and confirm Challenge is unchanged, then replace Challenge and confirm Core is unchanged.
12. Test AI and Teacher Voice, including independent fallback in both cards.
13. Record Core and Challenge student attempts independently, reload, and confirm both disappear and no student audio reaches Firebase.
14. Verify unauthorised users cannot publish or upload.

## File map

- `teacher.html`, `js/teacher.js` — year-level editor, dual Teacher Voice, and single-operation publishing
- `student.html`, `js/student.js` — realtime Core/Challenge practice with independent local recorders
- `js/year-levels.js` — stable year-level and practice IDs
- `js/data.js` — word-level models and differentiated defaults
- `js/teacher-audio.js` — authenticated fixed-path upload, replacement, deletion, and revisions
- `js/storage.js` — year/practice-scoped local drafts, Teacher Voice drafts, and voice preferences
- `firestore.rules`, `storage.rules`, `firebase.json` — Firebase security configuration
- `js/version.js`, `js/footer.js` — shared application version and footer
