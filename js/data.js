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
  const practices = {
    core: { label: "Core Practice", ...cloneDefaultPractice() },
    challenge: { label: "Challenge Practice", ...JSON.parse(JSON.stringify(DEFAULT_CHALLENGE_PRACTICE)) }
  };
  Object.values(practices).forEach(practice => { practice.substitution = { enabled: false, targetWordId: "", keyVocabSource: "vocabulary-library", vocabularySetId: "", vocabulary: [] }; });
  return practices;
}

export function cleanPinyin(value = "") {
  return value.toLowerCase().replace(/[^a-z\s'-]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeSubstitution(value, words) {
  const wordIds = new Set(words.filter(word => splitWordPunctuation(word.hanzi).text).map(word => word.id));
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
  const keyVocabSource = value?.keyVocabSource === "vocabulary-library" ? "vocabulary-library" : "manual";
  return { enabled: Boolean(value?.enabled) && Boolean(targetWordId), targetWordId, keyVocabSource, vocabularySetId: keyVocabSource === "vocabulary-library" ? String(value?.vocabularySetId || "") : "", vocabulary };
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
  return words.map(word => {
    if (word.id !== substitution.targetWordId) return { ...word };
    const punctuation = splitWordPunctuation(word.hanzi).punctuation;
    return { ...word, hanzi: `${splitWordPunctuation(selected.hanzi).text}${punctuation}`, pinyin: selected.pinyin, meaning: selected.meaning };
  });
}

const TRAILING_PUNCTUATION = /[。，？！：.!?,:]+$/u;
const SENTENCE_ENDING_PUNCTUATION = /[。？！.!?]$/u;
const FULL_WIDTH_PUNCTUATION = { ".": "。", "?": "？", "!": "！", ",": "，", ":": "：" };

function normalizePunctuation(value = "") {
  return [...String(value)].map(mark => FULL_WIDTH_PUNCTUATION[mark] || mark).join("");
}

export function splitWordPunctuation(hanzi = "") {
  const value = String(hanzi);
  const match = value.match(TRAILING_PUNCTUATION);
  return { text: match ? value.slice(0, -match[0].length) : value, punctuation: normalizePunctuation(match?.[0] || "") };
}

export function practiceTitlePunctuation(title = "") {
  const trimmed = String(title).trim();
  if (/[?？]$/u.test(trimmed)) return "？";
  if (/[!！]$/u.test(trimmed)) return "！";
  return "。";
}

export function hasSentenceEndingPunctuation(value = "") {
  return SENTENCE_ENDING_PUNCTUATION.test(String(value).trim());
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

export function sentenceText(words, fallbackPunctuation = "。") {
  const rawSentence = words.map(word => word.hanzi).join("");
  const { text, punctuation } = splitWordPunctuation(rawSentence);
  const sentence = `${text}${punctuation}`;
  return hasSentenceEndingPunctuation(sentence) || !fallbackPunctuation ? sentence : `${sentence}${normalizePunctuation(fallbackPunctuation)}`;
}
