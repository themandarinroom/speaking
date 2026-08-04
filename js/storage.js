import { cloneDefaultPractice, normalizePractice } from "./data.js";

const PRACTICE_KEY = "mandarinSpeaking.practice.v3";
const LANGUAGE_KEY = "mandarinSpeaking.language";
const TEACHER_AUDIO_KEY = "mandarinSpeaking.teacherAudio.v3";

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
