export const DEFAULT_PRACTICE = {
  version: 3,
  words: [
    { id: "word-1", hanzi: "我", pinyin: "wo", meaning: "I / me" },
    { id: "word-2", hanzi: "喜欢", pinyin: "xi huan", meaning: "like" },
    { id: "word-3", hanzi: "学习", pinyin: "xue xi", meaning: "study" },
    { id: "word-4", hanzi: "中文", pinyin: "zhong wen", meaning: "Chinese" }
  ],
  settings: {
    showPinyin: true,
    showMeanings: true,
    enableHover: true,
    enableTap: true,
    modelAudio: "ai",
    speechRate: 0.8
  }
};

export const DEFAULT_CHALLENGE_PRACTICE = {
  version: 3,
  words: [
    { id: "challenge-word-1", hanzi: "我", pinyin: "wo", meaning: "I / me" },
    { id: "challenge-word-2", hanzi: "会", pinyin: "hui", meaning: "can" },
    { id: "challenge-word-3", hanzi: "说", pinyin: "shuo", meaning: "speak" },
    { id: "challenge-word-4", hanzi: "中文", pinyin: "zhong wen", meaning: "Chinese" }
  ],
  settings: { ...DEFAULT_PRACTICE.settings }
};

export function cloneDefaultPractice() {
  return JSON.parse(JSON.stringify(DEFAULT_PRACTICE));
}

export function cloneDefaultPractices() {
  return {
    core: { label: "Core Practice", ...cloneDefaultPractice() },
    challenge: { label: "Challenge Practice", ...JSON.parse(JSON.stringify(DEFAULT_CHALLENGE_PRACTICE)) }
  };
}

export function cleanPinyin(value = "") {
  return value.toLowerCase().replace(/[^a-z\s'-]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeSubstitution(value, words) {
  const wordIds = new Set(words.map(word => word.id));
  const targetWordId = wordIds.has(String(value?.targetWordId || "")) ? String(value.targetWordId) : "";
  const seen = new Set();
  const vocabulary = (Array.isArray(value?.vocabulary) ? value.vocabulary : []).slice(0, 20).map((item, index) => {
    let id = String(item?.id || `vocabulary-${Date.now()}-${index}`).trim();
    if (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return {
      id,
      hanzi: String(item?.hanzi || "").trim(),
      pinyin: cleanPinyin(String(item?.pinyin || "")),
      meaning: String(item?.meaning || "").trim(),
      imageUrl: String(item?.imageUrl || "").trim(),
      emoji: String(item?.emoji || "").trim()
    };
  }).filter(item => item.hanzi || item.pinyin || item.meaning);
  return { enabled: Boolean(value?.enabled) && Boolean(targetWordId), targetWordId, vocabulary };
}

export function normalizeDifferentiatedPractice(value, fallbackLabel) {
  const practice = normalizePractice({ words: value?.words });
  return {
    label: String(value?.label || fallbackLabel),
    version: practice.version,
    words: practice.words,
    substitution: normalizeSubstitution(value?.substitution, practice.words)
  };
}

export function substitutePracticeWords(words, substitution, selectedVocabularyId) {
  const selected = substitution?.vocabulary?.find(item => item.id === selectedVocabularyId);
  if (!substitution?.enabled || !selected) return words.map(word => ({ ...word }));
  return words.map(word => word.id === substitution.targetWordId ? { ...word, hanzi: selected.hanzi, pinyin: selected.pinyin, meaning: selected.meaning } : { ...word });
}

export function normalizePractice(value) {
  const fallback = cloneDefaultPractice();
  if (!value || !Array.isArray(value.words)) return fallback;
  const words = value.words.map((word, index) => ({
    id: String(word.id || `word-${Date.now()}-${index}`),
    hanzi: String(word.hanzi || "").trim(),
    pinyin: cleanPinyin(String(word.pinyin || "")),
    meaning: String(word.meaning || "").trim()
  })).filter(word => word.hanzi || word.pinyin || word.meaning);
  return {
    version: 3,
    words: words.length ? words : fallback.words,
    settings: { ...fallback.settings, ...(value.settings || {}) }
  };
}

export function sentenceText(words) {
  return words.map(word => word.hanzi).join("");
}
