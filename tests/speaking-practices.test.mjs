import test from "node:test";
import assert from "node:assert/strict";
import { cloneDefaultPractices } from "../js/data.js";
import { legacySnapshot, normalizeSavedPractice, publishSpeakingPractice, savedPracticePayload, suggestedPracticeId } from "../js/speaking-practices.js";

const audio = { path: "teacher-recordings/practices/year4-states/core/latest", downloadURL: "https://example.test/audio", contentType: "audio/webm", revision: 1 };

test("stable IDs do not depend on later title edits", () => {
  assert.equal(suggestedPracticeId("year-4", "Have you been to...?"), "year4-have-you-been-to");
});

test("saved practice normalization retains Teacher Voice metadata", () => {
  const practices = cloneDefaultPractices(); practices.core.teacherAudio = audio;
  const saved = normalizeSavedPractice({ id: "year4-states", yearLevelId: "year-4", practices });
  assert.deepEqual(saved.practices.core.teacherAudio, audio);
});

test("duplicate-style payloads omit source Teacher Voice", () => {
  const practices = cloneDefaultPractices(); practices.core.teacherAudio = audio;
  const payload = savedPracticePayload({ id: "year4-states-copy", yearLevelId: "year-4", title: "Copy", practices, settings: practices.core.settings, teacherAudio: {} });
  assert.equal(payload.practices.core.teacherAudio, undefined);
});

test("compatibility snapshot retains stable Teacher Voice paths", () => {
  const practices = cloneDefaultPractices(); practices.core.teacherAudio = audio;
  const saved = normalizeSavedPractice({ id: "year4-states", yearLevelId: "year-4", yearLevelLabel: "Year 4", title: "States", practices });
  assert.equal(legacySnapshot(saved, "timestamp").practices.core.teacherAudio.path, audio.path);
});

test("publish updates only the year pointer and compatibility snapshot", async () => {
  const writes = [];
  const services = {
    db: {},
    firestoreSdk: {
      writeBatch: () => ({ set: (ref, value) => writes.push([ref, value]), commit: async () => writes.push(["commit"]) }),
      doc: (_db, collection, id) => `${collection}/${id}`,
      serverTimestamp: () => "server-time"
    }
  };
  const practices = cloneDefaultPractices();
  const saved = normalizeSavedPractice({ id: "year4-states", yearLevelId: "year-4", yearLevelLabel: "Year 4", title: "States", practices });
  await publishSpeakingPractice(services, saved, { uid: "teacher-1" });
  assert.equal(writes[0][0], "speakingState/year-4");
  assert.equal(writes[0][1].currentPracticeId, "year4-states");
  assert.equal(writes[1][0], "yearLevels/year-4");
  assert.deepEqual(writes[2], ["commit"]);
});
