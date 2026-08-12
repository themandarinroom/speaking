import { cleanPinyin } from "./data.js";
import { getFirebaseServices } from "./firebase.js";

const SETS = "vocabularySets";
const VOICES = "vocabularyTeacherVoices";

function itemForSpeaking(item = {}) {
  return {
    id: String(item.id || ""),
    hanzi: String(item.chinese || "").trim(),
    pinyin: cleanPinyin(String(item.pinyin || "")),
    meaning: String(item.english || "").trim(),
    imageUrl: String(item.image?.url || item.imageUrl || "").trim(),
    emoji: String(item.emoji || "").trim(),
    aiEnabled: item.audio?.aiEnabled !== false,
    teacherAudioUrl: ""
  };
}

export async function listVocabularySets() {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is not configured.");
  const query = services.firestoreSdk.query(
    services.firestoreSdk.collection(services.db, SETS),
    services.firestoreSdk.where("published", "==", true)
  );
  const snapshot = await services.firestoreSdk.getDocs(query);
  return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })).filter(set => set.deleted !== true).map(set => ({
    id: String(set.id || set.docId), yearLevel: Number(set.yearLevel) || 0,
    title: String(set.title || ""), chineseTitle: String(set.chineseTitle || "")
  })).sort((a, b) => a.yearLevel - b.yearLevel || a.title.localeCompare(b.title));
}

export async function loadVocabularySet(setId, { includeVoices = true } = {}) {
  if (!setId) return null;
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase is not configured.");
  const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, SETS, setId));
  if (!snapshot.exists() || snapshot.data().published !== true || snapshot.data().deleted === true) return null;
  const data = snapshot.data();
  const items = (Array.isArray(data.items) ? data.items : []).map(itemForSpeaking).filter(item => item.id && item.hanzi);
  if (includeVoices) await Promise.all(items.map(async item => {
    const voiceId = `${setId}--${item.id}`;
    const voice = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, VOICES, voiceId));
    if (voice.exists()) item.teacherAudioUrl = String(voice.data().teacherAudioUrl || "");
  }));
  return { id: String(data.id || setId), yearLevel: Number(data.yearLevel) || 0, title: String(data.title || ""), chineseTitle: String(data.chineseTitle || ""), items };
}

export function applyVocabularySet(practice, set) {
  return {
    ...practice,
    substitution: {
      ...practice.substitution,
      vocabulary: set?.items?.map(item => ({ ...item })) || []
    }
  };
}
