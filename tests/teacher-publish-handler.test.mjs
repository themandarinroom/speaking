import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("editor publish button does not pass its click event as the saved practice", async () => {
  const source = await readFile(new URL("../js/teacher.js", import.meta.url), "utf8");

  assert.match(source, /publishBtn\.addEventListener\("click", \(\) => publishYearLevel\(\)\);/);
  assert.doesNotMatch(source, /publishBtn\.addEventListener\("click", publishYearLevel\);/);
});
