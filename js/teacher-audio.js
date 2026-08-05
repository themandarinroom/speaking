const UPLOAD_TIMEOUT_MS = 60_000;

export const teacherAudioPath = roomId => `teacher-recordings/${roomId}/latest`;

export function uploadTeacherAudio(services, roomId, blob, onProgress = () => {}) {
  const { ref, uploadBytesResumable, getDownloadURL } = services.storageSdk;
  const audioRef = ref(services.storage, teacherAudioPath(roomId));
  const task = uploadBytesResumable(audioRef, blob, {
    contentType: blob.type || "audio/webm",
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
      reject(error);
    }, async () => {
      window.clearTimeout(timeout);
      try {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({
          path: teacherAudioPath(roomId),
          downloadURL,
          contentType: blob.type || "audio/webm",
          revision: Date.now()
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function deleteTeacherAudio(services, roomId) {
  const { ref, deleteObject } = services.storageSdk;
  try {
    await deleteObject(ref(services.storage, teacherAudioPath(roomId)));
  } catch (error) {
    if (error.code !== "storage/object-not-found") throw error;
  }
}

export function cacheSafeAudioUrl(audio) {
  if (!audio?.downloadURL) return "";
  const separator = audio.downloadURL.includes("?") ? "&" : "?";
  return `${audio.downloadURL}${separator}revision=${encodeURIComponent(audio.revision || "latest")}`;
}
