import { readFileSync } from "node:fs";
import { load } from "js-yaml";

for (const file of [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
]) {
  const workflow = load(readFileSync(file, "utf8"));
  if (!workflow || typeof workflow !== "object") {
    throw new Error(`${file}: workflow must be a mapping`);
  }
  if (!workflow.jobs || typeof workflow.jobs !== "object") {
    throw new Error(`${file}: missing jobs mapping`);
  }
  if (workflow.job) {
    throw new Error(`${file}: use jobs, not job`);
  }
}

console.log("Workflow syntax checks passed.");
