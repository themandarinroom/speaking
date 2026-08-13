import { cleanPinyin, cloneDefaultPractice, cloneDefaultPractices, normalizeDifferentiatedPractice, splitWordPunctuation, substitutePracticeWords } from "./data.js";
import { loadYearDraft, saveYearDraft, loadYearTeacherAudio, saveYearTeacherAudio, clearYearTeacherAudio } from "./storage.js";
import { LocalRecorder, blobToDataUrl } from "./recorder.js";
import { YEAR_LEVELS, PRACTICE_IDS, yearLevelLabel } from "./year-levels.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { uploadTeacherAudio, deleteTeacherAudio, cacheSafeAudioUrl } from "./teacher-audio.js";
import { initPageTranslations, applyTranslations, formatText, t } from "./translations.js";
import { applyVocabularySet, listVocabularySets, loadVocabularySet } from "./vocabulary-library.js";
import { duplicateSpeakingPractice, listSpeakingPractices, loadSpeakingPractice, migrateLegacyYearLevels, publishSpeakingPractice, saveSpeakingPractice, savedPracticePayload, softDeleteSpeakingPractice, suggestedPracticeId, uniquePracticeId } from "./speaking-practices.js";

const defaultSettings = () => cloneDefaultPractice().settings;
const makeAudioState = () => ({ dataUrl: "", blob: null, published: null, removed: false, recorder: new LocalRecorder() });
let yearLevelId = YEAR_LEVELS[0].id;
let lessonTitle = t("defaultPracticeTitle");
let practices = cloneDefaultPractices();
let settings = defaultSettings();
let currentUser = null;
let authorised = false;
let services = null;
let isPublishing = false;
let isSaving = false;
let currentPracticeId = "";
let currentSavedPractice = null;
let editorDirty = false;
let libraryItems = [];
let libraryFilter = "all";
const selectedWords = { core: null, challenge: null };
const previewVocabulary = { core: "", challenge: "" };
const audioStates = { core: makeAudioState(), challenge: makeAudioState() };
let vocabularySetOptions = [];

const yearLevelSelect = document.getElementById("yearLevelSelect");
const lessonTitleInput = document.getElementById("lessonTitle");
const saveStatus = document.getElementById("saveStatus");
const authState = document.getElementById("authState");
const authHelp = document.getElementById("authHelp");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const publishBtn = document.getElementById("publishBtn");
const publishStatus = document.getElementById("publishStatus");
const lastPublished = document.getElementById("lastPublished");
const savePracticeBtn = document.getElementById("savePracticeBtn");
const newPracticeBtn = document.getElementById("newPracticeBtn");
const closeEditorBtn = document.getElementById("closeEditorBtn");
const migrateLegacyBtn = document.getElementById("migrateLegacyBtn");
const libraryStatus = document.getElementById("libraryStatus");
const practiceLibrary = document.getElementById("practiceLibrary");
const libraryFilters = document.getElementById("libraryFilters");
const editingState = document.getElementById("editingState");

function escapeHtml(value) { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }
function saveDraft() {
  try {
    const draftPractices = Object.fromEntries(PRACTICE_IDS.map(id => { const practice = JSON.parse(JSON.stringify(practices[id])); if (practice.substitution.keyVocabSource === "vocabulary-library") practice.substitution.vocabulary = []; return [id, practice]; }));
    saveYearDraft(yearLevelId, { lessonTitle, practices: draftPractices, settings });
    saveStatus.textContent = t("saved");
    if (currentPracticeId || !currentSavedPractice) { editorDirty = true; updatePublishButton(); }
  } catch { saveStatus.textContent = t("saveFailed"); }
}

function loadDraft() {
  const draft = loadYearDraft(yearLevelId);
  const defaults = cloneDefaultPractices();
  lessonTitle = String(draft?.lessonTitle || t("defaultPracticeTitle"));
  practices = {
    core: normalizeDifferentiatedPractice(draft?.practices?.core || defaults.core, t("corePractice")),
    challenge: normalizeDifferentiatedPractice(draft?.practices?.challenge || defaults.challenge, t("challengePractice"))
  };
  settings = { ...defaultSettings(), ...(draft?.settings || {}) };
  PRACTICE_IDS.forEach(id => {
    const state = audioStates[id];
    state.dataUrl = loadYearTeacherAudio(yearLevelId, id); state.blob = null; state.published = null; state.removed = false;
  });
}

function wordField(labelKey, value, fieldName, wordId, practiceId) {
  const wrapper = document.createElement("div"); wrapper.className = "field";
  const label = document.createElement("label"); label.textContent = t(labelKey);
  const input = document.createElement("input"); input.type = "text"; input.value = value; input.dataset.field = fieldName; input.dataset.wordId = wordId; input.dataset.practiceId = practiceId; input.autocomplete = "off";
  label.append(input); wrapper.append(label); return wrapper;
}

function renderRows(practiceId) {
  const rows = document.getElementById(`${practiceId}Rows`); rows.replaceChildren();
  practices[practiceId].words.forEach((word, index) => {
    const row = document.createElement("div"); row.className = "word-row";
    row.append(wordField("hanzi", word.hanzi, "hanzi", word.id, practiceId), wordField("pinyin", word.pinyin, "pinyin", word.id, practiceId), wordField("meaning", word.meaning, "meaning", word.id, practiceId));
    const actions = document.createElement("div"); actions.className = "row-actions";
    [["up", "↑", "moveUp", index === 0], ["down", "↓", "moveDown", index === practices[practiceId].words.length - 1], ["delete", "×", "deleteWord", practices[practiceId].words.length === 1]].forEach(([action, symbol, labelKey, disabled]) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `icon-button ${action === "delete" ? "delete" : ""}`; button.dataset.action = action; button.dataset.wordId = word.id; button.dataset.practiceId = practiceId; button.textContent = symbol; button.disabled = disabled; button.setAttribute("aria-label", t(labelKey)); button.title = t(labelKey); actions.append(button);
    });
    row.append(actions); rows.append(row);
  });
}

function renderPreview(practiceId) {
  const preview = document.getElementById(`${practiceId}Preview`);
  const sentence = document.createElement("div"); sentence.className = "sentence-units teacher-preview";
  const words = substitutePracticeWords(practices[practiceId].words, practices[practiceId].substitution, previewVocabulary[practiceId]);
  words.forEach(word => {
    const unit = document.createElement("button"); unit.type = "button"; unit.dataset.wordId = word.id; unit.className = `word-unit interactive ${settings.enableHover ? "hover-enabled" : ""} ${selectedWords[practiceId] === word.id ? "selected" : ""}`;
    unit.innerHTML = `<span class="word-pinyin" ${settings.showPinyin ? "" : "hidden"}>${escapeHtml(word.pinyin)}</span><span class="word-hanzi">${escapeHtml(word.hanzi)}</span>`;
    if (settings.enableTap) unit.addEventListener("click", () => setPreviewSelection(practiceId, selectedWords[practiceId] === word.id ? null : word.id));
    if (settings.enableHover) { unit.addEventListener("mouseenter", () => setPreviewSelection(practiceId, word.id)); unit.addEventListener("mouseleave", () => setPreviewSelection(practiceId, null)); }
    sentence.append(unit);
  });
  const panel = document.createElement("div"); panel.className = "meaning-panel"; panel.hidden = !settings.showMeanings;
  const selected = words.find(word => word.id === selectedWords[practiceId]);
  panel.innerHTML = selected ? `<div class="meaning-content"><strong>${escapeHtml(selected.hanzi)}</strong><span>${escapeHtml(selected.pinyin)}</span><span>${escapeHtml(selected.meaning)}</span></div>` : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
  preview.replaceChildren(sentence, panel);
}

function setPreviewSelection(practiceId, wordId) {
  selectedWords[practiceId] = wordId; const preview = document.getElementById(`${practiceId}Preview`);
  preview.querySelectorAll(".word-unit").forEach(unit => unit.classList.toggle("selected", unit.dataset.wordId === wordId));
  const words = substitutePracticeWords(practices[practiceId].words, practices[practiceId].substitution, previewVocabulary[practiceId]);
  const selected = words.find(word => word.id === wordId); const panel = preview.querySelector(".meaning-panel");
  panel.innerHTML = selected ? `<div class="meaning-content"><strong>${escapeHtml(selected.hanzi)}</strong><span>${escapeHtml(selected.pinyin)}</span><span>${escapeHtml(selected.meaning)}</span></div>` : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
}

function vocabularyField(labelKey, value, fieldName, itemId, practiceId) {
  const wrapper = document.createElement("label"); wrapper.className = "field"; const span = document.createElement("span"); span.textContent = t(labelKey);
  const input = document.createElement("input"); input.type = "text"; input.value = value; input.dataset.vocabularyField = fieldName; input.dataset.itemId = itemId; input.dataset.practiceId = practiceId; input.autocomplete = "off";
  span.append(input); wrapper.append(span); return wrapper;
}

const vocabularySetLabel = set => `Year ${set.yearLevel} — ${set.title}${set.chineseTitle ? ` · ${set.chineseTitle}` : ""}`;

function setVocabularyStatus(practiceId, messageKey = "", retry = false) {
  const status = document.querySelector(`[data-vocabulary-library-status="${practiceId}"]`); status.replaceChildren();
  if (messageKey) status.append(document.createTextNode(t(messageKey)));
  if (retry) { const button = document.createElement("button"); button.type = "button"; button.className = "button quiet vocabulary-retry"; button.textContent = t("retry"); button.addEventListener("click", () => refreshVocabularySet(practiceId)); status.append(" ", button); }
}

async function refreshVocabularySet(practiceId) {
  const substitution = practices[practiceId].substitution;
  if (substitution.keyVocabSource !== "vocabulary-library" || !substitution.vocabularySetId) { setVocabularyStatus(practiceId); return; }
  setVocabularyStatus(practiceId, "loadingVocabulary");
  try {
    const set = await loadVocabularySet(substitution.vocabularySetId);
    if (!set) { substitution.vocabulary = []; setVocabularyStatus(practiceId, "vocabularySetMissing"); }
    else { practices[practiceId] = applyVocabularySet(practices[practiceId], set); setVocabularyStatus(practiceId); }
  } catch (error) { console.error("[Speaking Vocabulary Library]", error); setVocabularyStatus(practiceId, "vocabularyLoadFailed", true); }
  renderVocabulary(practiceId); renderPreview(practiceId);
}

async function loadVocabularySetOptions() {
  try { vocabularySetOptions = await listVocabularySets(); await Promise.all(PRACTICE_IDS.map(refreshVocabularySet)); PRACTICE_IDS.forEach(renderVocabulary); }
  catch (error) { console.error("[Speaking Vocabulary Library]", error); }
}

function renderVocabulary(practiceId) {
  const substitution = practices[practiceId].substitution; const enabled = Boolean(substitution.enabled);
  document.querySelector(`[data-vocabulary-enabled="${practiceId}"]`).checked = enabled;
  const target = document.querySelector(`[data-target-word="${practiceId}"]`); target.replaceChildren();
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = t("chooseReplaceableWord"); target.append(placeholder);
  practices[practiceId].words.filter(word => splitWordPunctuation(word.hanzi).text).forEach(word => { const option = document.createElement("option"); option.value = word.id; option.textContent = `${word.hanzi} — ${word.pinyin}`; target.append(option); });
  target.value = substitution.targetWordId; target.disabled = !enabled;
  const librarySource = substitution.keyVocabSource === "vocabulary-library";
  const sourceSelect = document.querySelector(`[data-vocabulary-source="${practiceId}"]`); sourceSelect.value = substitution.keyVocabSource; sourceSelect.disabled = !enabled;
  const setWrapper = document.querySelector(`[data-vocabulary-set-wrapper="${practiceId}"]`); setWrapper.hidden = !enabled || !librarySource;
  const setSelect = document.querySelector(`[data-vocabulary-set="${practiceId}"]`); setSelect.replaceChildren();
  const setPlaceholder = document.createElement("option"); setPlaceholder.value = ""; setPlaceholder.textContent = t("chooseVocabularySet"); setSelect.append(setPlaceholder);
  vocabularySetOptions.forEach(set => { const option = document.createElement("option"); option.value = set.id; option.textContent = vocabularySetLabel(set); setSelect.append(option); });
  if (substitution.vocabularySetId && !vocabularySetOptions.some(set => set.id === substitution.vocabularySetId)) { const missing = document.createElement("option"); missing.value = substitution.vocabularySetId; missing.textContent = t("unavailableVocabularySet"); setSelect.append(missing); }
  setSelect.value = substitution.vocabularySetId; setSelect.disabled = !enabled;
  const rows = document.querySelector(`[data-vocabulary-rows="${practiceId}"]`); rows.replaceChildren();
  substitution.vocabulary.forEach((item, index) => {
    const row = document.createElement("div"); row.className = "vocabulary-row";
    row.append(vocabularyField("hanzi", item.hanzi, "hanzi", item.id, practiceId), vocabularyField("pinyin", item.pinyin, "pinyin", item.id, practiceId), vocabularyField("meaning", item.meaning, "meaning", item.id, practiceId), vocabularyField("imageUrl", item.imageUrl, "imageUrl", item.id, practiceId), vocabularyField("emoji", item.emoji, "emoji", item.id, practiceId));
    row.querySelectorAll("input").forEach(input => input.disabled = librarySource);
    const actions = document.createElement("div"); actions.className = "row-actions";
    [["up", "↑", "moveUp", index === 0], ["down", "↓", "moveDown", index === substitution.vocabulary.length - 1], ["delete", "×", "deleteWord", false]].forEach(([action, symbol, labelKey, disabled]) => { const button = document.createElement("button"); button.type = "button"; button.className = `icon-button ${action === "delete" ? "delete" : ""}`; button.dataset.vocabularyAction = action; button.dataset.itemId = item.id; button.dataset.practiceId = practiceId; button.textContent = symbol; button.disabled = disabled; button.setAttribute("aria-label", t(labelKey)); actions.append(button); });
    actions.hidden = librarySource; row.append(actions); rows.append(row);
  });
  rows.hidden = !enabled;
  const add = document.querySelector(`[data-add-vocabulary="${practiceId}"]`); add.disabled = !enabled || substitution.vocabulary.length >= 20; add.hidden = !enabled || librarySource;
  const preview = document.querySelector(`[data-vocabulary-preview="${practiceId}"]`); preview.replaceChildren(); const original = document.createElement("option"); original.value = ""; original.textContent = t("restoreExample"); preview.append(original);
  substitution.vocabulary.forEach(item => { const option = document.createElement("option"); option.value = item.id; option.textContent = `${item.hanzi} — ${item.meaning}`; preview.append(option); });
  if (!substitution.vocabulary.some(item => item.id === previewVocabulary[practiceId])) previewVocabulary[practiceId] = "";
  preview.value = previewVocabulary[practiceId]; preview.disabled = !enabled || !substitution.targetWordId || !substitution.vocabulary.length; preview.closest("label").hidden = !enabled;
}

function syncSettings() {
  ["showPinyin", "showMeanings", "enableHover", "enableTap"].forEach(id => { document.getElementById(id).checked = Boolean(settings[id]); });
  document.querySelectorAll("input[name=modelAudio]").forEach(input => { input.checked = input.value === settings.modelAudio; });
  const rate = document.getElementById("speechRate"); rate.value = settings.speechRate || 0.8; document.getElementById("speechRateValue").value = Number(rate.value).toFixed(1);
}

function updateAudioControls(practiceId) {
  const state = audioStates[practiceId]; const remote = state.removed ? "" : cacheSafeAudioUrl(state.published); const source = state.dataUrl || remote;
  const audio = document.querySelector(`[data-audio="${practiceId}"]`); if (source) audio.src = source; else audio.removeAttribute("src");
  document.querySelector(`[data-play="${practiceId}"]`).disabled = !source; document.querySelector(`[data-remove="${practiceId}"]`).disabled = !source;
  document.querySelector(`[data-record="${practiceId}"]`).textContent = t(source ? "replace" : "record");
}

function renderAll() {
  lessonTitleInput.value = lessonTitle;
  PRACTICE_IDS.forEach(id => { document.getElementById(`${id}Label`).value = practices[id].label; renderRows(id); renderVocabulary(id); renderPreview(id); updateAudioControls(id); });
  syncSettings(); updatePublishButton();
}

document.querySelectorAll(".word-editor").forEach(rows => {
  rows.addEventListener("input", event => {
    const input = event.target.closest("input[data-field]"); if (!input) return;
    const practice = practices[input.dataset.practiceId]; const word = practice.words.find(item => item.id === input.dataset.wordId); if (!word) return;
    word[input.dataset.field] = input.dataset.field === "pinyin" ? cleanPinyin(input.value) : input.value;
    if (input.dataset.field === "pinyin" && input.value !== word.pinyin) input.value = word.pinyin;
    renderPreview(input.dataset.practiceId); saveDraft();
  });
  rows.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const words = practices[button.dataset.practiceId].words; const index = words.findIndex(word => word.id === button.dataset.wordId); if (index < 0) return;
    if (button.dataset.action === "delete" && words.length > 1) { const removedId = words[index].id; words.splice(index, 1); if (practices[button.dataset.practiceId].substitution.targetWordId === removedId) { practices[button.dataset.practiceId].substitution.targetWordId = ""; practices[button.dataset.practiceId].substitution.enabled = false; previewVocabulary[button.dataset.practiceId] = ""; } }
    if (button.dataset.action === "up" && index > 0) [words[index - 1], words[index]] = [words[index], words[index - 1]];
    if (button.dataset.action === "down" && index < words.length - 1) [words[index], words[index + 1]] = [words[index + 1], words[index]];
    renderRows(button.dataset.practiceId); renderVocabulary(button.dataset.practiceId); renderPreview(button.dataset.practiceId); saveDraft();
  });
});

document.querySelectorAll("[data-add-word]").forEach(button => button.addEventListener("click", () => { const id = button.dataset.addWord; practices[id].words.push({ id: `${id}-word-${Date.now()}`, hanzi: "", pinyin: "", meaning: "" }); renderRows(id); renderVocabulary(id); renderPreview(id); saveDraft(); }));
PRACTICE_IDS.forEach(id => document.getElementById(`${id}Label`).addEventListener("input", event => { practices[id].label = event.target.value.trim(); saveDraft(); }));
lessonTitleInput.addEventListener("input", () => { lessonTitle = lessonTitleInput.value.trim(); saveDraft(); });
["showPinyin", "showMeanings", "enableHover", "enableTap"].forEach(id => document.getElementById(id).addEventListener("change", event => { settings[id] = event.target.checked; PRACTICE_IDS.forEach(practiceId => { selectedWords[practiceId] = null; renderPreview(practiceId); }); saveDraft(); }));
document.querySelectorAll("input[name=modelAudio]").forEach(input => input.addEventListener("change", () => { if (input.checked) { settings.modelAudio = input.value; saveDraft(); } }));
document.getElementById("speechRate").addEventListener("input", event => { settings.speechRate = Number(event.target.value); document.getElementById("speechRateValue").value = Number(event.target.value).toFixed(1); saveDraft(); });

PRACTICE_IDS.forEach(practiceId => {
  document.querySelector(`[data-vocabulary-enabled="${practiceId}"]`).addEventListener("change", event => { const substitution = practices[practiceId].substitution; substitution.enabled = event.target.checked; if (substitution.enabled && !substitution.targetWordId) substitution.targetWordId = practices[practiceId].words[0]?.id || ""; if (!substitution.enabled) previewVocabulary[practiceId] = ""; renderVocabulary(practiceId); renderPreview(practiceId); saveDraft(); });
  document.querySelector(`[data-target-word="${practiceId}"]`).addEventListener("change", event => { practices[practiceId].substitution.targetWordId = event.target.value; previewVocabulary[practiceId] = ""; renderVocabulary(practiceId); renderPreview(practiceId); saveDraft(); });
  document.querySelector(`[data-vocabulary-source="${practiceId}"]`).addEventListener("change", event => { const substitution = practices[practiceId].substitution; substitution.keyVocabSource = event.target.value; substitution.vocabularySetId = ""; if (event.target.value === "vocabulary-library") substitution.vocabulary = []; renderVocabulary(practiceId); renderPreview(practiceId); saveDraft(); });
  document.querySelector(`[data-vocabulary-set="${practiceId}"]`).addEventListener("change", async event => { practices[practiceId].substitution.vocabularySetId = event.target.value; previewVocabulary[practiceId] = ""; saveDraft(); await refreshVocabularySet(practiceId); });
  document.querySelector(`[data-add-vocabulary="${practiceId}"]`).addEventListener("click", () => { const vocabulary = practices[practiceId].substitution.vocabulary; if (vocabulary.length >= 20) return; vocabulary.push({ id: `${practiceId}-vocabulary-${Date.now()}`, hanzi: "", pinyin: "", meaning: "", imageUrl: "", emoji: "" }); renderVocabulary(practiceId); saveDraft(); });
  document.querySelector(`[data-vocabulary-preview="${practiceId}"]`).addEventListener("change", event => { previewVocabulary[practiceId] = event.target.value; selectedWords[practiceId] = null; renderPreview(practiceId); });
  const rows = document.querySelector(`[data-vocabulary-rows="${practiceId}"]`);
  rows.addEventListener("input", event => { const input = event.target.closest("input[data-vocabulary-field]"); if (!input) return; const item = practices[practiceId].substitution.vocabulary.find(value => value.id === input.dataset.itemId); if (!item) return; item[input.dataset.vocabularyField] = input.dataset.vocabularyField === "pinyin" ? cleanPinyin(input.value) : input.value.trim(); if (input.dataset.vocabularyField === "pinyin" && input.value !== item.pinyin) input.value = item.pinyin; const option = document.querySelector(`[data-vocabulary-preview="${practiceId}"] option[value="${CSS.escape(item.id)}"]`); if (option) option.textContent = `${item.hanzi} — ${item.meaning}`; renderPreview(practiceId); saveDraft(); });
  rows.addEventListener("change", event => { if (!event.target.closest("input[data-vocabulary-field]")) return; renderVocabulary(practiceId); renderPreview(practiceId); });
  rows.addEventListener("click", event => { const button = event.target.closest("button[data-vocabulary-action]"); if (!button) return; const vocabulary = practices[practiceId].substitution.vocabulary; const index = vocabulary.findIndex(item => item.id === button.dataset.itemId); if (index < 0) return; if (button.dataset.vocabularyAction === "delete") vocabulary.splice(index, 1); if (button.dataset.vocabularyAction === "up" && index > 0) [vocabulary[index - 1], vocabulary[index]] = [vocabulary[index], vocabulary[index - 1]]; if (button.dataset.vocabularyAction === "down" && index < vocabulary.length - 1) [vocabulary[index], vocabulary[index + 1]] = [vocabulary[index + 1], vocabulary[index]]; if (!vocabulary.some(item => item.id === previewVocabulary[practiceId])) previewVocabulary[practiceId] = ""; renderVocabulary(practiceId); renderPreview(practiceId); saveDraft(); });
});

PRACTICE_IDS.forEach(practiceId => {
  const state = audioStates[practiceId]; const record = document.querySelector(`[data-record="${practiceId}"]`); const stop = document.querySelector(`[data-stop="${practiceId}"]`); const status = document.querySelector(`[data-audio-status="${practiceId}"]`); const audio = document.querySelector(`[data-audio="${practiceId}"]`);
  record.addEventListener("click", async () => { try { await state.recorder.start(); record.disabled = true; stop.disabled = false; status.textContent = t("recording"); } catch (error) { status.textContent = t(error.name === "NotAllowedError" ? "microphoneDenied" : error.message === "recordingUnsupported" ? "recordingUnsupported" : "recordingFailed"); } });
  stop.addEventListener("click", async () => { const result = await state.recorder.stop(); if (!result) return; state.blob = result.blob; state.dataUrl = await blobToDataUrl(result.blob); state.removed = false; saveYearTeacherAudio(yearLevelId, practiceId, state.dataUrl); status.textContent = t("recordingReady"); record.disabled = false; stop.disabled = true; editorDirty = true; updateAudioControls(practiceId); updatePublishButton(); });
  document.querySelector(`[data-play="${practiceId}"]`).addEventListener("click", async () => { try { audio.currentTime = 0; await audio.play(); } catch { status.textContent = t("playbackFailed"); } });
  document.querySelector(`[data-remove="${practiceId}"]`).addEventListener("click", () => { clearYearTeacherAudio(yearLevelId, practiceId); state.dataUrl = ""; state.blob = null; state.removed = true; status.textContent = t("recordingRemoved"); editorDirty = true; updateAudioControls(practiceId); updatePublishButton(); });
});

function showEditor(show) { document.querySelectorAll(".teacher-editor-section").forEach(section => { section.hidden = !show; }); }
function updatePublishButton() {
  const ready = authorised && currentUser && services?.auth.currentUser?.uid === currentUser.uid && isFirebaseConfigured();
  publishBtn.disabled = !ready || !currentSavedPractice || editorDirty || isPublishing || isSaving;
  savePracticeBtn.disabled = !ready || isSaving || isPublishing;
  newPracticeBtn.disabled = !ready;
  migrateLegacyBtn.disabled = !ready || isSaving || isPublishing;
  editingState.textContent = currentSavedPractice ? (editorDirty ? t("unsavedChanges") : t("savedPractice")) : t("newPractice");
}
function updateAuthUi() { authState.textContent = currentUser ? `${t("signedInAs")}: ${currentUser.email || currentUser.displayName}` : t("signedOut"); authState.hidden = !currentUser; authHelp.textContent = !isFirebaseConfigured() ? t("firebaseSetupNeeded") : currentUser && !authorised ? t("notAuthorised") : currentUser ? "" : t("signInHelp"); signInBtn.hidden = Boolean(currentUser); signOutBtn.hidden = !currentUser; updatePublishButton(); }

function formatLibraryDate(value) { return value?.toDate ? value.toDate().toLocaleDateString() : ""; }
function renderLibrary() {
  libraryFilters.replaceChildren();
  [{ id: "all", label: t("allYears") }, ...YEAR_LEVELS].forEach(level => { const button = document.createElement("button"); button.type = "button"; button.className = `library-filter ${libraryFilter === level.id ? "active" : ""}`; button.textContent = level.label; button.addEventListener("click", () => { libraryFilter = level.id; renderLibrary(); }); libraryFilters.append(button); });
  practiceLibrary.replaceChildren();
  const visible = libraryItems.filter(item => libraryFilter === "all" || item.yearLevelId === libraryFilter);
  if (!visible.length) { const empty = document.createElement("p"); empty.className = "library-empty"; empty.textContent = t("practiceLibraryEmpty"); practiceLibrary.append(empty); }
  visible.forEach(item => {
    const card = document.createElement("article"); card.className = "practice-library-item";
    const copy = document.createElement("div"); copy.className = "practice-library-copy";
    const badge = document.createElement("span"); badge.className = "practice-year-badge"; badge.textContent = item.yearLevelLabel || yearLevelLabel(item.yearLevelId);
    const title = document.createElement("h2"); title.textContent = item.title; copy.append(badge, title); if (formatLibraryDate(item.updatedAt)) { const meta = document.createElement("p"); meta.className = "small"; meta.textContent = formatText("updatedOn", { date: formatLibraryDate(item.updatedAt) }); copy.append(meta); }
    const actions = document.createElement("div"); actions.className = "library-item-actions";
    [["edit", t("edit")], ["preview", t("preview")], ["publish", t("publish")], ["duplicate", t("duplicate")], ["delete", t("deleteWord")]].forEach(([action, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = `button ${action === "delete" ? "quiet" : "secondary"}`; button.dataset.libraryAction = action; button.dataset.practiceId = item.id; button.textContent = label; actions.append(button); });
    card.append(copy, actions); practiceLibrary.append(card);
  });
}

async function refreshLibrary() {
  if (!authorised || !services) { libraryItems = []; renderLibrary(); return; }
  libraryStatus.textContent = t("loadingPractices");
  try { libraryItems = await listSpeakingPractices(services); libraryStatus.textContent = ""; migrateLegacyBtn.hidden = libraryItems.some(item => item.migration) || !authorised; }
  catch (error) { console.error(error); libraryStatus.textContent = `${error.code || error.name}: ${error.message}`; }
  renderLibrary();
}

async function openSavedPractice(itemOrId) {
  const item = typeof itemOrId === "string" ? await loadSpeakingPractice(services, itemOrId) : itemOrId;
  if (!item) { libraryStatus.textContent = t("practiceUnavailable"); return; }
  currentPracticeId = item.id; currentSavedPractice = item; yearLevelId = item.yearLevelId; yearLevelSelect.value = yearLevelId; lessonTitle = item.title;
  yearLevelSelect.disabled = true;
  practices = { core: normalizeDifferentiatedPractice(item.practices.core, t("corePractice")), challenge: normalizeDifferentiatedPractice(item.practices.challenge, t("challengePractice")) };
  settings = { ...defaultSettings(), ...item.displaySettings, ...item.audioSettings };
  PRACTICE_IDS.forEach(id => { const state = audioStates[id]; state.dataUrl = ""; state.blob = null; state.published = item.practices[id]?.teacherAudio || null; state.removed = false; });
  editorDirty = false; publishStatus.textContent = ""; lastPublished.textContent = ""; showEditor(true); renderAll(); await Promise.all(PRACTICE_IDS.map(refreshVocabularySet)); renderAll(); document.querySelector(".teacher-setup-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function newPractice() {
  currentPracticeId = ""; currentSavedPractice = null; yearLevelId = YEAR_LEVELS[0].id; yearLevelSelect.value = yearLevelId; lessonTitle = t("defaultPracticeTitle"); practices = cloneDefaultPractices(); settings = defaultSettings();
  yearLevelSelect.disabled = false;
  PRACTICE_IDS.forEach(id => { audioStates[id].dataUrl = ""; audioStates[id].blob = null; audioStates[id].published = null; audioStates[id].removed = false; });
  editorDirty = true; publishStatus.textContent = ""; lastPublished.textContent = ""; showEditor(true); renderAll(); document.querySelector(".teacher-setup-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

yearLevelSelect.addEventListener("change", () => { yearLevelId = yearLevelSelect.value; editorDirty = true; updatePublishButton(); });
signInBtn.addEventListener("click", async () => { if (!services) return; try { await services.authSdk.signInWithPopup(services.auth, new services.authSdk.GoogleAuthProvider()); } catch { authHelp.textContent = t("authFailed"); } });
signOutBtn.addEventListener("click", () => services?.authSdk.signOut(services.auth));

async function saveCurrentPractice() {
  if (!authorised || !services || !currentUser || isSaving) return null;
  isSaving = true; updatePublishButton(); publishStatus.textContent = t("savingPractice");
  try {
    if (!currentPracticeId) currentPracticeId = await uniquePracticeId(services, suggestedPracticeId(yearLevelId, lessonTitle));
    const teacherAudioByPractice = {};
    for (const practiceId of PRACTICE_IDS) {
      const state = audioStates[practiceId]; let audioMetadata = state.removed ? null : state.published;
      if (state.dataUrl) {
        const blob = state.blob || await fetch(state.dataUrl).then(response => response.blob());
        audioMetadata = await uploadTeacherAudio(services, currentPracticeId, practiceId, blob, percent => { publishStatus.textContent = formatText("uploadingPracticeVoice", { practice: practices[practiceId].label, percent }); }, true);
      }
      if (audioMetadata) teacherAudioByPractice[practiceId] = audioMetadata;
    }
    const payload = savedPracticePayload({ id: currentPracticeId, yearLevelId, title: lessonTitle, practices, settings, teacherAudio: teacherAudioByPractice });
    currentSavedPractice = await saveSpeakingPractice(services, payload, currentUser, !currentSavedPractice);
    for (const practiceId of PRACTICE_IDS) {
      const state = audioStates[practiceId];
      if (state.removed && state.published?.path?.startsWith("teacher-recordings/practices/")) await deleteTeacherAudio(services, currentPracticeId, practiceId, true);
      state.published = currentSavedPractice.practices[practiceId]?.teacherAudio || null; state.blob = null; state.removed = false;
      if (state.dataUrl) { clearYearTeacherAudio(yearLevelId, practiceId); state.dataUrl = ""; }
      updateAudioControls(practiceId);
    }
    editorDirty = false; publishStatus.textContent = t("practiceSaved"); await refreshLibrary(); return currentSavedPractice;
  } catch (error) { console.error(error); publishStatus.textContent = `${error.code || error.name || "FirebaseError"}: ${error.message || t("saveFailed")}`; return null; }
  finally { isSaving = false; updatePublishButton(); }
}

async function publishYearLevel(saved = currentSavedPractice, fromLibrary = false) {
  if (!authorised || !services || !currentUser || !saved || isPublishing) return;
  const status = fromLibrary ? libraryStatus : publishStatus;
  if (editorDirty && saved.id === currentPracticeId) { status.textContent = t("saveBeforePublish"); return; }
  isPublishing = true; updatePublishButton(); status.textContent = t("publishing");
  try { await publishSpeakingPractice(services, saved, currentUser); status.textContent = t("publishSuccess"); if (!fromLibrary) lastPublished.textContent = formatText("lastPublished", { time: new Date().toLocaleString() }); }
  catch (error) { console.error(error); status.textContent = `${error.code || error.name || "FirebaseError"}: ${error.message || t("publishFailed")}`; }
  finally { isPublishing = false; updatePublishButton(); }
}

publishBtn.addEventListener("click", publishYearLevel);
savePracticeBtn.addEventListener("click", saveCurrentPractice);
newPracticeBtn.addEventListener("click", newPractice);
closeEditorBtn.addEventListener("click", () => { if (!editorDirty || window.confirm(t("discardUnsaved"))) { showEditor(false); currentPracticeId = ""; currentSavedPractice = null; editorDirty = false; updatePublishButton(); } });
practiceLibrary.addEventListener("click", async event => {
  const button = event.target.closest("button[data-library-action]"); if (!button) return; const item = libraryItems.find(value => value.id === button.dataset.practiceId); if (!item) return;
  const action = button.dataset.libraryAction;
  if (action === "edit") await openSavedPractice(item);
  if (action === "preview") window.open(`student.html?practice=${encodeURIComponent(item.id)}`, "_blank", "noopener");
  if (action === "publish") await publishYearLevel(item, true);
  if (action === "duplicate") { libraryStatus.textContent = t("duplicating"); try { const duplicate = await duplicateSpeakingPractice(services, item, currentUser); await refreshLibrary(); await openSavedPractice(duplicate); libraryStatus.textContent = t("practiceDuplicated"); } catch (error) { libraryStatus.textContent = `${error.code || error.name}: ${error.message}`; } }
  if (action === "delete") {
    const stateRefs = await Promise.all(YEAR_LEVELS.map(level => services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "speakingState", level.id))));
    if (stateRefs.some(snapshot => snapshot.exists() && snapshot.data().currentPracticeId === item.id)) { libraryStatus.textContent = t("cannotDeletePublished"); return; }
    let unitCount = 0; try { const units = await services.firestoreSdk.getDocs(services.firestoreSdk.collection(services.db, "units")); units.forEach(unit => { if (JSON.stringify(unit.data()).includes(`"speakingPracticeId":"${item.id}"`)) unitCount += 1; }); } catch (error) { console.warn("[Speaking Practice delete safeguard] Unit scan unavailable", error); libraryStatus.textContent = t("unitCheckFailed"); return; }
    if (unitCount) { libraryStatus.textContent = formatText("cannotDeleteUnitReference", { count: unitCount }); return; }
    if (window.confirm(formatText("confirmDeletePractice", { title: item.title }))) { await softDeleteSpeakingPractice(services, item.id, currentUser); await refreshLibrary(); }
  }
});
migrateLegacyBtn.addEventListener("click", async () => { if (!window.confirm(t("confirmImportPublished"))) return; isSaving = true; updatePublishButton(); libraryStatus.textContent = t("importingPublished"); try { const ids = await migrateLegacyYearLevels(services, currentUser); libraryStatus.textContent = formatText("importComplete", { count: ids.length }); await refreshLibrary(); } catch (error) { console.error(error); libraryStatus.textContent = `${error.code || error.name}: ${error.message}`; } finally { isSaving = false; updatePublishButton(); } });
async function initialiseFirebase() {
  services = await getFirebaseServices(); if (!services) { updateAuthUi(); return; }
  services.authSdk.onAuthStateChanged(services.auth, async user => { currentUser = user; authorised = false; if (user) { try { const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "authorizedTeachers", user.uid)); authorised = snapshot.exists() && snapshot.data().active === true; } catch { authorised = false; } } updateAuthUi(); await refreshLibrary(); const requested = new URLSearchParams(location.search).get("practice"); if (authorised && requested) await openSavedPractice(requested); });
}

function rerenderLanguage() { applyTranslations(); renderLibrary(); if (!document.querySelector(".teacher-setup-card").hidden) renderAll(); updateAuthUi(); }
YEAR_LEVELS.forEach(level => { const option = document.createElement("option"); option.value = level.id; option.textContent = level.label; yearLevelSelect.append(option); });
initPageTranslations(rerenderLanguage); loadDraft(); renderAll(); showEditor(false); renderLibrary(); updateAuthUi(); initialiseFirebase(); loadVocabularySetOptions();
