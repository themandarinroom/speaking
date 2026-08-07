import { normalizePractice, normalizeDifferentiatedPractice, substitutePracticeWords } from "./data.js";
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

function escapeHtml(value) { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }
function showYearEntry() { yearEntry.hidden = false; waitingScreen.hidden = true; practiceContent.hidden = true; }
function showWaiting(messageKey = "waitingTeacher") { yearEntry.hidden = true; waitingScreen.hidden = false; practiceContent.hidden = true; waitingScreen.querySelector("h2").textContent = t(messageKey); waitingYear.textContent = yearLevelId ? yearLevelLabel(yearLevelId) : ""; }

class StudentPractice {
  constructor(id) {
    this.id = id; this.data = normalizeDifferentiatedPractice(null, ""); this.label = ""; this.teacherAudioUrl = ""; this.selectedWordId = null; this.selectedVocabularyId = "";
    const storedVoice = yearLevelId ? loadYearVoiceMode(yearLevelId, id) : null;
    this.hasVoicePreference = Boolean(storedVoice); this.selectedVoice = storedVoice || "ai"; this.studentAudioUrl = ""; this.recorder = new LocalRecorder();
    this.root = document.querySelector(`[data-student-practice="${id}"]`); this.sentence = this.root.querySelector(`[data-sentence="${id}"]`); this.meaning = this.root.querySelector(`[data-meaning="${id}"]`); this.status = this.root.querySelector(`[data-status="${id}"]`); this.studentAudio = this.root.querySelector(`[data-student-audio="${id}"]`); this.modelAudio = this.root.querySelector(`[data-model-audio="${id}"]`);
    this.bindControls();
  }

  currentWords() { return substitutePracticeWords(this.data.words, this.data.substitution, this.selectedVocabularyId); }

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
    this.currentWords().forEach(word => { const unit = document.createElement("button"); unit.type = "button"; unit.dataset.wordId = word.id; unit.className = `word-unit ${settings.enableTap ? "interactive" : ""} ${settings.enableHover ? "hover-enabled" : ""} ${this.selectedWordId === word.id ? "selected" : ""}`; unit.innerHTML = `<span class="word-pinyin" ${settings.showPinyin ? "" : "hidden"}>${escapeHtml(word.pinyin)}</span><span class="word-hanzi">${escapeHtml(word.hanzi)}</span>`; if (settings.enableTap) unit.addEventListener("click", event => { event.stopPropagation(); this.setSelection(this.selectedWordId === word.id ? null : word.id); }); if (settings.enableHover) { unit.addEventListener("mouseenter", () => this.setSelection(word.id)); unit.addEventListener("mouseleave", () => this.setSelection(null)); } wrapper.append(unit); });
    this.sentence.replaceChildren(wrapper); this.renderMeaning();
  }

  setSelection(id) { this.selectedWordId = id; this.sentence.querySelectorAll(".word-unit").forEach(unit => unit.classList.toggle("selected", unit.dataset.wordId === id)); this.renderMeaning(); }
  renderMeaning() { this.meaning.hidden = !settings.showMeanings; const word = this.currentWords().find(item => item.id === this.selectedWordId); this.meaning.innerHTML = word ? `<div class="meaning-content"><strong>${escapeHtml(word.hanzi)}</strong><span>${escapeHtml(word.pinyin)}</span><span>${escapeHtml(word.meaning)}</span></div>` : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`; }

  async chooseVocabulary(id) {
    if (id === this.selectedVocabularyId) return;
    if (this.recorder.mediaRecorder?.state === "recording") await this.recorder.stop();
    this.selectedVocabularyId = id; this.selectedWordId = null; this.clearStudentRecording("recordingClearedForVocabulary");
    this.renderSentence(); this.renderVocabulary(); this.renderVoice();
  }

  renderVocabulary() {
    const section = this.root.querySelector(`[data-vocabulary-section="${this.id}"]`); const grid = this.root.querySelector(`[data-vocabulary-grid="${this.id}"]`);
    const substitution = this.data.substitution; section.hidden = !substitution.enabled || !substitution.vocabulary.length; grid.replaceChildren();
    if (section.hidden) return;
    substitution.vocabulary.forEach(item => {
      const card = document.createElement("article"); card.className = `vocabulary-card ${item.id === this.selectedVocabularyId ? "selected" : ""}`;
      const choose = document.createElement("button"); choose.type = "button"; choose.className = "vocabulary-choice"; choose.setAttribute("aria-pressed", String(item.id === this.selectedVocabularyId));
      if (item.imageUrl) { const image = document.createElement("img"); image.src = item.imageUrl; image.alt = ""; image.loading = "lazy"; image.addEventListener("error", () => image.remove()); choose.append(image); }
      else { const visual = document.createElement("span"); visual.className = "vocabulary-visual"; visual.textContent = item.emoji || item.hanzi; choose.append(visual); }
      const hanzi = document.createElement("strong"); hanzi.textContent = item.hanzi; const pinyin = document.createElement("span"); pinyin.textContent = item.pinyin; const meaning = document.createElement("span"); meaning.textContent = item.meaning; choose.append(hanzi, pinyin, meaning); choose.addEventListener("click", () => this.chooseVocabulary(item.id));
      const listen = document.createElement("button"); listen.type = "button"; listen.className = "vocabulary-listen"; listen.textContent = `🔊 ${t("vocabularyListen")}`; listen.setAttribute("aria-label", `${t("vocabularyListen")}: ${item.hanzi}`); listen.addEventListener("click", () => { try { speakMandarin([{ hanzi: item.hanzi }], settings.speechRate || 0.8); } catch { this.status.textContent = t("speechUnsupported"); } });
      card.append(choose, listen); grid.append(card);
    });
    this.root.querySelector(`[data-restore-example="${this.id}"]`).disabled = !this.selectedVocabularyId;
    this.root.querySelector(`[data-teacher-model-note="${this.id}"]`).hidden = !(this.selectedVocabularyId && this.selectedVoice === "teacher");
  }

  renderVoice() { this.root.querySelectorAll("button[data-voice]").forEach(button => button.classList.toggle("active", button.dataset.voice === this.selectedVoice)); const note = this.root.querySelector(`[data-teacher-model-note="${this.id}"]`); if (note) note.hidden = !(this.selectedVocabularyId && this.selectedVoice === "teacher"); }
  useAiFallback() { this.hasVoicePreference = true; this.selectedVoice = "ai"; saveYearVoiceMode(yearLevelId, this.id, "ai"); this.renderVoice(); this.status.textContent = t("teacherRecordingUnavailable"); }
  async listen() { try { if (this.selectedVoice === "teacher" && this.teacherAudioUrl) { this.modelAudio.src = this.teacherAudioUrl; this.modelAudio.currentTime = 0; await this.modelAudio.play(); this.status.textContent = t("listening"); } else { if (this.selectedVoice === "teacher") this.useAiFallback(); speakMandarin(this.currentWords(), settings.speechRate || 0.8); if (this.status.textContent !== t("teacherRecordingUnavailable")) this.status.textContent = t("listening"); } } catch (error) { if (this.selectedVoice === "teacher") { this.useAiFallback(); try { speakMandarin(this.currentWords(), settings.speechRate || 0.8); } catch {} } else this.status.textContent = t(error.message === "speechUnsupported" ? "speechUnsupported" : "playbackFailed"); } }
}

PRACTICE_IDS.forEach(id => { practices[id] = new StudentPractice(id); });
document.getElementById("joinYearBtn").addEventListener("click", () => { location.href = `student.html?year=${encodeURIComponent(yearLevelEntry.value)}`; });
YEAR_LEVELS.forEach(level => { const option = document.createElement("option"); option.value = level.id; option.textContent = level.label; yearLevelEntry.append(option); });

function showPractices(liveUpdate = false) { yearEntry.hidden = true; waitingScreen.hidden = true; practiceContent.hidden = false; yearBadge.textContent = yearLevelLabel(yearLevelId); lessonHeading.textContent = lessonTitle || t("studentHeading"); PRACTICE_IDS.forEach(id => practices[id].render()); if (liveUpdate) PRACTICE_IDS.forEach(id => { if (!practices[id].studentAudioUrl) practices[id].status.textContent = t("liveUpdate"); }); }

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
