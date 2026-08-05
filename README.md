# Mandarin Speaking Practice — Version 0.5.0

A bilingual, iPad-friendly classroom tool for primary-school Mandarin learners. Teachers publish one current word-level practice to a fixed classroom room; student iPads update through a Firestore realtime listener.

Pinyin is intentionally lowercase and has no tone marks. The app does not generate Pinyin or English meanings.

## Pilot rooms

`6B`, `6D`, `5C`, `5E`, `4B`, `4C`, `4D`, `3A`, `3B`

Student links use this format:

```text
https://<your-github-pages-domain>/speaking/student.html?room=6B
```

Without a `room` parameter, Student Mode asks for one of the approved room codes.

## Privacy boundaries

- No student names, accounts, identifiers, results or submissions are collected.
- Students do not sign in.
- Student recordings use temporary browser object URLs and never leave the current browser session.
- Only published room practice data is downloaded to student devices.
- Student recordings remain session-local browser object URLs and have no Firebase upload path.
- Teacher model recordings are the only cloud-hosted audio. Each room uses one fixed Storage object that is replaced on republish.
- No service-account keys belong in this repository.

## Firebase project setup

### 1. Create and register the web app

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. From **Project settings → Your apps**, register a Web app.
3. Copy its public web configuration into `js/firebase-config.js`, replacing every `REPLACE_ME` value.
4. Do not add a service-account JSON key. The browser configuration is public; security comes from Authentication and the deployed rules.

The site imports the modular Firebase Web SDK from Firebase's official CDN, which keeps the project compatible with GitHub Pages without a build step.

### 2. Enable Cloud Firestore

1. Open **Build → Firestore Database**.
2. Create a database in the region appropriate for the school.
3. Start in locked/production mode. Do not use open test rules.

Published practices are stored as one document per room:

```text
rooms/{roomId}
```

Each document contains `roomId`, `title`, `words`, `displaySettings`, `audioSettings`, optional `teacherAudio` linkage, `published`, and the server timestamp `updatedAt`.

Teacher recordings are uploaded to the single fixed object `teacher-recordings/{roomId}/latest`. Publishing a replacement overwrites that object and updates the Firestore linkage so subscribed student devices receive the new revision.

### 3. Enable Cloud Storage

Upgrade the Firebase project to the Blaze plan, create the default Cloud Storage bucket, and deploy the included locked-down Storage rules. Public reads are restricted to the fixed pilot-room teacher recording paths. Only active authorised teachers may create, replace or delete those objects.

### 4. Enable Google Authentication

1. Open **Build → Authentication → Sign-in method**.
2. Enable **Google** and select the project support email.
3. In **Authentication → Settings → Authorized domains**, add the GitHub Pages host, for example `themandarinroom.github.io`.
4. Keep student pages unauthenticated. Google sign-in is used only by Teacher Mode.

### 5. Authorise a teacher account

The security rules require both a verified Firebase Authentication account and an explicit allowlist document.

1. Sign in to Teacher Mode once with the intended Google account. The first publish remains blocked.
2. In **Firebase Console → Authentication → Users**, copy that teacher's UID.
3. In Firestore, manually create this document using the console's trusted administrator access:

```text
authorizedTeachers/{teacherUid}
```

Add one Boolean field:

```text
active: true
```

4. Reload Teacher Mode. The account can now load and publish rooms.

Do not create this allowlist from client-side code. The included rules deny all client writes to `authorizedTeachers`.

### 6. Deploy Firebase security rules

Install and authenticate the Firebase CLI, select the correct Firebase project, then deploy both rule files:

```sh
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage
```

Files:

- `firestore.rules` — public reads only for published fixed-room documents; writes only for active authorised teachers.
- `storage.rules` — public reads only for fixed teacher-audio objects; writes only for active authorised teachers.
- `firebase.json` — Firestore and Storage rule deployment configuration.

Test rules in the Firebase Emulator Suite before production changes when possible.

## GitHub Pages

Keep hosting through GitHub Pages. In repository settings, publish the `main` branch from the repository root. No Firebase Hosting deployment is required.

After updating `js/firebase-config.js`, commit that public browser configuration and let GitHub Pages deploy normally.

## Classroom test plan

1. Open `teacher.html` on the teacher computer.
2. Sign in with the allowlisted Google account.
3. Select one pilot room, such as `6B`.
4. Edit Hanzi, lowercase tone-less Pinyin, meanings and display/audio settings.
5. Optionally record teacher model audio, then select AI Voice, Teacher Voice or Student choice.
6. Open `student.html?room=6B` on several student iPads. They should show the waiting screen before the first publish.
7. Click **Publish to Class** on the teacher computer.
8. Confirm every iPad updates without reloading and can play Teacher Voice. Republish a replacement and confirm each device receives it.
9. Remove or make the teacher recording unavailable and confirm Student Mode shows the non-blocking fallback message and uses AI Voice.
10. Record and play a student attempt on one iPad. Confirm no recording appears in Firestore or Storage and that reloading clears the recording.
11. Test an invalid room and Student Mode without a room parameter.

## File map

- `index.html` — Teacher/Student mode chooser
- `teacher.html` — authenticated room editor and publishing UI
- `student.html` — anonymous realtime room listener and local recorder
- `css/styles.css` — shared responsive and accessible styles
- `js/firebase-config.js` — public Firebase browser configuration
- `js/firebase.js` — lazy Firebase modular SDK initialisation
- `js/rooms.js` — fixed pilot-room validation
- `js/data.js` — word-level practice schema and lowercase Pinyin cleaning
- `js/teacher.js`, `js/teacher-audio.js` — local editing, teacher-only Storage upload and Firestore publish workflow
- `js/student.js` — realtime room updates and session-local recording
- `js/recorder.js`, `js/speech.js`, `js/translations.js`, `js/storage.js` — shared features
- `js/version.js`, `js/footer.js` — global application version and shared footer rendering
- `firestore.rules`, `storage.rules`, `firebase.json` — Firebase security configuration

## Firebase references

- [Add Firebase to a JavaScript project](https://firebase.google.com/docs/web/setup)
- [Google sign-in for web](https://firebase.google.com/docs/auth/web/google-signin)
- [Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
