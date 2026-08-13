const UPLOAD_TIMEOUT_MS = 60_000;

export const teacherAudioPath = (yearLevelId, practiceId) => `teacher-recordings/${yearLevelId}/${practiceId}/latest`;
export const stableTeacherAudioPath = (speakingPracticeId, practiceId) => `teacher-recordings/practices/${speakingPracticeId}/${practiceId}/latest`;

export async function uploadTeacherAudio(services, ownerId, practiceId, blob, onProgress = () => {}, stable = false) {
  const authUser = services.auth.currentUser;
  const path = stable ? stableTeacherAudioPath(ownerId, practiceId) : teacherAudioPath(ownerId, practiceId);
  const contentType = blob.type || "audio/webm";

  if (!authUser) {
    throw Object.assign(new Error("Firebase Auth is not ready for the teacher audio upload."), { code: "storage/unauthenticated" });
  }
  if (services.auth.app !== services.storage.app) {
    throw Object.assign(new Error("Firebase Auth and Storage are using different app instances."), { code: "storage/app-mismatch" });
  }

  await authUser.getIdToken(true);
  if (services.auth.currentUser?.uid !== authUser.uid) {
    throw Object.assign(new Error("The authenticated teacher changed before the upload started."), { code: "storage/auth-changed" });
  }

  console.info("[Teacher Voice upload]", {
    currentUserUid: authUser.uid,
    currentUserEmail: authUser.email,
    requestAuthUid: services.auth.currentUser.uid,
    uploadPath: path,
    contentType,
    sameFirebaseApp: true
  });

  const { ref, uploadBytesResumable, getDownloadURL } = services.storageSdk;
  const audioRef = ref(services.storage, path);
  const task = uploadBytesResumable(audioRef, blob, {
    contentType,
    cacheControl: "no-store, max-age=0"
  });

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      task.cancel();
      reject(Object.assign(new Error("upload-timeout"), { code: "storage/upload-timeout" }));
    }, UPLOAD_TIMEOUT_MS);

    task.on("state_changed", snapshot => {
      const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      onProgress(percent);
    }, error => {
      window.clearTimeout(timeout);
      console.error("[Teacher Voice upload failed]", {
        currentUserUid: services.auth.currentUser?.uid || null,
        currentUserEmail: services.auth.currentUser?.email || null,
        requestAuthUid: services.auth.currentUser?.uid || null,
        uploadPath: path,
        contentType,
        errorCode: error.code || null
      });
      reject(error);
    }, async () => {
      window.clearTimeout(timeout);
      try {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({
          path,
          downloadURL,
          contentType,
          revision: Date.now()
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function deleteTeacherAudio(services, ownerId, practiceId, stable = false) {
  const { ref, deleteObject } = services.storageSdk;
  try {
    await deleteObject(ref(services.storage, stable ? stableTeacherAudioPath(ownerId, practiceId) : teacherAudioPath(ownerId, practiceId)));
  } catch (error) {
    if (error.code !== "storage/object-not-found") throw error;
  }
}

export function cacheSafeAudioUrl(audio) {
  if (!audio?.downloadURL) return "";
  const separator = audio.downloadURL.includes("?") ? "&" : "?";
  return `${audio.downloadURL}${separator}revision=${encodeURIComponent(audio.revision || "latest")}`;
}
