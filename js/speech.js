import { sentenceText } from "./data.js";

export function canSpeak() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function speakMandarin(words, rate = 0.8) {
  if (!canSpeak()) throw new Error("speechUnsupported");
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentenceText(words));
  utterance.lang = "zh-CN";
  utterance.rate = Number(rate) || 0.8;
  window.speechSynthesis.speak(utterance);
  return utterance;
}
