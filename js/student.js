import { normalizePractice } from "./data.js";
import { LocalRecorder } from "./recorder.js";
import { speakMandarin } from "./speech.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { isValidRoomId, normalizeRoomId } from "./rooms.js";
import { loadRoomTeacherAudio } from "./storage.js";
import { initPageTranslations, applyTranslations, formatText, t } from "./translations.js";

let practice = normalizePractice(null);
let localTeacherAudio = "";
let selectedId = null;
let selectedVoice = "ai";
let studentAudioUrl = "";
let receivedPractice = false;
let unsubscribeRoom = null;
const recorder = new LocalRecorder();
const roomId = normalizeRoomId(new URLSearchParams(location.search).get("room") || "");

const roomEntry = document.getElementById("roomEntry");
const roomCode = document.getElementById("roomCode");
const roomError = document.getElementById("roomError");
const waitingScreen = document.getElementById("waitingScreen");
const waitingRoom = document.getElementById("waitingRoom");
const practiceContent = document.getElementById("practiceContent");
const roomBadge = document.getElementById("roomBadge");
const sentenceArea = document.getElementById("sentenceArea");
const meaningPanel = document.getElementById("meaningPanel");
const voiceChoices = document.getElementById("voiceChoices");
const listenBtn = document.getElementById("listenBtn");
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const status = document.getElementById("studentStatus");
const studentAudio = document.getElementById("studentAudio");
const modelAudio = document.getElementById("modelAudioPlayer");

function escapeHtml(value) { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }

function roomDataToPractice(data) {
  return normalizePractice({ words: data.words, settings: { ...(data.displaySettings || {}), ...(data.audioSettings || {}) } });
}

function showRoomEntry(messageKey = "") {
  roomEntry.hidden = false; waitingScreen.hidden = true; practiceContent.hidden = true;
  roomError.textContent = messageKey ? t(messageKey) : "";
}

function showWaiting(messageKey = "waitingTeacher") {
  roomEntry.hidden = true; waitingScreen.hidden = false; practiceContent.hidden = true;
  waitingScreen.querySelector("h2").textContent = t(messageKey);
  waitingRoom.textContent = roomId ? formatText("roomLabel", { room: roomId }) : "";
}

function showPractice(liveUpdate = false) {
  roomEntry.hidden = true; waitingScreen.hidden = true; practiceContent.hidden = false;
  roomBadge.textContent = formatText("roomLabel", { room: roomId });
  renderSentence(); configureVoiceChoices();
  if (practice.settings.modelAudio === "teacher" && !localTeacherAudio) status.textContent = t("teacherRecordingUnavailable");
  else if (liveUpdate) status.textContent = t("liveUpdate");
  else if (!studentAudioUrl) status.textContent = t("ready");
}

function renderSentence() {
  if (!practice.words.length) { sentenceArea.innerHTML = `<p>${escapeHtml(t("noWords"))}</p>`; listenBtn.disabled = true; return; }
  listenBtn.disabled = false;
  const sentence = document.createElement("div"); sentence.className = "sentence-units";
  practice.words.forEach(word => {
    const unit = document.createElement("button"); unit.type = "button";
    unit.className = `word-unit ${practice.settings.enableTap ? "interactive" : ""} ${practice.settings.enableHover ? "hover-enabled" : ""} ${selectedId === word.id ? "selected" : ""}`; unit.dataset.id = word.id;
    unit.innerHTML = `<span class="word-pinyin" ${practice.settings.showPinyin ? "" : "hidden"}>${escapeHtml(word.pinyin)}</span><span class="word-hanzi">${escapeHtml(word.hanzi)}</span>`;
    if (practice.settings.enableTap) unit.addEventListener("click", event => { event.stopPropagation(); updateSelection(selectedId === word.id ? null : word.id); });
    if (practice.settings.enableHover) { unit.addEventListener("mouseenter", () => updateSelection(word.id)); unit.addEventListener("mouseleave", () => updateSelection(null)); }
    sentence.append(unit);
  });
  sentenceArea.replaceChildren(sentence); renderMeaning();
}

function updateSelection(id) {
  selectedId = id; sentenceArea.querySelectorAll(".word-unit").forEach(unit => unit.classList.toggle("selected", unit.dataset.id === id)); renderMeaning();
}

function renderMeaning() {
  meaningPanel.hidden = !practice.settings.showMeanings;
  const word = practice.words.find(item => item.id === selectedId);
  meaningPanel.innerHTML = word ? `<div class="meaning-content"><strong>${escapeHtml(word.hanzi)}</strong><span>${escapeHtml(word.pinyin)}</span><span>${escapeHtml(word.meaning)}</span></div>` : `<p class="meaning-prompt">${escapeHtml(t("tapPrompt"))}</p>`;
}

document.addEventListener("click", event => { if (!event.target.closest(".word-unit")) updateSelection(null); });

function configureVoiceChoices() {
  const allowChoice = practice.settings.modelAudio === "choice" && localTeacherAudio;
  voiceChoices.hidden = !allowChoice;
  if (practice.settings.modelAudio === "teacher") selectedVoice = "teacher";
  else if (!allowChoice) selectedVoice = "ai";
  voiceChoices.querySelectorAll("button[data-voice]").forEach(button => button.classList.toggle("active", button.dataset.voice === selectedVoice));
}

voiceChoices.addEventListener("click", event => { const button = event.target.closest("button[data-voice]"); if (!button) return; selectedVoice = button.dataset.voice; configureVoiceChoices(); });

listenBtn.addEventListener("click", async () => {
  try {
    if (selectedVoice === "teacher" && localTeacherAudio) {
      modelAudio.src = localTeacherAudio; modelAudio.currentTime = 0; await modelAudio.play(); status.textContent = t("listening");
    } else if (selectedVoice === "teacher") {
      speakMandarin(practice.words, practice.settings.speechRate || 0.8); status.textContent = t("teacherRecordingUnavailable");
    } else {
      speakMandarin(practice.words, practice.settings.speechRate || 0.8); status.textContent = t("listening");
    }
  } catch (error) { status.textContent = t(error.message === "speechUnsupported" ? "speechUnsupported" : "playbackFailed"); }
});

recordBtn.addEventListener("click", async () => {
  try {
    if (studentAudioUrl) { URL.revokeObjectURL(studentAudioUrl); studentAudioUrl = ""; }
    await recorder.start(); status.textContent = t("studentRecording"); recordBtn.disabled = true; stopBtn.disabled = false; playBtn.disabled = true; resetBtn.disabled = true;
  } catch (error) { status.textContent = t(error.name === "NotAllowedError" ? "microphoneDenied" : error.message === "recordingUnsupported" ? "recordingUnsupported" : "recordingFailed"); }
});

stopBtn.addEventListener("click", async () => { const result = await recorder.stop(); if (!result) return; studentAudioUrl = result.url; studentAudio.src = result.url; status.textContent = t("studentRecorded"); recordBtn.disabled = false; stopBtn.disabled = true; playBtn.disabled = false; resetBtn.disabled = false; });
playBtn.addEventListener("click", async () => { try { studentAudio.currentTime = 0; await studentAudio.play(); status.textContent = t("playing"); } catch { status.textContent = t("playbackFailed"); } });
resetBtn.addEventListener("click", () => { recorder.clear(); studentAudioUrl = ""; studentAudio.pause(); studentAudio.removeAttribute("src"); playBtn.disabled = true; resetBtn.disabled = true; recordBtn.disabled = false; stopBtn.disabled = true; status.textContent = t("cleared"); });

document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const requested = normalizeRoomId(roomCode.value);
  if (!isValidRoomId(requested)) { roomError.textContent = t("invalidRoom"); return; }
  location.href = `student.html?room=${encodeURIComponent(requested)}`;
});
roomCode.addEventListener("input", () => { roomCode.value = normalizeRoomId(roomCode.value); roomError.textContent = ""; });

async function subscribeToRoom() {
  if (!roomId) { showRoomEntry(); return; }
  if (!isValidRoomId(roomId)) { showRoomEntry("invalidRoom"); return; }
  showWaiting();
  if (!isFirebaseConfigured()) { showWaiting("connectionError"); return; }
  try {
    const services = await getFirebaseServices();
    const roomRef = services.firestoreSdk.doc(services.db, "rooms", roomId);
    unsubscribeRoom = services.firestoreSdk.onSnapshot(roomRef, snapshot => {
      if (!snapshot.exists() || snapshot.data().published !== true) { receivedPractice = false; showWaiting(); return; }
      const wasLoaded = receivedPractice; const data = snapshot.data();
      practice = roomDataToPractice(data); localTeacherAudio = loadRoomTeacherAudio(roomId); selectedId = null; receivedPractice = true; showPractice(wasLoaded);
    }, error => {
      console.error(error);
      if (error.code === "permission-denied") showWaiting(); else showWaiting("connectionError");
    });
  } catch (error) { console.error(error); showWaiting("connectionError"); }
}

function rerenderLanguage() {
  applyTranslations();
  if (!roomId || !isValidRoomId(roomId)) showRoomEntry(roomId ? "invalidRoom" : "");
  else if (receivedPractice) showPractice(false);
  else showWaiting();
}

window.addEventListener("beforeunload", () => unsubscribeRoom?.());
initPageTranslations(rerenderLanguage); subscribeToRoom();
