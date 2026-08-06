export const YEAR_LEVELS = [
  { id: "prep", label: "Prep" },
  { id: "year-1", label: "Year 1" },
  { id: "year-2", label: "Year 2" },
  { id: "year-3", label: "Year 3" },
  { id: "year-4", label: "Year 4" },
  { id: "year-5", label: "Year 5" },
  { id: "year-6", label: "Year 6" }
];

export const PRACTICE_IDS = ["core", "challenge"];

export const normalizeYearLevelId = value => String(value || "").trim().toLowerCase();
export const isValidYearLevelId = value => YEAR_LEVELS.some(level => level.id === normalizeYearLevelId(value));
export const yearLevelLabel = value => YEAR_LEVELS.find(level => level.id === normalizeYearLevelId(value))?.label || "";
export const isValidPracticeId = value => PRACTICE_IDS.includes(value);
