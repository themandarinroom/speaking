export const PILOT_ROOMS = ["6B", "6D", "5C", "5E", "4B", "4C", "4D", "3A", "3B"];

export function normalizeRoomId(value = "") {
  return String(value).trim().toUpperCase();
}

export function isValidRoomId(value) {
  return PILOT_ROOMS.includes(normalizeRoomId(value));
}
