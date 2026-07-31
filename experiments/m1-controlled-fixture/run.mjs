import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runControlledFixtureMatrix,
} from "./state-c-experiment.mjs";

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixture",
);

const result =
  runControlledFixtureMatrix(fixtureRoot);

for (const error of result.errors) {
  console.error(error);
}

if (result.preflightPassed) {
  console.log("M1_RUNNER_PREFLIGHT_VERIFIED");
  console.log("===== M1 SCENARIO SUMMARY =====");
}

for (const item of result.summary) {
  console.log(
    `scenario=${item.scenario} ` +
    `verdict=${item.verdict} ` +
    `stateA=${item.outcomes[0]} ` +
    `stateB=${item.outcomes[1]} ` +
    `stateC=${item.outcomes[2]} ` +
    `passed=${item.passed ? "yes" : "no"}`,
  );
}

console.log("===== M1 JSON MANIFEST BEGIN =====");
console.log(
  JSON.stringify(result.manifest, null, 2),
);
console.log("===== M1 JSON MANIFEST END =====");

if (result.exitCode === 0) {
  console.log(result.terminalMarker);
} else {
  console.error(result.terminalMarker);
}

process.exitCode = result.exitCode;
