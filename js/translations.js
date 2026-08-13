import { getLanguage, saveLanguage } from "./storage.js";

export const TEXT = {
  en: {
    appTitle: "Mandarin Speaking Practice", classroomTool: "Classroom tool", homeIntro: "Choose a mode to begin.",
    teacherMode: "Teacher Mode", studentMode: "Student Mode", teacherModeHelp: "Create Core and Challenge speaking practice.", studentModeHelp: "Choose a year level, listen and record.", teacherSignIn: "Teacher Sign in", teacherSignInPrompt: "Sign in to create and publish speaking practice.",
    yearLevel: "Year level", lessonTitle: "Lesson Title", practiceLabel: "Practice title", corePractice: "Core Practice", challengePractice: "Challenge Practice", coreTeacherRecording: "Core Teacher Voice", challengeTeacherRecording: "Challenge Teacher Voice", chooseYearLevel: "Choose your year level", joinYearLevel: "Open year level", defaultPracticeTitle: "Mandarin speaking practice", signedOut: "Not signed in", signedInAs: "Signed in as", signInHelp: "Sign in to load and publish practices.", signInGoogle: "Sign in", signOut: "Sign out", firebaseSetupNeeded: "Firebase setup is not complete. Add the web configuration before using year levels.", authFailed: "Could not sign in. Please try again.", notAuthorised: "This account is not authorised to publish.", loadingYearLevel: "Loading the published year level…", yearLevelLoaded: "Published year level loaded.", yearLevelEmpty: "No published content exists for this year level yet.",
    privacyShort: "Student recordings stay on this device. Only teacher model audio is cloud-hosted.", backHome: "Home", openStudent: "Open Student Mode", teacherHeading: "Build differentiated speaking practice", teacherIntro: "Add one word unit at a time. Pinyin stays lowercase and has no tone marks.",
    words: "Word units", hanzi: "Hanzi", pinyin: "Pinyin (no tones)", meaning: "English meaning", actions: "Actions", moveUp: "Move up", moveDown: "Move down", deleteWord: "Delete", addWord: "Add word", interactiveVocabulary: "Interactive vocabulary", enableVocabulary: "Enable vocabulary choices", keyVocabularySource: "Key Vocabulary Source", manual: "Manual", vocabularyLibrary: "Vocabulary Library", vocabularySet: "Vocabulary Set", chooseVocabularySet: "Choose a vocabulary set", unavailableVocabularySet: "Unavailable vocabulary set", loadingVocabulary: "Loading vocabulary…", vocabularyLoadFailed: "Vocabulary could not be loaded.", retry: "Retry", vocabularySetMissing: "This Vocabulary Library set is no longer available. Choose another set or switch to Manual.", replaceableWord: "Replaceable sentence word", chooseReplaceableWord: "Choose a word", addVocabulary: "Add vocabulary", imageUrl: "Image URL (optional)", emoji: "Emoji (optional)", previewSubstitution: "Preview choice", keyVocabulary: "Key vocabulary", restoreExample: "Restore example", vocabularyListen: "Listen", teacherModelNotice: "Teacher Voice plays the original teacher model.", recordingClearedForVocabulary: "Sentence changed. Your previous recording was cleared.",
    settings: "Shared display and voice settings", showPinyin: "Show Pinyin", showMeanings: "Show English meanings", enableHover: "Enable desktop hover", enableTap: "Enable tap interaction", modelAudio: "Model audio", aiVoice: "AI Voice", teacherVoice: "Teacher Voice", studentChoice: "Student choice", speechRate: "AI speech rate", defaultRate: "Default: 0.8",
    teacherRecording: "Teacher model recording", record: "Record", stop: "Stop", play: "Play", replace: "Replace", remove: "Remove", recording: "Recording…", recordingReady: "Recording ready to publish.", recordingRemoved: "Teacher recording removed. Publish to update the class.",
    preview: "Preview", saved: "Saved on this device.", saveFailed: "Could not save. This device may be out of browser storage.",
    practiceLibrary: "Practice Library", yourSpeakingPractices: "Your speaking practices", practiceLibraryHelp: "Save reusable practices, then publish one current practice to each year level.", newPractice: "New practice", importPublished: "Import published practices", allYears: "All", practiceLibraryEmpty: "No saved practices match this filter.", loadingPractices: "Loading practices…", updatedOn: "Updated {date}", edit: "Edit", publish: "Publish", duplicate: "Duplicate", duplicating: "Duplicating…", practiceDuplicated: "Practice duplicated. Teacher Voice is intentionally not copied.", savedPractice: "Saved", unsavedChanges: "Unsaved changes", practiceUnavailable: "Speaking Practice unavailable.", savingPractice: "Saving practice…", practiceSaved: "Practice saved to the library.", savePractice: "Save practice", saveBeforePublish: "Save your changes before publishing.", savePublishHeading: "Save and publish", savePublishHelp: "Save changes to the library first. Publish makes this saved version current for its year level.", closeEditor: "Close", discardUnsaved: "Discard unsaved changes?", cannotDeletePublished: "This practice is currently published. Publish another practice to that year level before deleting it.", cannotDeleteUnitReference: "This practice is used by {count} Unit Library unit(s). Remove those references before deleting it.", unitCheckFailed: "The Unit Library reference check could not be completed, so this practice was not deleted.", confirmDeletePractice: "Delete “{title}”? This cannot be undone from the teacher interface.", confirmImportPublished: "Import the existing published year levels into the Practice Library? This is safe to run once and keeps the old year-level documents.", importingPublished: "Importing published practices…", importComplete: "Imported {count} published practice(s).",
    publishHeading: "Year-level publishing", publishHelp: "Publish both practices and Teacher Voice to this year level.", publishYearLevel: "Publish to Year Level", publishing: "Publishing both practices…", uploadingPracticeVoice: "Uploading {practice} Teacher Voice… {percent}%", publishSuccess: "Published successfully.", publishFailed: "Could not publish. Check your connection and teacher access.", lastPublished: "Last published: {time}",
    studentHeading: "Listen and have a go!", tapPrompt: "Tap a word to see its meaning.", listen: "Listen", tryAgain: "Try Again", ready: "Ready", listening: "Listen carefully, then have a go!", studentRecording: "Recording…", studentRecorded: "Great job! Play your recording or try again.", cleared: "Ready to try again.", playing: "Playing…",
    aiChoice: "AI Voice", teacherChoice: "Teacher Voice", chooseVoice: "Choose a voice", microphoneHelp: "The first time you record, tap “Allow” for microphone access. Recordings stay in this browser and are never uploaded.",
    enterRoom: "Enter your classroom room", roomCode: "Room code", joinRoom: "Join room", invalidRoom: "That room code is not part of this pilot.", waitingTeacher: "Waiting for your teacher to publish a practice.", roomLabel: "Room {room}", liveUpdate: "New practice received from your teacher.", connectionError: "Could not connect to the classroom. Check the internet and try again.", teacherRecordingUnavailable: "Teacher recording unavailable. Using AI Voice instead.",
    microphoneDenied: "Microphone access was blocked. Allow it in your browser settings.", recordingUnsupported: "This browser cannot record audio. Try the latest Safari, Chrome or Edge.", recordingFailed: "Could not start recording. Please try again.", playbackFailed: "Could not play the recording.", speechUnsupported: "This browser cannot read the sentence aloud.", noWords: "Ask your teacher to add some words.",
    languageLabel: "Switch to Chinese"
  },
  zh: {
    appTitle: "中文跟读录音练习", classroomTool: "课堂工具", homeIntro: "请选择使用模式。",
    teacherMode: "教师模式", studentMode: "学生模式", teacherModeHelp: "创建基础和挑战口语练习。", studentModeHelp: "选择年级，听一听并练录音。", teacherSignIn: "教师登录", teacherSignInPrompt: "登录以创建和发布口语练习。",
    yearLevel: "年级", lessonTitle: "课程标题", practiceLabel: "练习标题", corePractice: "基础练习", challengePractice: "挑战练习", coreTeacherRecording: "基础练习老师录音", challengeTeacherRecording: "挑战练习老师录音", chooseYearLevel: "选择你的年级", joinYearLevel: "打开年级", defaultPracticeTitle: "中文口语练习", signedOut: "尚未登录", signedInAs: "登录账号", signInHelp: "登录以加载和发布练习。", signInGoogle: "登录", signOut: "退出登录", firebaseSetupNeeded: "Firebase 尚未设置完成。请先添加网页配置信息。", authFailed: "无法登录，请再试一次。", notAuthorised: "这个账号没有发布权限。", loadingYearLevel: "正在加载年级练习……", yearLevelLoaded: "已加载年级练习。", yearLevelEmpty: "这个年级还没有已发布的练习。",
    privacyShort: "学生录音只保存在这台设备上。只有老师示范录音会储存在云端。", backHome: "主页", openStudent: "打开学生模式", teacherHeading: "创建分层口语练习", teacherIntro: "每行填写一个词语。拼音使用小写字母，不标声调。",
    words: "词语", hanzi: "汉字", pinyin: "拼音（不标声调）", meaning: "英文意思", actions: "操作", moveUp: "上移", moveDown: "下移", deleteWord: "删除", addWord: "添加词语", interactiveVocabulary: "互动词汇", enableVocabulary: "启用词汇选择", keyVocabularySource: "重点词汇来源", manual: "手动输入", vocabularyLibrary: "词汇库", vocabularySet: "词汇集", chooseVocabularySet: "请选择词汇集", unavailableVocabularySet: "不可用的词汇集", loadingVocabulary: "正在加载词汇……", vocabularyLoadFailed: "无法加载词汇。", retry: "重试", vocabularySetMissing: "这个词汇库词汇集已不存在。请选择另一个词汇集或切换到手动输入。", replaceableWord: "句中可替换词语", chooseReplaceableWord: "请选择词语", addVocabulary: "添加词汇", imageUrl: "图片网址（选填）", emoji: "表情符号（选填）", previewSubstitution: "预览选择", keyVocabulary: "重点词汇", restoreExample: "恢复示例句", vocabularyListen: "听一听", teacherModelNotice: "老师录音播放原来的示范句。", recordingClearedForVocabulary: "句子已改变，之前的学生录音已清除。",
    settings: "共用显示和语音设置", showPinyin: "显示拼音", showMeanings: "显示英文意思", enableHover: "启用鼠标悬停", enableTap: "启用点按互动", modelAudio: "示范录音", aiVoice: "AI 语音", teacherVoice: "老师录音", studentChoice: "学生选择", speechRate: "AI 语速", defaultRate: "默认：0.8",
    teacherRecording: "老师示范录音", record: "录音", stop: "停止", play: "播放", replace: "重新录音", remove: "删除", recording: "正在录音……", recordingReady: "录音已准备好发布。", recordingRemoved: "老师录音已删除。请发布以更新班级。",
    preview: "预览", saved: "已保存在这台设备上。", saveFailed: "无法保存，浏览器储存空间可能已满。",
    practiceLibrary: "练习库", yourSpeakingPractices: "口语练习库", practiceLibraryHelp: "先保存可重复使用的练习，再为每个年级发布一个当前练习。", newPractice: "新建练习", importPublished: "导入已发布练习", allYears: "全部", practiceLibraryEmpty: "没有符合筛选条件的练习。", loadingPractices: "正在加载练习……", updatedOn: "更新于 {date}", edit: "编辑", publish: "发布", duplicate: "复制", duplicating: "正在复制……", practiceDuplicated: "练习已复制。老师录音不会被复制。", savedPractice: "已保存", unsavedChanges: "有未保存修改", practiceUnavailable: "口语练习暂不可用。", savingPractice: "正在保存练习……", practiceSaved: "练习已保存到练习库。", savePractice: "保存练习", saveBeforePublish: "请先保存修改，再发布。", savePublishHeading: "保存与发布", savePublishHelp: "先把修改保存到练习库。发布会把这个已保存版本设为该年级的当前练习。", closeEditor: "关闭", discardUnsaved: "放弃未保存的修改吗？", cannotDeletePublished: "这个练习目前正在发布中。请先为该年级发布另一个练习。", cannotDeleteUnitReference: "这个练习被 {count} 个单元引用。请先移除这些引用。", unitCheckFailed: "无法完成单元引用检查，因此没有删除该练习。", confirmDeletePractice: "删除“{title}”吗？教师页面中无法恢复。", confirmImportPublished: "把现有已发布年级练习导入练习库吗？此操作可安全执行一次，并会保留旧年级文档。", importingPublished: "正在导入已发布练习……", importComplete: "已导入 {count} 个练习。",
    publishHeading: "年级发布", publishHelp: "把两项练习和老师录音发布到这个年级。", publishYearLevel: "发布到年级", publishing: "正在发布两项练习……", uploadingPracticeVoice: "正在上传{practice}老师录音……{percent}%", publishSuccess: "发布成功。", publishFailed: "无法发布，请检查网络和教师权限。", lastPublished: "上次发布：{time}",
    studentHeading: "听一听，再来试试吧！", tapPrompt: "点一个词语，看看它的意思。", listen: "听一听", tryAgain: "再试一次", ready: "准备好了", listening: "仔细听一听，再来试试吧！", studentRecording: "正在录音……", studentRecorded: "真棒！可以播放录音，或再试一次。", cleared: "准备好了，再试一次吧！", playing: "正在播放……",
    aiChoice: "AI 语音", teacherChoice: "老师录音", chooseVoice: "选择声音", microphoneHelp: "第一次录音时，请点“允许”使用麦克风。录音只保存在浏览器中，不会上传。",
    enterRoom: "输入教室班级", roomCode: "班级代码", joinRoom: "进入班级", invalidRoom: "这个班级代码不在试用名单中。", waitingTeacher: "正在等待老师发布练习。", roomLabel: "班级 {room}", liveUpdate: "已收到老师发布的新练习。", connectionError: "无法连接教室，请检查网络后再试。", teacherRecordingUnavailable: "老师录音暂时无法使用，已改用 AI 语音。",
    microphoneDenied: "麦克风权限被关闭了。请在浏览器设置中允许使用麦克风。", recordingUnsupported: "这个浏览器不能录音。请使用最新版 Safari、Chrome 或 Edge。", recordingFailed: "无法开始录音，请再试一次。", playbackFailed: "无法播放录音。", speechUnsupported: "这个浏览器不能朗读句子。", noWords: "请老师先添加练习词语。",
    languageLabel: "切换到英文"
  }
};

let language = getLanguage();
export const t = key => TEXT[language][key] || TEXT.en[key] || key;
export const getCurrentLanguage = () => language;
export function formatText(key, values = {}) {
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, value), t(key));
}

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
