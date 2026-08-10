import { cleanPinyin, cloneDefaultPractice, cloneDefaultPractices, normalizeDifferentiatedPractice, splitWordPunctuation, substitutePracticeWords } from "./data.js";
import { loadYearDraft, saveYearDraft, loadYearTeacherAudio, saveYearTeacherAudio, clearYearTeacherAudio } from "./storage.js";
import { LocalRecorder, blobToDataUrl } from "./recorder.js";
import { YEAR_LEVELS, PRACTICE_IDS, yearLevelLabel } from "./year-levels.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { uploadTeacherAudio, deleteTeacherAudio, cacheSafeAudioUrl } from "./teacher-audio.js";
import { initPageTranslations, applyTranslations, formatText, t } from "./translations.js";

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
const selectedWords = { core: null, challenge: null };
const previewVocabulary = { core: "", challenge: "" };
const audioStates = { core: makeAudioState(), challenge: makeAudioState() };

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

function escapeHtml(value) { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }
function saveDraft() {
  try {
    saveYearDraft(yearLevelId, { lessonTitle, practices, settings });
    saveStatus.textContent = t("saved");
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

function renderVocabulary(practiceId) {
  const substitution = practices[practiceId].substitution; const enabled = Boolean(substitution.enabled);
  document.querySelector(`[data-vocabulary-enabled="${practiceId}"]`).checked = enabled;
  const target = document.querySelector(`[data-target-word="${practiceId}"]`); target.replaceChildren();
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = t("chooseReplaceableWord"); target.append(placeholder);
  practices[practiceId].words.filter(word => splitWordPunctuation(word.hanzi).text).forEach(word => { const option = document.createElement("option"); option.value = word.id; option.textContent = `${word.hanzi} — ${word.pinyin}`; target.append(option); });
  target.value = substitution.targetWordId; target.disabled = !enabled;
  const rows = document.querySelector(`[data-vocabulary-rows="${practiceId}"]`); rows.replaceChildren();
  substitution.vocabulary.forEach((item, index) => {
    const row = document.createElement("div"); row.className = "vocabulary-row";
    row.append(vocabularyField("hanzi", item.hanzi, "hanzi", item.id, practiceId), vocabularyField("pinyin", item.pinyin, "pinyin", item.id, practiceId), vocabularyField("meaning", item.meaning, "meaning", item.id, practiceId), vocabularyField("imageUrl", item.imageUrl, "imageUrl", item.id, practiceId), vocabularyField("emoji", item.emoji, "emoji", item.id, practiceId));
    const actions = document.createElement("div"); actions.className = "row-actions";
    [["up", "↑", "moveUp", index === 0], ["down", "↓", "moveDown", index === substitution.vocabulary.length - 1], ["delete", "×", "deleteWord", false]].forEach(([action, symbol, labelKey, disabled]) => { const button = document.createElement("button"); button.type = "button"; button.className = `icon-button ${action === "delete" ? "delete" : ""}`; button.dataset.vocabularyAction = action; button.dataset.itemId = item.id; button.dataset.practiceId = practiceId; button.textContent = symbol; button.disabled = disabled; button.setAttribute("aria-label", t(labelKey)); actions.append(button); });
    row.append(actions); rows.append(row);
  });
  rows.hidden = !enabled;
  const add = document.querySelector(`[data-add-vocabulary="${practiceId}"]`); add.disabled = !enabled || substitution.vocabulary.length >= 20; add.hidden = !enabled;
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
  stop.addEventListener("click", async () => { const result = await state.recorder.stop(); if (!result) return; state.blob = result.blob; state.dataUrl = await blobToDataUrl(result.blob); state.removed = false; saveYearTeacherAudio(yearLevelId, practiceId, state.dataUrl); status.textContent = t("recordingReady"); record.disabled = false; stop.disabled = true; updateAudioControls(practiceId); });
  document.querySelector(`[data-play="${practiceId}"]`).addEventListener("click", async () => { try { audio.currentTime = 0; await audio.play(); } catch { status.textContent = t("playbackFailed"); } });
  document.querySelector(`[data-remove="${practiceId}"]`).addEventListener("click", () => { clearYearTeacherAudio(yearLevelId, practiceId); state.dataUrl = ""; state.blob = null; state.removed = true; status.textContent = t("recordingRemoved"); updateAudioControls(practiceId); });
});

function updatePublishButton() { publishBtn.disabled = !authorised || !currentUser || services?.auth.currentUser?.uid !== currentUser.uid || isPublishing || !isFirebaseConfigured(); }
function updateAuthUi() { authState.textContent = currentUser ? `${t("signedInAs")}: ${currentUser.email || currentUser.displayName}` : t("signedOut"); authState.hidden = !currentUser; authHelp.textContent = !isFirebaseConfigured() ? t("firebaseSetupNeeded") : currentUser && !authorised ? t("notAuthorised") : currentUser ? "" : t("signInHelp"); signInBtn.hidden = Boolean(currentUser); signOutBtn.hidden = !currentUser; updatePublishButton(); }

async function loadPublishedYearLevel() {
  loadDraft(); lastPublished.textContent = ""; renderAll(); if (!authorised || !services) return;
  publishStatus.textContent = t("loadingYearLevel");
  try {
    const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "yearLevels", yearLevelId));
    if (snapshot.exists()) {
      const data = snapshot.data(); lessonTitle = String(data.lessonTitle || t("defaultPracticeTitle"));
      practices = { core: normalizeDifferentiatedPractice(data.practices?.core, t("corePractice")), challenge: normalizeDifferentiatedPractice(data.practices?.challenge, t("challengePractice")) };
      settings = { ...defaultSettings(), ...(data.displaySettings || {}), ...(data.audioSettings || {}) };
      PRACTICE_IDS.forEach(id => { audioStates[id].published = data.practices?.[id]?.teacherAudio || null; });
      if (data.updatedAt?.toDate) lastPublished.textContent = formatText("lastPublished", { time: data.updatedAt.toDate().toLocaleString() });
      publishStatus.textContent = t("yearLevelLoaded"); saveDraft();
    } else publishStatus.textContent = t("yearLevelEmpty");
  } catch (error) { console.error(error); publishStatus.textContent = `${error.code || error.name}: ${error.message}`; }
  renderAll();
}

yearLevelSelect.addEventListener("change", () => { yearLevelId = yearLevelSelect.value; loadPublishedYearLevel(); });
signInBtn.addEventListener("click", async () => { if (!services) return; try { await services.authSdk.signInWithPopup(services.auth, new services.authSdk.GoogleAuthProvider()); } catch { authHelp.textContent = t("authFailed"); } });
signOutBtn.addEventListener("click", () => services?.authSdk.signOut(services.auth));

async function publishYearLevel() {
  if (!authorised || !services || !currentUser || services.auth.currentUser?.uid !== currentUser.uid || isPublishing) return;
  isPublishing = true; updatePublishButton(); publishStatus.textContent = t("publishing");
  try {
    const publishedPractices = {};
    for (const practiceId of PRACTICE_IDS) {
      const state = audioStates[practiceId]; let teacherAudio = state.removed ? null : state.published;
      if (state.dataUrl) {
        const blob = state.blob || await fetch(state.dataUrl).then(response => response.blob());
        teacherAudio = await uploadTeacherAudio(services, yearLevelId, practiceId, blob, percent => { publishStatus.textContent = formatText("uploadingPracticeVoice", { practice: practices[practiceId].label, percent }); });
      }
      publishedPractices[practiceId] = { label: practices[practiceId].label, words: practices[practiceId].words };
      const substitution = practices[practiceId].substitution;
      if (substitution.enabled && substitution.targetWordId && substitution.vocabulary.length) publishedPractices[practiceId].substitution = substitution;
      if (teacherAudio) publishedPractices[practiceId].teacherAudio = teacherAudio;
    }
    await services.firestoreSdk.setDoc(services.firestoreSdk.doc(services.db, "yearLevels", yearLevelId), {
      yearLevelId, yearLevelLabel: yearLevelLabel(yearLevelId), lessonTitle: lessonTitle || t("defaultPracticeTitle"), practices: publishedPractices,
      displaySettings: { showPinyin: settings.showPinyin, showMeanings: settings.showMeanings, enableHover: settings.enableHover, enableTap: settings.enableTap },
      audioSettings: { modelAudio: settings.modelAudio, speechRate: Number(settings.speechRate) || 0.8 }, published: true, updatedAt: services.firestoreSdk.serverTimestamp()
    });
    for (const practiceId of PRACTICE_IDS) {
      const state = audioStates[practiceId];
      if (state.removed && state.published) await deleteTeacherAudio(services, yearLevelId, practiceId);
      state.published = publishedPractices[practiceId].teacherAudio || null; state.blob = null; state.removed = false;
      if (state.dataUrl) { clearYearTeacherAudio(yearLevelId, practiceId); state.dataUrl = ""; }
      updateAudioControls(practiceId);
    }
    publishStatus.textContent = t("publishSuccess"); lastPublished.textContent = formatText("lastPublished", { time: new Date().toLocaleString() });
  } catch (error) { console.error(error); publishStatus.textContent = `${error.code || error.name || "FirebaseError"}: ${error.message || t("publishFailed")}`; }
  finally { isPublishing = false; updatePublishButton(); }
}

publishBtn.addEventListener("click", publishYearLevel);
async function initialiseFirebase() {
  services = await getFirebaseServices(); if (!services) { updateAuthUi(); return; }
  services.authSdk.onAuthStateChanged(services.auth, async user => { currentUser = user; authorised = false; if (user) { try { const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "authorizedTeachers", user.uid)); authorised = snapshot.exists() && snapshot.data().active === true; } catch { authorised = false; } } updateAuthUi(); await loadPublishedYearLevel(); });
}

function rerenderLanguage() { applyTranslations(); renderAll(); updateAuthUi(); }
YEAR_LEVELS.forEach(level => { const option = document.createElement("option"); option.value = level.id; option.textContent = level.label; yearLevelSelect.append(option); });
initPageTranslations(rerenderLanguage); loadDraft(); renderAll(); updateAuthUi(); initialiseFirebase();
