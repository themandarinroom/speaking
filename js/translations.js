import { getLanguage, saveLanguage } from "./storage.js";

export const TEXT = {
  en: {
    appTitle: "Mandarin Speaking Practice", classroomTool: "Classroom tool", homeIntro: "Choose a mode to begin.",
    teacherMode: "Teacher Mode", studentMode: "Student Mode", teacherModeHelp: "Create the sentence and lesson settings.", studentModeHelp: "Listen, explore words and record.",
    privacyShort: "All practice and recordings stay on this device.", backHome: "Home", openStudent: "Open Student Mode", teacherHeading: "Build the practice sentence", teacherIntro: "Add one word unit at a time. Pinyin stays lowercase and has no tone marks.",
    words: "Word units", hanzi: "Hanzi", pinyin: "Pinyin (no tones)", meaning: "English meaning", actions: "Actions", moveUp: "Move up", moveDown: "Move down", deleteWord: "Delete", addWord: "Add word",
    settings: "Student display settings", showPinyin: "Show Pinyin", showMeanings: "Show English meanings", enableHover: "Enable desktop hover", enableTap: "Enable tap interaction", modelAudio: "Model audio", aiVoice: "AI Voice", teacherVoice: "Teacher Voice", studentChoice: "Student choice", speechRate: "AI speech rate", defaultRate: "Default: 0.8",
    teacherRecording: "Teacher model recording", record: "Record", stop: "Stop", play: "Play", replace: "Replace", remove: "Remove", recording: "Recording…", recordingReady: "Recording saved on this device.", recordingRemoved: "Teacher recording removed.",
    preview: "Live student preview", saved: "Saved on this device.", saveFailed: "Could not save. This device may be out of browser storage.",
    studentHeading: "Listen and have a go!", tapPrompt: "Tap a word to see its meaning.", listen: "Listen", tryAgain: "Try Again", ready: "Ready", listening: "Listen carefully, then have a go!", studentRecording: "Recording…", studentRecorded: "Great job! Play your recording or try again.", cleared: "Ready to try again.", playing: "Playing…",
    aiChoice: "AI Voice", teacherChoice: "Teacher Voice", chooseVoice: "Choose a voice", microphoneHelp: "The first time you record, tap “Allow” for microphone access. Recordings stay in this browser and are never uploaded.",
    microphoneDenied: "Microphone access was blocked. Allow it in your browser settings.", recordingUnsupported: "This browser cannot record audio. Try the latest Safari, Chrome or Edge.", recordingFailed: "Could not start recording. Please try again.", playbackFailed: "Could not play the recording.", speechUnsupported: "This browser cannot read the sentence aloud.", noWords: "Ask your teacher to add some words.",
    languageLabel: "Switch to Chinese"
  },
  zh: {
    appTitle: "中文跟读录音练习", classroomTool: "课堂工具", homeIntro: "请选择使用模式。",
    teacherMode: "教师模式", studentMode: "学生模式", teacherModeHelp: "编辑练习句子和课堂设置。", studentModeHelp: "听一听、认词语、练录音。",
    privacyShort: "练习内容和录音只保存在这台设备上。", backHome: "主页", openStudent: "打开学生模式", teacherHeading: "编辑练习句子", teacherIntro: "每行填写一个词语。拼音使用小写字母，不标声调。",
    words: "词语", hanzi: "汉字", pinyin: "拼音（不标声调）", meaning: "英文意思", actions: "操作", moveUp: "上移", moveDown: "下移", deleteWord: "删除", addWord: "添加词语",
    settings: "学生显示设置", showPinyin: "显示拼音", showMeanings: "显示英文意思", enableHover: "启用鼠标悬停", enableTap: "启用点按互动", modelAudio: "示范录音", aiVoice: "AI 语音", teacherVoice: "老师录音", studentChoice: "学生选择", speechRate: "AI 语速", defaultRate: "默认：0.8",
    teacherRecording: "老师示范录音", record: "录音", stop: "停止", play: "播放", replace: "重新录音", remove: "删除", recording: "正在录音……", recordingReady: "录音已保存在这台设备上。", recordingRemoved: "老师录音已删除。",
    preview: "学生画面预览", saved: "已保存在这台设备上。", saveFailed: "无法保存，浏览器储存空间可能已满。",
    studentHeading: "听一听，再来试试吧！", tapPrompt: "点一个词语，看看它的意思。", listen: "听一听", tryAgain: "再试一次", ready: "准备好了", listening: "仔细听一听，再来试试吧！", studentRecording: "正在录音……", studentRecorded: "真棒！可以播放录音，或再试一次。", cleared: "准备好了，再试一次吧！", playing: "正在播放……",
    aiChoice: "AI 语音", teacherChoice: "老师录音", chooseVoice: "选择声音", microphoneHelp: "第一次录音时，请点“允许”使用麦克风。录音只保存在浏览器中，不会上传。",
    microphoneDenied: "麦克风权限被关闭了。请在浏览器设置中允许使用麦克风。", recordingUnsupported: "这个浏览器不能录音。请使用最新版 Safari、Chrome 或 Edge。", recordingFailed: "无法开始录音，请再试一次。", playbackFailed: "无法播放录音。", speechUnsupported: "这个浏览器不能朗读句子。", noWords: "请老师先添加练习词语。",
    languageLabel: "切换到英文"
  }
};

let language = getLanguage();
export const t = key => TEXT[language][key] || TEXT.en[key] || key;
export const getCurrentLanguage = () => language;

export function applyTranslations(root = document) {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t("appTitle");
  root.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach(element => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
    element.setAttribute("title", t(element.dataset.i18nAria));
  });
  root.querySelectorAll("[data-language-toggle]").forEach(button => {
    button.textContent = "English / 中文";
    button.setAttribute("aria-label", t("languageLabel"));
  });
}

export function initPageTranslations(onChange) {
  applyTranslations();
  document.querySelectorAll("[data-language-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      language = language === "en" ? "zh" : "en";
      saveLanguage(language);
      applyTranslations();
      onChange?.();
    });
  });
}
