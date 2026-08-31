import test from "node:test";
import assert from "node:assert/strict";
import { cleanPinyin, cleanPinyinInput } from "../js/data.js";

test("Pinyin editing preserves a trailing space while the teacher types", () => {
  assert.equal(cleanPinyinInput("wo "), "wo ");
  assert.equal(cleanPinyinInput("wo  ma"), "wo ma");
  assert.equal(cleanPinyinInput("Wo Ma"), "wo ma");
});

test("Pinyin is normalized when editing finishes", () => {
  assert.equal(cleanPinyin("wo ma "), "wo ma");
  assert.equal(cleanPinyin("  kun shi lan  "), "kun shi lan");
});
