import { hasSentenceEndingPunctuation, normalizePractice, normalizeDifferentiatedPractice, practiceTitlePunctuation, splitWordPunctuation, substitutePracticeWords } from "./data.js";
import { LocalRecorder } from "./recorder.js";
import { speakMandarin } from "./speech.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { YEAR_LEVELS, PRACTICE_IDS, isValidYearLevelId, normalizeYearLevelId, yearLevelLabel } from "./year-levels.js";
import { loadYearVoiceMode, saveYearVoiceMode } from "./storage.js";
import { cacheSafeAudioUrl } from "./teacher-audio.js";
import { initPageTranslations, applyTranslations, formatText, t } from "./translations.js";

const yearLevelId = normalizeYearLevelId(new URLSearchParams(location.search).get("year"));
let lessonTitle = "";
let settings = normalizePractice(null).settings;
let receivedContent = false;
let unsubscribeYearLevel = null;
const practices = { core: null, challenge: null };

const yearEntry = document.getElementById("yearEntry");
const yearLevelEntry = document.getElementById("yearLevelEntry");
const waitingScreen = document.getElementById("waitingScreen");
const waitingYear = document.getElementById("waitingYear");
const practiceContent = document.getElementById("practiceContent");
const yearBadge = document.getElementById("yearBadge");
const lessonHeading = document.getElementById("lessonHeading");
const studentCardIntro = document.getElementById("studentCardIntro");
const studentPageOverview = document.getElementById("studentPageOverview");
const studentPageHeading = document.getElementById("studentPageHeading");
const studentPageBadge = document.getElementById("studentPageBadge");

function showYearEntry() { yearEntry.hidden = false; waitingScreen.hidden = true; practiceContent.hidden = true; studentPageOverview.hidden = true; studentCardIntro.hidden = false; }
function showWaiting(messageKey = "waitingTeacher") { yearEntry.hidden = true; waitingScreen.hidden = false; practiceContent.hidden = true; studentPageOverview.hidden = true; studentCardIntro.hidden = false; waitingScreen.querySelector("h2").textContent = t(messageKey); waitingYear.textContent = yearLevelId ? yearLevelLabel(yearLevelId) : ""; }

class StudentPractice {
  constructor(id) {
    this.id = id; this.data = normalizeDifferentiatedPractice(null, ""); this.label = ""; this.teacherAudioUrl = ""; this.selectedWordId = null; this.selectedVocabularyId = ""; this.meaningTimer = null;
    const storedVoice = yearLevelId ? loadYearVoiceMode(yearLevelId, id) : null;
    this.hasVoicePreference = Boolean(storedVoice); this.selectedVoice = storedVoice || "ai"; this.studentAudioUrl = ""; this.recorder = new LocalRecorder();
    this.root = document.querySelector(`[data-student-practice="${id}"]`); this.sentence = this.root.querySelector(`[data-sentence="${id}"]`); this.status = this.root.querySelector(`[data-status="${id}"]`); this.studentAudio = this.root.querySelector(`[data-student-audio="${id}"]`); this.modelAudio = this.root.querySelector(`[data-model-audio="${id}"]`);
    this.sentence.classList.add("student-title-sentence"); this.root.querySelector(`[data-practice-title="${id}"]`).after(this.sentence);
    this.popover = document.createElement("div"); this.popover.className = "meaning-popover"; this.popover.hidden = true; this.popover.setAttribute("role", "status"); this.popover.setAttribute("aria-live", "polite"); document.body.append(this.popover);
    this.pinyinPositionFrame = 0; this.queuePinyinPosition = () => { cancelAnimationFrame(this.pinyinPositionFrame); this.pinyinPositionFrame = requestAnimationFrame(() => this.positionPinyin()); }; window.addEventListener("resize", this.queuePinyinPosition);
    this.bindControls();
  }

  currentWords() { return substitutePracticeWords(this.data.words, this.data.substitution, this.selectedVocabularyId); }
  fallbackPunctuation() { return practiceTitlePunctuation(this.label); }

  clearStudentRecording(messageKey = "") {
    this.recorder.clear();
    if (this.studentAudioUrl) URL.revokeObjectURL(this.studentAudioUrl);
    this.studentAudioUrl = ""; this.studentAudio.pause(); this.studentAudio.removeAttribute("src");
    this.root.querySelector(`[data-record="${this.id}"]`).disabled = false;
    this.root.querySelector(`[data-stop="${this.id}"]`).disabled = true;
    this.root.querySelector(`[data-play="${this.id}"]`).disabled = true;
    this.root.querySelector(`[data-reset="${this.id}"]`).disabled = true;
    if (messageKey) this.status.textContent = t(messageKey);
  }

  bindControls() {
    this.root.querySelector(".voice-choices").addEventListener("click", event => { const button = event.target.closest("button[data-voice]"); if (!button) return; this.hasVoicePreference = true; this.selectedVoice = button.dataset.voice; if (this.selectedVoice === "teacher" && !this.teacherAudioUrl) this.useAiFallback(); else { saveYearVoiceMode(yearLevelId, this.id, this.selectedVoice); this.renderVoice(); } });
    this.root.querySelector(`[data-listen="${this.id}"]`).addEventListener("click", () => this.listen());
    const record = this.root.querySelector(`[data-record="${this.id}"]`); const stop = this.root.querySelector(`[data-stop="${this.id}"]`); const play = this.root.querySelector(`[data-play="${this.id}"]`); const reset = this.root.querySelector(`[data-reset="${this.id}"]`);
    record.addEventListener("click", async () => { try { if (this.studentAudioUrl) { URL.revokeObjectURL(this.studentAudioUrl); this.studentAudioUrl = ""; } await this.recorder.start(); this.status.textContent = t("studentRecording"); record.disabled = true; stop.disabled = false; play.disabled = true; reset.disabled = true; } catch (error) { this.status.textContent = t(error.name === "NotAllowedError" ? "microphoneDenied" : error.message === "recordingUnsupported" ? "recordingUnsupported" : "recordingFailed"); } });
    stop.addEventListener("click", async () => { const result = await this.recorder.stop(); if (!result) return; this.studentAudioUrl = result.url; this.studentAudio.src = result.url; this.status.textContent = t("studentRecorded"); record.disabled = false; stop.disabled = true; play.disabled = false; reset.disabled = false; });
    play.addEventListener("click", async () => { try { this.studentAudio.currentTime = 0; await this.studentAudio.play(); this.status.textContent = t("playing"); } catch { this.status.textContent = t("playbackFailed"); } });
    reset.addEventListener("click", () => this.clearStudentRecording("cleared"));
    this.root.querySelector(`[data-restore-example="${this.id}"]`).addEventListener("click", () => this.chooseVocabulary(""));
  }

  update(value) {
    this.label = String(value?.label || t(this.id === "core" ? "corePractice" : "challengePractice"));
    const previousSentence = this.currentWords().map(word => [word.id, word.hanzi, word.pinyin, word.meaning]);
    const previousVocabularyId = this.selectedVocabularyId;
    this.data = normalizeDifferentiatedPractice(value, this.label); this.teacherAudioUrl = cacheSafeAudioUrl(value?.teacherAudio); this.selectedWordId = null;
    if (!this.data.substitution.vocabulary.some(item => item.id === previousVocabularyId)) this.selectedVocabularyId = "";
    const currentSentence = this.currentWords().map(word => [word.id, word.hanzi, word.pinyin, word.meaning]);
    if (this.studentAudioUrl && JSON.stringify(previousSentence) !== JSON.stringify(currentSentence)) this.clearStudentRecording();
    if (!this.hasVoicePreference) this.selectedVoice = settings.modelAudio === "teacher" ? "teacher" : "ai";
    if (this.selectedVoice === "teacher" && !this.teacherAudioUrl) this.useAiFallback();
    this.render();
  }

  render() {
    this.root.querySelector(`[data-practice-kind="${this.id}"]`).textContent = t(this.id === "core" ? "corePractice" : "challengePractice");
    this.root.querySelector(`[data-practice-title="${this.id}"]`).textContent = this.label; this.renderSentence(); this.renderVocabulary(); this.renderVoice();
    if (!this.studentAudioUrl && !this.status.textContent) this.status.textContent = t("ready");
  }

  renderSentence() {
    const wrapper = document.createElement("div"); wrapper.className = "sentence-units";
    const words = this.currentWords(); const hasExplicitEnding = hasSentenceEndingPunctuation(words.map(word => word.hanzi).join(""));
    words.forEach(word => {
      const { text, punctuation } = splitWordPunctuation(word.hanzi);
      if (text) {
        const unit = document.createElement("button"); unit.type = "button"; unit.dataset.wordId = word.id; unit.className = `word-unit ${settings.enableTap ? "interactive" : ""} ${this.selectedWordId === word.id ? "selected" : ""}`;
        const pinyin = document.createElement("span"); pinyin.className = "word-pinyin"; pinyin.textContent = word.pinyin;
        const hanzi = document.createElement("span"); hanzi.className = "word-hanzi"; hanzi.textContent = text; unit.append(pinyin, hanzi);
        if (settings.enableTap && word.meaning) unit.addEventListener("click", event => { event.stopPropagation(); this.showMeaning(word.meaning, unit, event, word.id); });
        wrapper.append(unit);
      }
      if (punctuation) { const mark = document.createElement("span"); mark.className = "sentence-punctuation"; mark.textContent = punctuation; wrapper.append(mark); }
    });
    if (!hasExplicitEnding) { const mark = document.createElement("span"); mark.className = "sentence-punctuation"; mark.textContent = this.fallbackPunctuation(); wrapper.append(mark); }
    this.sentence.replaceChildren(wrapper);
    this.queuePinyinPosition();
  }

  positionPinyin() {
    const labels = [...this.sentence.querySelectorAll(".word-pinyin")];
    labels.forEach(label => label.style.removeProperty("--pinyin-shift"));
    const minimumGap = 10;
    for (let index = labels.length - 2; index >= 0; index -= 1) {
      const currentRect = labels[index].getBoundingClientRect(); const nextRect = labels[index + 1].getBoundingClientRect();
      const overlap = currentRect.right + minimumGap - nextRect.left;
      if (overlap > 0) labels[index].style.setProperty("--pinyin-shift", `${-overlap}px`);
    }
  }

  showMeaning(meaning, anchor, event, wordId = null) {
    if (!settings.showMeanings || !meaning) return;
    clearTimeout(this.meaningTimer); this.selectedWordId = wordId;
    this.sentence.querySelectorAll(".word-unit").forEach(unit => unit.classList.toggle("selected", unit.dataset.wordId === wordId));
    this.popover.textContent = meaning; this.popover.hidden = false;
    const anchorRect = anchor.getBoundingClientRect(); const popoverRect = this.popover.getBoundingClientRect();
    const pointerX = Number.isFinite(event?.clientX) && event.clientX > 0 ? event.clientX : anchorRect.left + anchorRect.width / 2;
    const preferredTop = anchorRect.bottom + 8; const left = Math.min(window.innerWidth - popoverRect.width - 10, Math.max(10, pointerX - popoverRect.width / 2));
    const top = preferredTop + popoverRect.height <= window.innerHeight - 10 ? preferredTop : Math.max(10, anchorRect.top - popoverRect.height - 8);
    this.popover.style.left = `${left}px`; this.popover.style.top = `${top}px`;
    this.meaningTimer = setTimeout(() => { this.popover.hidden = true; if (wordId) { this.selectedWordId = null; this.sentence.querySelectorAll(".word-unit").forEach(unit => unit.classList.remove("selected")); } }, 2000);
  }

  async chooseVocabulary(id) {
    if (id === this.selectedVocabularyId) return;
    if (this.recorder.mediaRecorder?.state === "recording") await this.recorder.stop();
    this.selectedVocabularyId = id; this.selectedWordId = null; this.clearStudentRecording("recordingClearedForVocabulary");
    this.renderSentence(); this.renderVocabulary(); this.renderVoice();
  }

  renderVocabulary() {
    const section = this.root.querySelector(`[data-vocabulary-section="${this.id}"]`); const grid = this.root.querySelector(`[data-vocabulary-grid="${this.id}"]`);
    const substitution = this.data.substitution; section.hidden = !substitution.enabled || !substitution.vocabulary.length; this.root.classList.toggle("has-vocabulary", !section.hidden); grid.replaceChildren();
    if (section.hidden) return;
    substitution.vocabulary.forEach(item => {
      const row = document.createElement("div"); row.className = `vocabulary-list-row ${item.id === this.selectedVocabularyId ? "selected" : ""}`;
      const choose = document.createElement("button"); choose.type = "button"; choose.className = "vocabulary-choice"; choose.setAttribute("aria-pressed", String(item.id === this.selectedVocabularyId));
      const text = document.createElement("span"); text.className = "vocabulary-text"; const hanzi = document.createElement("strong"); hanzi.textContent = splitWordPunctuation(item.hanzi).text; const pinyin = document.createElement("span"); pinyin.textContent = item.pinyin; text.append(hanzi, pinyin); choose.append(text);
      choose.addEventListener("click", event => { this.chooseVocabulary(item.id); this.showMeaning(item.meaning, choose, event); });
      const listen = document.createElement("button"); listen.type = "button"; listen.className = "vocabulary-listen"; listen.textContent = "🔊"; listen.setAttribute("aria-label", `${t("vocabularyListen")}: ${item.hanzi}`); listen.addEventListener("click", () => { try { speakMandarin([{ hanzi: item.hanzi }], settings.speechRate || 0.8, ""); } catch { this.status.textContent = t("speechUnsupported"); } });
      row.append(choose, listen); grid.append(row);
    });
    this.root.querySelector(`[data-restore-example="${this.id}"]`).disabled = !this.selectedVocabularyId;
    this.root.querySelector(`[data-teacher-model-note="${this.id}"]`).hidden = !(this.selectedVocabularyId && this.selectedVoice === "teacher");
  }

  renderVoice() { this.root.querySelectorAll("button[data-voice]").forEach(button => button.classList.toggle("active", button.dataset.voice === this.selectedVoice)); const note = this.root.querySelector(`[data-teacher-model-note="${this.id}"]`); if (note) note.hidden = !(this.selectedVocabularyId && this.selectedVoice === "teacher"); }
  useAiFallback() { this.hasVoicePreference = true; this.selectedVoice = "ai"; saveYearVoiceMode(yearLevelId, this.id, "ai"); this.renderVoice(); this.status.textContent = t("teacherRecordingUnavailable"); }
  async listen() { try { if (this.selectedVoice === "teacher" && this.teacherAudioUrl) { this.modelAudio.src = this.teacherAudioUrl; this.modelAudio.currentTime = 0; await this.modelAudio.play(); this.status.textContent = t("listening"); } else { if (this.selectedVoice === "teacher") this.useAiFallback(); speakMandarin(this.currentWords(), settings.speechRate || 0.8, this.fallbackPunctuation()); if (this.status.textContent !== t("teacherRecordingUnavailable")) this.status.textContent = t("listening"); } } catch (error) { if (this.selectedVoice === "teacher") { this.useAiFallback(); try { speakMandarin(this.currentWords(), settings.speechRate || 0.8, this.fallbackPunctuation()); } catch {} } else this.status.textContent = t(error.message === "speechUnsupported" ? "speechUnsupported" : "playbackFailed"); } }
}

PRACTICE_IDS.forEach(id => { practices[id] = new StudentPractice(id); });
document.getElementById("joinYearBtn").addEventListener("click", () => { location.href = `student.html?year=${encodeURIComponent(yearLevelEntry.value)}`; });
YEAR_LEVELS.forEach(level => { const option = document.createElement("option"); option.value = level.id; option.textContent = level.label; yearLevelEntry.append(option); });

function showPractices(liveUpdate = false) { const heading = lessonTitle || t("studentHeading"); const badge = yearLevelLabel(yearLevelId); yearEntry.hidden = true; waitingScreen.hidden = true; practiceContent.hidden = false; yearBadge.textContent = badge; lessonHeading.textContent = heading; studentPageOverview.hidden = false; studentCardIntro.hidden = true; yearBadge.hidden = true; studentPageHeading.textContent = heading; studentPageBadge.textContent = badge; PRACTICE_IDS.forEach(id => practices[id].render()); if (liveUpdate) PRACTICE_IDS.forEach(id => { if (!practices[id].studentAudioUrl) practices[id].status.textContent = t("liveUpdate"); }); }

async function subscribeToYearLevel() {
  if (!isValidYearLevelId(yearLevelId)) { showYearEntry(); return; }
  showWaiting(); if (!isFirebaseConfigured()) { showWaiting("connectionError"); return; }
  try {
    const services = await getFirebaseServices(); const ref = services.firestoreSdk.doc(services.db, "yearLevels", yearLevelId);
    unsubscribeYearLevel = services.firestoreSdk.onSnapshot(ref, snapshot => {
      if (!snapshot.exists() || snapshot.data().published !== true) { receivedContent = false; showWaiting(); return; }
      const wasLoaded = receivedContent; const data = snapshot.data(); lessonTitle = String(data.lessonTitle || ""); settings = { ...normalizePractice(null).settings, ...(data.displaySettings || {}), ...(data.audioSettings || {}) };
      PRACTICE_IDS.forEach(id => practices[id].update(data.practices?.[id])); receivedContent = true; showPractices(wasLoaded);
    }, error => { console.error(error); if (receivedContent) PRACTICE_IDS.forEach(id => { practices[id].teacherAudioUrl = ""; if (practices[id].selectedVoice === "teacher") practices[id].useAiFallback(); }); else showWaiting("connectionError"); });
  } catch (error) { console.error(error); showWaiting("connectionError"); }
}

function rerenderLanguage() { applyTranslations(); if (!isValidYearLevelId(yearLevelId)) showYearEntry(); else if (receivedContent) showPractices(false); else showWaiting(); }
window.addEventListener("beforeunload", () => unsubscribeYearLevel?.());
initPageTranslations(rerenderLanguage); subscribeToYearLevel();
