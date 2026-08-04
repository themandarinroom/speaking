import { cleanPinyin } from "./data.js";
import { loadPractice, savePractice, loadTeacherAudio, saveTeacherAudio, clearTeacherAudio } from "./storage.js";
import { LocalRecorder, blobToDataUrl } from "./recorder.js";
import { initPageTranslations, applyTranslations, t } from "./translations.js";

let practice = loadPractice();
let teacherAudioData = loadTeacherAudio();
let selectedId = null;
const recorder = new LocalRecorder();
const rows = document.getElementById("wordRows");
const preview = document.getElementById("teacherPreview");
const saveStatus = document.getElementById("saveStatus");
const audioStatus = document.getElementById("teacherAudioStatus");
const audio = document.getElementById("teacherAudio");
const recordBtn = document.getElementById("teacherRecordBtn");
const stopBtn = document.getElementById("teacherStopBtn");
const playBtn = document.getElementById("teacherPlayBtn");
const removeBtn = document.getElementById("teacherRemoveBtn");

function setSaved(messageKey = "saved") {
  try {
    savePractice(practice);
    saveStatus.textContent = t(messageKey);
  } catch {
    saveStatus.textContent = t("saveFailed");
  }
}

function field(labelKey, value, fieldName, id) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.textContent = t(labelKey);
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.field = fieldName;
  input.dataset.id = id;
  input.autocomplete = "off";
  label.append(input);
  wrapper.append(label);
  return wrapper;
}

function renderRows() {
  rows.replaceChildren();
  practice.words.forEach((word, index) => {
    const row = document.createElement("div");
    row.className = "word-row";
    row.dataset.id = word.id;
    row.append(field("hanzi", word.hanzi, "hanzi", word.id));
    row.append(field("pinyin", word.pinyin, "pinyin", word.id));
    row.append(field("meaning", word.meaning, "meaning", word.id));
    const actions = document.createElement("div");
    actions.className = "row-actions";
    [["up", "↑", "moveUp", index === 0], ["down", "↓", "moveDown", index === practice.words.length - 1], ["delete", "×", "deleteWord", practice.words.length === 1]].forEach(([action, symbol, labelKey, disabled]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `icon-button ${action === "delete" ? "delete" : ""}`;
      button.dataset.action = action;
      button.dataset.id = word.id;
      button.textContent = symbol;
      button.disabled = disabled;
      button.setAttribute("aria-label", t(labelKey));
      button.title = t(labelKey);
      actions.append(button);
    });
    row.append(actions);
    rows.append(row);
  });
}

function renderPreview() {
  const sentence = document.createElement("div");
  sentence.className = "sentence-units teacher-preview";
  practice.words.forEach(word => {
    const unit = document.createElement("button");
    unit.type = "button";
    unit.className = `word-unit interactive ${practice.settings.enableHover ? "hover-enabled" : ""} ${selectedId === word.id ? "selected" : ""}`;
    unit.dataset.id = word.id;
    unit.innerHTML = `<span class="word-pinyin" ${practice.settings.showPinyin ? "" : "hidden"}>${escapeHtml(word.pinyin)}</span><span class="word-hanzi">${escapeHtml(word.hanzi)}</span>`;
    if (practice.settings.enableTap) unit.addEventListener("click", () => setPreviewSelection(selectedId === word.id ? null : word.id));
    if (practice.settings.enableHover) {
      unit.addEventListener("mouseenter", () => setPreviewSelection(word.id));
      unit.addEventListener("mouseleave", () => setPreviewSelection(null));
    }
    sentence.append(unit);
  });
  const panel = document.createElement("div");
  panel.className = "meaning-panel";
  panel.hidden = !practice.settings.showMeanings;
  const selected = practice.words.find(word => word.id === selectedId);
  panel.innerHTML = selected ? meaningMarkup(selected) : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
  preview.replaceChildren(sentence, panel);
}

function setPreviewSelection(id) {
  selectedId = id;
  preview.querySelectorAll(".word-unit").forEach(unit => unit.classList.toggle("selected", unit.dataset.id === id));
  const panel = preview.querySelector(".meaning-panel");
  if (!panel) return;
  const selected = practice.words.find(word => word.id === id);
  panel.innerHTML = selected ? meaningMarkup(selected) : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
}

function meaningMarkup(word) {
  return `<div class="meaning-content"><strong>${escapeHtml(word.hanzi)}</strong><span>${escapeHtml(word.pinyin)}</span><span>${escapeHtml(word.meaning)}</span></div>`;
}

function escapeHtml(value) {
  const span = document.createElement("span"); span.textContent = value; return span.innerHTML;
}

rows.addEventListener("input", event => {
  const input = event.target.closest("input[data-field]");
  if (!input) return;
  const word = practice.words.find(item => item.id === input.dataset.id);
  if (!word) return;
  word[input.dataset.field] = input.dataset.field === "pinyin" ? cleanPinyin(input.value) : input.value;
  if (input.dataset.field === "pinyin" && input.value !== word.pinyin) input.value = word.pinyin;
  renderPreview(); setSaved();
});

rows.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const index = practice.words.findIndex(word => word.id === button.dataset.id);
  if (index < 0) return;
  if (button.dataset.action === "delete" && practice.words.length > 1) practice.words.splice(index, 1);
  if (button.dataset.action === "up" && index > 0) [practice.words[index - 1], practice.words[index]] = [practice.words[index], practice.words[index - 1]];
  if (button.dataset.action === "down" && index < practice.words.length - 1) [practice.words[index], practice.words[index + 1]] = [practice.words[index + 1], practice.words[index]];
  renderRows(); renderPreview(); setSaved();
});

document.getElementById("addWordBtn").addEventListener("click", () => {
  practice.words.push({ id: `word-${Date.now()}`, hanzi: "", pinyin: "", meaning: "" });
  renderRows(); renderPreview(); setSaved();
});

["showPinyin", "showMeanings", "enableHover", "enableTap"].forEach(id => {
  const input = document.getElementById(id);
  input.checked = practice.settings[id];
  input.addEventListener("change", () => { practice.settings[id] = input.checked; selectedId = null; renderPreview(); setSaved(); });
});

document.querySelectorAll("input[name=modelAudio]").forEach(input => {
  input.checked = input.value === practice.settings.modelAudio;
  input.addEventListener("change", () => { if (input.checked) { practice.settings.modelAudio = input.value; setSaved(); } });
});

const rate = document.getElementById("speechRate");
const rateValue = document.getElementById("speechRateValue");
rate.value = practice.settings.speechRate;
rateValue.value = Number(rate.value).toFixed(1);
rate.addEventListener("input", () => { practice.settings.speechRate = Number(rate.value); rateValue.value = Number(rate.value).toFixed(1); setSaved(); });

function updateAudioButtons() {
  playBtn.disabled = !teacherAudioData;
  removeBtn.disabled = !teacherAudioData;
  recordBtn.textContent = t(teacherAudioData ? "replace" : "record");
  if (teacherAudioData) audio.src = teacherAudioData;
}

recordBtn.addEventListener("click", async () => {
  try {
    await recorder.start(); recordBtn.disabled = true; stopBtn.disabled = false; audioStatus.textContent = t("recording");
  } catch (error) {
    audioStatus.textContent = t(error.name === "NotAllowedError" ? "microphoneDenied" : error.message === "recordingUnsupported" ? "recordingUnsupported" : "recordingFailed");
  }
});
stopBtn.addEventListener("click", async () => {
  const result = await recorder.stop();
  if (!result) return;
  try { teacherAudioData = await blobToDataUrl(result.blob); saveTeacherAudio(teacherAudioData); audio.src = teacherAudioData; audioStatus.textContent = t("recordingReady"); }
  catch { audioStatus.textContent = t("saveFailed"); }
  recordBtn.disabled = false; stopBtn.disabled = true; updateAudioButtons();
});
playBtn.addEventListener("click", async () => { try { audio.currentTime = 0; await audio.play(); } catch { audioStatus.textContent = t("playbackFailed"); } });
removeBtn.addEventListener("click", () => { clearTeacherAudio(); teacherAudioData = ""; audio.removeAttribute("src"); audioStatus.textContent = t("recordingRemoved"); updateAudioButtons(); });

function rerenderLanguage() { applyTranslations(); renderRows(); renderPreview(); updateAudioButtons(); }
initPageTranslations(rerenderLanguage);
renderRows(); renderPreview(); updateAudioButtons(); setSaved();
