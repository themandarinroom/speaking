import { cloneDefaultPractice, cleanPinyin, normalizePractice } from "./data.js";
import { loadRoomDraft, saveRoomDraft, loadRoomTeacherAudio, saveRoomTeacherAudio, clearRoomTeacherAudio } from "./storage.js";
import { LocalRecorder, blobToDataUrl } from "./recorder.js";
import { PILOT_ROOMS } from "./rooms.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { initPageTranslations, applyTranslations, formatText, t } from "./translations.js";

let practice = cloneDefaultPractice();
let title = t("defaultPracticeTitle");
let roomId = PILOT_ROOMS[0];
let currentUser = null;
let authorised = false;
let services = null;
let selectedId = null;
let teacherAudioData = "";
let isPublishing = false;
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
const roomSelect = document.getElementById("roomSelect");
const titleInput = document.getElementById("practiceTitle");
const authState = document.getElementById("authState");
const authHelp = document.getElementById("authHelp");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const publishBtn = document.getElementById("publishBtn");
const publishStatus = document.getElementById("publishStatus");
const lastPublished = document.getElementById("lastPublished");

function escapeHtml(value) { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }
function meaningMarkup(word) { return `<div class="meaning-content"><strong>${escapeHtml(word.hanzi)}</strong><span>${escapeHtml(word.pinyin)}</span><span>${escapeHtml(word.meaning)}</span></div>`; }

function roomDataToPractice(data) {
  return normalizePractice({
    words: data.words,
    settings: { ...(data.displaySettings || {}), ...(data.audioSettings || {}) }
  });
}

function saveDraft() {
  try {
    saveRoomDraft(roomId, { title, practice });
    saveStatus.textContent = t("saved");
  } catch {
    saveStatus.textContent = t("saveFailed");
  }
}

function loadDraft() {
  const draft = loadRoomDraft(roomId);
  practice = draft?.practice ? normalizePractice(draft.practice) : cloneDefaultPractice();
  title = String(draft?.title || t("defaultPracticeTitle"));
  teacherAudioData = loadRoomTeacherAudio(roomId);
  titleInput.value = title;
}

function field(labelKey, value, fieldName, id) {
  const wrapper = document.createElement("div"); wrapper.className = "field";
  const label = document.createElement("label"); label.textContent = t(labelKey);
  const input = document.createElement("input"); input.type = "text"; input.value = value; input.dataset.field = fieldName; input.dataset.id = id; input.autocomplete = "off";
  label.append(input); wrapper.append(label); return wrapper;
}

function renderRows() {
  rows.replaceChildren();
  practice.words.forEach((word, index) => {
    const row = document.createElement("div"); row.className = "word-row"; row.dataset.id = word.id;
    row.append(field("hanzi", word.hanzi, "hanzi", word.id), field("pinyin", word.pinyin, "pinyin", word.id), field("meaning", word.meaning, "meaning", word.id));
    const actions = document.createElement("div"); actions.className = "row-actions";
    [["up", "↑", "moveUp", index === 0], ["down", "↓", "moveDown", index === practice.words.length - 1], ["delete", "×", "deleteWord", practice.words.length === 1]].forEach(([action, symbol, labelKey, disabled]) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `icon-button ${action === "delete" ? "delete" : ""}`; button.dataset.action = action; button.dataset.id = word.id; button.textContent = symbol; button.disabled = disabled; button.setAttribute("aria-label", t(labelKey)); button.title = t(labelKey); actions.append(button);
    });
    row.append(actions); rows.append(row);
  });
}

function renderPreview() {
  const sentence = document.createElement("div"); sentence.className = "sentence-units teacher-preview";
  practice.words.forEach(word => {
    const unit = document.createElement("button"); unit.type = "button";
    unit.className = `word-unit interactive ${practice.settings.enableHover ? "hover-enabled" : ""} ${selectedId === word.id ? "selected" : ""}`; unit.dataset.id = word.id;
    unit.innerHTML = `<span class="word-pinyin" ${practice.settings.showPinyin ? "" : "hidden"}>${escapeHtml(word.pinyin)}</span><span class="word-hanzi">${escapeHtml(word.hanzi)}</span>`;
    if (practice.settings.enableTap) unit.addEventListener("click", () => setPreviewSelection(selectedId === word.id ? null : word.id));
    if (practice.settings.enableHover) { unit.addEventListener("mouseenter", () => setPreviewSelection(word.id)); unit.addEventListener("mouseleave", () => setPreviewSelection(null)); }
    sentence.append(unit);
  });
  const panel = document.createElement("div"); panel.className = "meaning-panel"; panel.hidden = !practice.settings.showMeanings;
  const selected = practice.words.find(word => word.id === selectedId);
  panel.innerHTML = selected ? meaningMarkup(selected) : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
  preview.replaceChildren(sentence, panel);
}

function setPreviewSelection(id) {
  selectedId = id;
  preview.querySelectorAll(".word-unit").forEach(unit => unit.classList.toggle("selected", unit.dataset.id === id));
  const panel = preview.querySelector(".meaning-panel"); const selected = practice.words.find(word => word.id === id);
  if (panel) panel.innerHTML = selected ? meaningMarkup(selected) : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
}

function syncSettingsControls() {
  ["showPinyin", "showMeanings", "enableHover", "enableTap"].forEach(id => { document.getElementById(id).checked = Boolean(practice.settings[id]); });
  document.querySelectorAll("input[name=modelAudio]").forEach(input => { input.checked = input.value === practice.settings.modelAudio; });
  const rate = document.getElementById("speechRate"); rate.value = practice.settings.speechRate || 0.8; document.getElementById("speechRateValue").value = Number(rate.value).toFixed(1);
}

function renderAll() { titleInput.value = title; renderRows(); renderPreview(); syncSettingsControls(); updateAudioButtons(); updatePublishButton(); }

rows.addEventListener("input", event => {
  const input = event.target.closest("input[data-field]"); if (!input) return;
  const word = practice.words.find(item => item.id === input.dataset.id); if (!word) return;
  word[input.dataset.field] = input.dataset.field === "pinyin" ? cleanPinyin(input.value) : input.value;
  if (input.dataset.field === "pinyin" && input.value !== word.pinyin) input.value = word.pinyin;
  renderPreview(); saveDraft();
});

rows.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const index = practice.words.findIndex(word => word.id === button.dataset.id); if (index < 0) return;
  if (button.dataset.action === "delete" && practice.words.length > 1) practice.words.splice(index, 1);
  if (button.dataset.action === "up" && index > 0) [practice.words[index - 1], practice.words[index]] = [practice.words[index], practice.words[index - 1]];
  if (button.dataset.action === "down" && index < practice.words.length - 1) [practice.words[index], practice.words[index + 1]] = [practice.words[index + 1], practice.words[index]];
  renderRows(); renderPreview(); saveDraft();
});

document.getElementById("addWordBtn").addEventListener("click", () => { practice.words.push({ id: `word-${Date.now()}`, hanzi: "", pinyin: "", meaning: "" }); renderRows(); renderPreview(); saveDraft(); });
titleInput.addEventListener("input", () => { title = titleInput.value.trim(); saveDraft(); });

["showPinyin", "showMeanings", "enableHover", "enableTap"].forEach(id => document.getElementById(id).addEventListener("change", event => { practice.settings[id] = event.target.checked; selectedId = null; renderPreview(); saveDraft(); }));
document.querySelectorAll("input[name=modelAudio]").forEach(input => input.addEventListener("change", () => { if (input.checked) { practice.settings.modelAudio = input.value; saveDraft(); } }));
document.getElementById("speechRate").addEventListener("input", event => { practice.settings.speechRate = Number(event.target.value); document.getElementById("speechRateValue").value = Number(event.target.value).toFixed(1); saveDraft(); });

function updateAudioButtons() {
  const available = Boolean(teacherAudioData);
  playBtn.disabled = !available; removeBtn.disabled = !available; recordBtn.textContent = t(available ? "replace" : "record");
  if (teacherAudioData) audio.src = teacherAudioData; else audio.removeAttribute("src");
}

recordBtn.addEventListener("click", async () => {
  try { await recorder.start(); recordBtn.disabled = true; stopBtn.disabled = false; audioStatus.textContent = t("recording"); }
  catch (error) { audioStatus.textContent = t(error.name === "NotAllowedError" ? "microphoneDenied" : error.message === "recordingUnsupported" ? "recordingUnsupported" : "recordingFailed"); }
});
stopBtn.addEventListener("click", async () => {
  const result = await recorder.stop(); if (!result) return;
  teacherAudioData = await blobToDataUrl(result.blob); saveRoomTeacherAudio(roomId, teacherAudioData);
  audioStatus.textContent = t("recordingReady"); recordBtn.disabled = false; stopBtn.disabled = true; updateAudioButtons();
});
playBtn.addEventListener("click", async () => { try { audio.currentTime = 0; await audio.play(); } catch { audioStatus.textContent = t("playbackFailed"); } });
removeBtn.addEventListener("click", () => { clearRoomTeacherAudio(roomId); teacherAudioData = ""; audio.removeAttribute("src"); audioStatus.textContent = t("recordingRemoved"); updateAudioButtons(); });

function updateAuthUi() {
  authState.textContent = currentUser ? `${t("signedInAs")}: ${currentUser.email || currentUser.displayName}` : t("signedOut");
  authHelp.textContent = !isFirebaseConfigured() ? t("firebaseSetupNeeded") : currentUser && !authorised ? t("notAuthorised") : t("signInHelp");
  signInBtn.hidden = Boolean(currentUser); signOutBtn.hidden = !currentUser; updatePublishButton();
}

function updatePublishButton() { publishBtn.disabled = !authorised || isPublishing || !isFirebaseConfigured(); }

async function loadPublishedRoom() {
  loadDraft(); lastPublished.textContent = ""; renderAll();
  if (!authorised || !services) return;
  publishStatus.textContent = t("loadingRoom");
  try {
    const { doc, getDoc } = services.firestoreSdk; const snapshot = await getDoc(doc(services.db, "rooms", roomId));
    if (snapshot.exists()) {
      const data = snapshot.data(); practice = roomDataToPractice(data); title = String(data.title || t("defaultPracticeTitle")); teacherAudioData = loadRoomTeacherAudio(roomId);
      if (data.updatedAt?.toDate) lastPublished.textContent = formatText("lastPublished", { time: data.updatedAt.toDate().toLocaleString() });
      publishStatus.textContent = t("roomLoaded"); saveDraft();
    } else publishStatus.textContent = t("roomEmpty");
  } catch { publishStatus.textContent = t("publishFailed"); }
  renderAll();
}

roomSelect.addEventListener("change", () => { roomId = roomSelect.value; loadPublishedRoom(); });
signInBtn.addEventListener("click", async () => {
  if (!services) { authHelp.textContent = t("firebaseSetupNeeded"); return; }
  try { await services.authSdk.signInWithPopup(services.auth, new services.authSdk.GoogleAuthProvider()); }
  catch { authHelp.textContent = t("authFailed"); }
});
signOutBtn.addEventListener("click", () => services?.authSdk.signOut(services.auth));

async function publishRoom() {
  if (!authorised || !services || isPublishing) return;
  isPublishing = true; updatePublishButton(); publishStatus.textContent = t("publishing");
  try {
    const { doc, setDoc, serverTimestamp } = services.firestoreSdk;
    await setDoc(doc(services.db, "rooms", roomId), {
      roomId, title: title || t("defaultPracticeTitle"), words: practice.words,
      displaySettings: { showPinyin: practice.settings.showPinyin, showMeanings: practice.settings.showMeanings, enableHover: practice.settings.enableHover, enableTap: practice.settings.enableTap },
      audioSettings: { modelAudio: practice.settings.modelAudio, speechRate: Number(practice.settings.speechRate) || 0.8 },
      published: true, updatedAt: serverTimestamp()
    });
    publishStatus.textContent = t("publishSuccess"); lastPublished.textContent = formatText("lastPublished", { time: new Date().toLocaleString() }); updateAudioButtons();
  } catch (error) { console.error(error); publishStatus.textContent = error.code === "permission-denied" ? t("notAuthorised") : t("publishFailed"); }
  finally { isPublishing = false; updatePublishButton(); }
}

publishBtn.addEventListener("click", publishRoom);

async function initialiseFirebase() {
  services = await getFirebaseServices();
  if (!services) { updateAuthUi(); return; }
  services.authSdk.onAuthStateChanged(services.auth, async user => {
    currentUser = user; authorised = false;
    if (user) {
      try { const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "authorizedTeachers", user.uid)); authorised = snapshot.exists() && snapshot.data().active === true; } catch { authorised = false; }
    }
    updateAuthUi(); await loadPublishedRoom();
  });
}

function rerenderLanguage() { applyTranslations(); renderRows(); renderPreview(); updateAudioButtons(); updateAuthUi(); }
PILOT_ROOMS.forEach(room => { const option = document.createElement("option"); option.value = room; option.textContent = room; roomSelect.append(option); });
initPageTranslations(rerenderLanguage); loadDraft(); renderAll(); updateAuthUi(); initialiseFirebase();
