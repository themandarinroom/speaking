import { cloneDefaultPractice, normalizePractice } from "./data.js";

const PRACTICE_KEY = "mandarinSpeaking.practice.v3";
const LANGUAGE_KEY = "mandarinSpeaking.language";
const TEACHER_AUDIO_KEY = "mandarinSpeaking.teacherAudio.v3";
const ROOM_DRAFT_PREFIX = "mandarinSpeaking.roomDraft.v4.";
const ROOM_AUDIO_PREFIX = "mandarinSpeaking.roomTeacherAudio.v4.";
const VOICE_MODE_PREFIX = "mandarinSpeaking.voiceMode.v5.";

export function loadPractice() {
  try {
    const saved = localStorage.getItem(PRACTICE_KEY);
    return saved ? normalizePractice(JSON.parse(saved)) : cloneDefaultPractice();
  } catch {
    return cloneDefaultPractice();
  }
}

export function savePractice(practice) {
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(normalizePractice(practice)));
}

export function getLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en";
}

export function saveLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language === "zh" ? "zh" : "en");
}

export function saveTeacherAudio(dataUrl) {
  localStorage.setItem(TEACHER_AUDIO_KEY, dataUrl);
}

export function loadTeacherAudio() {
  return localStorage.getItem(TEACHER_AUDIO_KEY) || "";
}

export function clearTeacherAudio() {
  localStorage.removeItem(TEACHER_AUDIO_KEY);
}

export function loadRoomDraft(roomId) {
  try {
    const saved = localStorage.getItem(`${ROOM_DRAFT_PREFIX}${roomId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveRoomDraft(roomId, draft) {
  localStorage.setItem(`${ROOM_DRAFT_PREFIX}${roomId}`, JSON.stringify(draft));
}

export function loadRoomTeacherAudio(roomId) {
  return localStorage.getItem(`${ROOM_AUDIO_PREFIX}${roomId}`) || "";
}

export function saveRoomTeacherAudio(roomId, dataUrl) {
  localStorage.setItem(`${ROOM_AUDIO_PREFIX}${roomId}`, dataUrl);
}

export function clearRoomTeacherAudio(roomId) {
  localStorage.removeItem(`${ROOM_AUDIO_PREFIX}${roomId}`);
}

export function loadVoiceMode(roomId) {
  return localStorage.getItem(`${VOICE_MODE_PREFIX}${roomId}`) === "teacher" ? "teacher" : "ai";
}

export function saveVoiceMode(roomId, mode) {
  localStorage.setItem(`${VOICE_MODE_PREFIX}${roomId}`, mode === "teacher" ? "teacher" : "ai");
}
