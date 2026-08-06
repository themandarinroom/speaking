const LANGUAGE_KEY = "mandarinSpeaking.language";
const YEAR_DRAFT_PREFIX = "mandarinSpeaking.yearDraft.v5.1.";
const YEAR_AUDIO_PREFIX = "mandarinSpeaking.yearTeacherAudio.v5.1.";
const YEAR_VOICE_MODE_PREFIX = "mandarinSpeaking.yearVoiceMode.v5.1.";

export function getLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en";
}

export function saveLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language === "zh" ? "zh" : "en");
}

export function loadYearDraft(yearLevelId) {
  try {
    const saved = localStorage.getItem(`${YEAR_DRAFT_PREFIX}${yearLevelId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveYearDraft(yearLevelId, draft) {
  localStorage.setItem(`${YEAR_DRAFT_PREFIX}${yearLevelId}`, JSON.stringify(draft));
}

export function loadYearTeacherAudio(yearLevelId, practiceId) {
  return localStorage.getItem(`${YEAR_AUDIO_PREFIX}${yearLevelId}.${practiceId}`) || "";
}

export function saveYearTeacherAudio(yearLevelId, practiceId, dataUrl) {
  localStorage.setItem(`${YEAR_AUDIO_PREFIX}${yearLevelId}.${practiceId}`, dataUrl);
}

export function clearYearTeacherAudio(yearLevelId, practiceId) {
  localStorage.removeItem(`${YEAR_AUDIO_PREFIX}${yearLevelId}.${practiceId}`);
}

export function loadYearVoiceMode(yearLevelId, practiceId) {
  const saved = localStorage.getItem(`${YEAR_VOICE_MODE_PREFIX}${yearLevelId}.${practiceId}`);
  return saved === "teacher" || saved === "ai" ? saved : null;
}

export function saveYearVoiceMode(yearLevelId, practiceId, mode) {
  localStorage.setItem(`${YEAR_VOICE_MODE_PREFIX}${yearLevelId}.${practiceId}`, mode === "teacher" ? "teacher" : "ai");
}
