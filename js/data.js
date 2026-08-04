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

export function cloneDefaultPractice() {
  return JSON.parse(JSON.stringify(DEFAULT_PRACTICE));
}

export function cleanPinyin(value = "") {
  return value.toLowerCase().replace(/[^a-z\s'-]/g, "").replace(/\s+/g, " ").trim();
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
