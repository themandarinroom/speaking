import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { initPageTranslations, t } from "./translations.js?v=student-entry-auth-2";
import { YEAR_LEVELS } from "./year-levels.js";

const authState = document.getElementById("homeAuthState");
const signInBtn = document.getElementById("homeSignInBtn");
const signOutBtn = document.getElementById("homeSignOutBtn");
const teacherCard = document.getElementById("landingTeacherCard");
const modeGrid = document.getElementById("landingModeGrid");
const yearForm = document.getElementById("homeYearForm");
const yearSelect = document.getElementById("homeYearLevel");

let services = null;
let currentUser = null;
let authorised = false;

YEAR_LEVELS.forEach(level => {
  const option = document.createElement("option");
  option.value = level.id;
  option.textContent = level.label;
  yearSelect.append(option);
});

function renderAuth() {
  if (!isFirebaseConfigured()) authState.textContent = t("firebaseSetupNeeded");
  else if (currentUser && authorised) authState.textContent = `${t("signedInAs")}: ${currentUser.email || currentUser.displayName || "Teacher"}`;
  else if (currentUser) authState.textContent = t("notAuthorised");
  else authState.textContent = t("teacherSignInPrompt");
  signInBtn.hidden = Boolean(currentUser);
  signOutBtn.hidden = !currentUser;
  teacherCard.hidden = !authorised;
  modeGrid.classList.toggle("teacher-visible", authorised);
}

yearForm.addEventListener("submit", event => {
  event.preventDefault();
  location.href = `student.html?year=${encodeURIComponent(yearSelect.value)}`;
});

signInBtn.addEventListener("click", async () => {
  if (!services) return;
  try {
    await services.authSdk.signInWithPopup(services.auth, new services.authSdk.GoogleAuthProvider());
  } catch {
    authState.textContent = t("authFailed");
  }
});

signOutBtn.addEventListener("click", () => services?.authSdk.signOut(services.auth));
initPageTranslations(renderAuth);
renderAuth();

getFirebaseServices().then(result => {
  services = result;
  if (!services) { renderAuth(); return; }
  services.authSdk.onAuthStateChanged(services.auth, async user => {
    currentUser = user;
    authorised = false;
    if (user) {
      try {
        const snapshot = await services.firestoreSdk.getDoc(services.firestoreSdk.doc(services.db, "authorizedTeachers", user.uid));
        authorised = snapshot.exists() && snapshot.data().active === true;
      } catch {
        authorised = false;
      }
    }
    renderAuth();
  });
}).catch(() => {
  services = null;
  authState.textContent = t("authFailed");
});
