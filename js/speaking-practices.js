import { normalizeDifferentiatedPractice, normalizePractice } from "./data.js";
import { PRACTICE_IDS, isValidYearLevelId, yearLevelLabel } from "./year-levels.js";

export const SPEAKING_SCHEMA_VERSION = 1;
export const LEGACY_PRACTICE_IDS = {
  "year-2": "year2-how-are-you",
  "year-3": "year3-describing-age",
  "year-4": "year4-australian-states-territories",
  "year-5": "year5-where-is",
  "year-6": "year6-birthday"
};

const clone = value => JSON.parse(JSON.stringify(value));
const cleanId = value => String(value || "").toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

export function suggestedPracticeId(yearLevelId, title) {
  const year = String(yearLevelId || "practice").replace("year-", "year");
  return cleanId(`${year}-${title}`) || `${year}-practice`;
}

function cleanSubstitution(substitution) {
  if (!substitution?.enabled || !substitution.targetWordId) return null;
  if (substitution.keyVocabSource === "vocabulary-library" && substitution.vocabularySetId) {
    return { enabled: true, targetWordId: substitution.targetWordId, keyVocabSource: "vocabulary-library", vocabularySetId: substitution.vocabularySetId };
  }
  if (Array.isArray(substitution.vocabulary) && substitution.vocabulary.length) {
    return { enabled: true, targetWordId: substitution.targetWordId, keyVocabSource: "manual", vocabulary: clone(substitution.vocabulary) };
  }
  return null;
}

export function cleanPublishedPractices(practices) {
  return Object.fromEntries(PRACTICE_IDS.map(practiceId => {
    const source = practices[practiceId];
    const practice = { label: String(source.label || "").slice(0, 60), words: clone(source.words) };
    const substitution = cleanSubstitution(source.substitution);
    if (substitution) practice.substitution = substitution;
    if (source.teacherAudio) practice.teacherAudio = clone(source.teacherAudio);
    return [practiceId, practice];
  }));
}

export function normalizeSavedPractice(value, id = "") {
  const fallbackSettings = normalizePractice(null).settings;
  const normalizeActivity = (activity, fallbackLabel) => ({
    ...normalizeDifferentiatedPractice(activity, fallbackLabel),
    ...(activity?.teacherAudio ? { teacherAudio: clone(activity.teacherAudio) } : {})
  });
  return {
    id: String(value?.id || id),
    schemaVersion: SPEAKING_SCHEMA_VERSION,
    yearLevelId: String(value?.yearLevelId || ""),
    yearLevelLabel: String(value?.yearLevelLabel || yearLevelLabel(value?.yearLevelId)),
    title: String(value?.title || value?.lessonTitle || "Mandarin speaking practice"),
    practices: {
      core: normalizeActivity(value?.practices?.core, "Core Practice"),
      challenge: normalizeActivity(value?.practices?.challenge, "Challenge Practice")
    },
    displaySettings: { ...fallbackSettings, ...(value?.displaySettings || {}) },
    audioSettings: { ...fallbackSettings, ...(value?.audioSettings || {}) },
    deleted: value?.deleted === true,
    createdAt: value?.createdAt || null,
    createdBy: String(value?.createdBy || ""),
    updatedAt: value?.updatedAt || null,
    updatedBy: String(value?.updatedBy || ""),
    migration: value?.migration || null
  };
}

export function savedPracticePayload({ id, yearLevelId, title, practices, settings, teacherAudio = {}, migration = null }) {
  const withAudio = Object.fromEntries(PRACTICE_IDS.map(practiceId => { const { teacherAudio: ignoredAudio, ...definition } = practices[practiceId]; return [practiceId, {
    ...definition,
    ...(teacherAudio[practiceId] ? { teacherAudio: teacherAudio[practiceId] } : {})
  }]; }));
  return {
    id,
    schemaVersion: SPEAKING_SCHEMA_VERSION,
    yearLevelId,
    yearLevelLabel: yearLevelLabel(yearLevelId),
    title: String(title || "Mandarin speaking practice").slice(0, 80),
    practices: cleanPublishedPractices(withAudio),
    displaySettings: {
      showPinyin: Boolean(settings.showPinyin), showMeanings: Boolean(settings.showMeanings),
      enableHover: Boolean(settings.enableHover), enableTap: Boolean(settings.enableTap)
    },
    audioSettings: { modelAudio: settings.modelAudio || "ai", speechRate: Number(settings.speechRate) || 0.8 },
    deleted: false,
    ...(migration ? { migration } : {})
  };
}

export async function uniquePracticeId(services, desiredId) {
  const base = cleanId(desiredId) || `practice-${Date.now()}`;
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const id = suffix ? `${base}-${suffix + 1}` : base;
    const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "speakingPractices", id));
    if (!snapshot.exists()) return id;
  }
  return `${base}-${Date.now()}`;
}

export async function listSpeakingPractices(services) {
  const snapshot = await services.firestoreSdk.getDocs(services.firestoreSdk.collection(services.db, "speakingPractices"));
  return snapshot.docs.map(doc => normalizeSavedPractice(doc.data(), doc.id)).filter(item => !item.deleted)
    .sort((a, b) => String(b.updatedAt?.seconds || 0).localeCompare(String(a.updatedAt?.seconds || 0)) || a.title.localeCompare(b.title));
}

export async function loadSpeakingPractice(services, practiceId) {
  const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "speakingPractices", practiceId));
  return snapshot.exists() ? normalizeSavedPractice(snapshot.data(), snapshot.id) : null;
}

export async function saveSpeakingPractice(services, payload, currentUser, isNew) {
  const ref = services.firestoreSdk.doc(services.db, "speakingPractices", payload.id);
  const audit = { updatedAt: services.firestoreSdk.serverTimestamp(), updatedBy: currentUser.uid };
  if (isNew) Object.assign(audit, { createdAt: services.firestoreSdk.serverTimestamp(), createdBy: currentUser.uid });
  await services.firestoreSdk.setDoc(ref, { ...payload, ...audit }, { merge: !isNew });
  return loadSpeakingPractice(services, payload.id);
}

export function legacySnapshot(saved, timestamp) {
  return {
    yearLevelId: saved.yearLevelId,
    yearLevelLabel: saved.yearLevelLabel || yearLevelLabel(saved.yearLevelId),
    lessonTitle: saved.title,
    practices: cleanPublishedPractices(saved.practices),
    displaySettings: saved.displaySettings,
    audioSettings: saved.audioSettings,
    published: true,
    updatedAt: timestamp
  };
}

export async function publishSpeakingPractice(services, saved, currentUser) {
  const batch = services.firestoreSdk.writeBatch(services.db);
  const timestamp = services.firestoreSdk.serverTimestamp();
  batch.set(services.firestoreSdk.doc(services.db, "speakingState", saved.yearLevelId), {
    yearLevelId: saved.yearLevelId,
    currentPracticeId: saved.id,
    publishedAt: timestamp,
    publishedBy: currentUser.uid
  });
  batch.set(services.firestoreSdk.doc(services.db, "yearLevels", saved.yearLevelId), legacySnapshot(saved, timestamp));
  await batch.commit();
}

export async function duplicateSpeakingPractice(services, source, currentUser) {
  const id = await uniquePracticeId(services, `${source.id}-copy`);
  const duplicate = savedPracticePayload({
    id, yearLevelId: source.yearLevelId, title: `${source.title} (Copy)`, practices: source.practices,
    settings: { ...source.displaySettings, ...source.audioSettings }, teacherAudio: {}
  });
  return saveSpeakingPractice(services, duplicate, currentUser, true);
}

export async function softDeleteSpeakingPractice(services, practiceId, currentUser) {
  await services.firestoreSdk.updateDoc(services.firestoreSdk.doc(services.db, "speakingPractices", practiceId), {
    deleted: true, updatedAt: services.firestoreSdk.serverTimestamp(), updatedBy: currentUser.uid
  });
}

export async function migrateLegacyYearLevels(services, currentUser) {
  const results = [];
  for (const [yearLevelId, preferredId] of Object.entries(LEGACY_PRACTICE_IDS)) {
    const legacy = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "yearLevels", yearLevelId));
    if (!legacy.exists() || legacy.data().published !== true) continue;
    const id = preferredId;
    const target = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "speakingPractices", id));
    if (!target.exists()) {
      const data = legacy.data();
      const normalized = normalizeSavedPractice(data, id);
      const payload = savedPracticePayload({ id, yearLevelId, title: data.lessonTitle, practices: normalized.practices,
        settings: { ...data.displaySettings, ...data.audioSettings },
        teacherAudio: Object.fromEntries(PRACTICE_IDS.map(practiceId => [practiceId, data.practices?.[practiceId]?.teacherAudio || null])),
        migration: { source: `yearLevels/${yearLevelId}`, migratedAt: new Date().toISOString() }
      });
      await saveSpeakingPractice(services, payload, currentUser, true);
    }
    const state = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "speakingState", yearLevelId));
    if (!state.exists()) await publishSpeakingPractice(services, await loadSpeakingPractice(services, id), currentUser);
    results.push(id);
  }
  return results;
}

export function validSavedPractice(value) {
  return Boolean(value && value.id && isValidYearLevelId(value.yearLevelId) && value.practices?.core && value.practices?.challenge);
}
