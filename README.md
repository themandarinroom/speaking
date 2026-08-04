# Mandarin Speaking Practice — Version 0.3

A bilingual, device-local classroom tool for primary-school Mandarin learners.

## Pages

- `index.html` — mode chooser
- `teacher.html` — word-level sentence editor, lesson settings and teacher model recording
- `student.html` — interactive word meanings, model audio and student recording practice

The default practice uses lowercase Pinyin without tone marks:

| Hanzi | Pinyin | English |
| --- | --- | --- |
| 我 | wo | I / me |
| 喜欢 | xi huan | like |
| 学习 | xue xi | study |
| 中文 | zhong wen | Chinese |

## Privacy

Practice data, settings and the optional teacher model recording are stored in the browser using `localStorage`. Student recordings use temporary browser object URLs and remain in the current browser session. Nothing is uploaded, and the app has no database, login or external API.

## Run locally

Serve the folder through a local web server so JavaScript modules can load. For example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
