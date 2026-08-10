# Changelog

## Version 0.7.0 — August 2026

### Changed

- Speaking Practice now uses the Vocabulary Library’s green-and-cream visual system across the home and student year-level pages
- The home page now provides direct year-level entry and reveals Teacher Mode only after an authorised teacher signs in
- Student lesson identity appears above the practice card, with responsive, compact lesson titles and year badges
- Core and Challenge Mandarin sentences now appear directly below their English titles, centred with word-level Pinyin alignment preserved
- Key Vocabulary, practice sections, controls, and footer branding use a lighter, more compact responsive presentation
- Language switching now sits beside the version in the footer, while The Mandarin Room brand provides the home-page link

## Version 0.6.2 — August 2026

### Fixed

- Automatic sentence-ending punctuation now follows the Practice Title: questions use `？`, exclamations use `！`, and other titles use `。`
- Teacher-authored sentence punctuation remains authoritative and survives Interactive Vocabulary substitution
- AI Voice uses the same complete, full-width-punctuation sentence shown to students

## Version 0.6.1 — August 2026

### Changed

- Student controls now appear immediately above the Mandarin sentence
- Student sentences use continuous Hanzi with aligned word-level Pinyin and Chinese punctuation
- English meanings now appear in temporary popovers instead of a permanent panel
- Key Vocabulary now uses a compact responsive list with accessible speaker controls

## Version 0.6.0 — August 2026

### Added

- Optional Interactive Vocabulary sets for Core and Challenge Practice
- Stable-ID sentence substitution with up to 20 teacher-authored choices
- Touch-friendly student vocabulary cards with image, emoji, or text fallbacks
- Per-item AI pronunciation and a one-tap Restore Example action
- Teacher preview for vocabulary substitutions before publishing

### Changed

- AI Voice reads the student’s current personalised sentence
- Teacher Voice remains the original recorded teacher model
- Changing a vocabulary choice clears only that practice’s local student recording

### Privacy

- Student vocabulary choices and recordings remain local to the browser
- Vocabulary images are referenced by URL; the app adds no image upload or new Storage path

## Version 0.5.1 — August 2026

### Added

- Australian primary year levels
- Lesson Title
- Core Practice
- Challenge Practice
- Separate Teacher Voice for both practices
- Independent student practice recordings

### Changed

- Publishing channels now use year levels instead of class codes

### Fixed

- Teacher Voice uploads now verify the active Firebase Auth user and shared app instance before starting
- Firebase upload failures now display their actual error details

## Version 0.5.0 — August 2026

### Added

- Teacher Voice Cloud Storage
- Cross-device Teacher Voice playback
- AI Voice automatic fallback
- Teacher recording replacement
- Upload progress
- Improved error handling
- Global version management
- Application footer branding
