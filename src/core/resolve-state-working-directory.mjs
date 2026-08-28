import {
  realpath,
} from "node:fs/promises";

import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";

function isContained(parent, candidate) {
  const fromParent = relative(parent, candidate);

  return (
    fromParent === "" ||
    (
      fromParent !== ".." &&
      !fromParent.startsWith("../") &&
      !isAbsolute(fromParent)
    )
  );
}

export async function resolveStateWorkingDirectory(
  worktreePath,
  repositoryRelativeDirectory,
) {
  const root = await realpath(worktreePath);
  const candidate = await realpath(resolve(
    root,
    repositoryRelativeDirectory,
  ));

  if (!isContained(root, candidate)) {
    throw new Error(
      "invalid_change_proof_input:command.workingDirectory",
    );
  }

  return candidate;
}
