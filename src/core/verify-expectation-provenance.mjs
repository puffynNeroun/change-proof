import {
  computeEnvelopeSha256,
  computeExecutionContractSha256,
  computeFailureSetSha256,
  computeRepositoryContextSha256,
} from "./provenance-digests.mjs";

const SHA256_PATTERN =
  /^[0-9a-f]{64}$/u;

export class ExpectationProvenanceError
  extends Error {
  constructor(code, field = null) {
    super(
      field === null
        ? code
        : `${code}:${field}`,
    );

    this.name =
      "ExpectationProvenanceError";

    this.code = code;
    this.field = field;
  }
}

function failInvalid(field) {
  throw new ExpectationProvenanceError(
    "EXPECTATION_PROVENANCE_INVALID",
    field,
  );
}

function failMismatch(field) {
  throw new ExpectationProvenanceError(
    "EXPECTATION_PROVENANCE_MISMATCH",
    field,
  );
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireExactObject(
  value,
  keys,
  field,
) {
  if (!isRecord(value)) {
    failInvalid(field);
  }

  const expected =
    [...keys].sort();

  const actual =
    Object.keys(value).sort();

  if (
    expected.length !== actual.length ||
    expected.some(
      (key, index) =>
        key !== actual[index],
    )
  ) {
    failInvalid(field);
  }

  return value;
}

function requireString(
  value,
  field,
) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    failInvalid(field);
  }

  return value;
}

function requireSha256(
  value,
  field,
) {
  if (
    typeof value !== "string" ||
    !SHA256_PATTERN.test(value)
  ) {
    failInvalid(field);
  }

  return value;
}

function normalizeProvenance(input) {
  const value =
    requireExactObject(
      input,
      [
        "source",
        "candidateSha256",
        "candidateContractVersion",
        "prepareToolVersion",
        "prepareConfigSha256",
        "repositoryContextSha256",
        "resolvedCommits",
        "executionContractSha256",
        "envelopeSha256",
        "failureSetSha256",
      ],
      "expectationProvenance",
    );

  if (
    value.source !==
      "change-proof.prepare-candidate" ||
    value.candidateContractVersion !==
      "0.1"
  ) {
    failInvalid(
      "expectationProvenance",
    );
  }

  const resolvedCommits =
    requireExactObject(
      value.resolvedCommits,
      ["base", "head"],
      "expectationProvenance.resolvedCommits",
    );

  return {
    source:
      value.source,

    candidateSha256:
      requireSha256(
        value.candidateSha256,
        "candidateSha256",
      ),

    candidateContractVersion:
      value.candidateContractVersion,

    prepareToolVersion:
      requireString(
        value.prepareToolVersion,
        "prepareToolVersion",
      ),

    prepareConfigSha256:
      requireSha256(
        value.prepareConfigSha256,
        "prepareConfigSha256",
      ),

    repositoryContextSha256:
      requireSha256(
        value.repositoryContextSha256,
        "repositoryContextSha256",
      ),

    resolvedCommits: {
      base:
        requireString(
          resolvedCommits.base,
          "resolvedCommits.base",
        ),

      head:
        requireString(
          resolvedCommits.head,
          "resolvedCommits.head",
        ),
    },

    executionContractSha256:
      requireSha256(
        value.executionContractSha256,
        "executionContractSha256",
      ),

    envelopeSha256:
      requireSha256(
        value.envelopeSha256,
        "envelopeSha256",
      ),

    failureSetSha256:
      requireSha256(
        value.failureSetSha256,
        "failureSetSha256",
      ),
  };
}

function requireRuntimeInput(input) {
  if (!isRecord(input)) {
    failInvalid("runtime");
  }

  return input;
}

/**
 * Verifies only provenance facts that can be recomputed from
 * the authoritative runtime context.
 *
 * candidateSha256 and prepareConfigSha256 remain identifiers
 * of the source artifacts; this preflight does not pretend to
 * reconstruct those artifacts from the promoted config.
 */
export function verifyExpectationProvenance(
  input,
) {
  const runtime =
    requireRuntimeInput(input);

  if (
    runtime.expectationProvenance ===
      null ||
    runtime.expectationProvenance ===
      undefined
  ) {
    return {
      required: false,
      verified: false,
    };
  }

  const provenance =
    normalizeProvenance(
      runtime.expectationProvenance,
    );

  const repositoryRootRealpath =
    requireString(
      runtime.repositoryRootRealpath,
      "repositoryRootRealpath",
    );

  const gitCommonDirRealpath =
    requireString(
      runtime.gitCommonDirRealpath,
      "gitCommonDirRealpath",
    );

  const resolvedCommits =
    requireExactObject(
      runtime.resolvedCommits,
      ["base", "head"],
      "resolvedCommits",
    );

  const baseCommit =
    requireString(
      resolvedCommits.base,
      "resolvedCommits.base",
    );

  const headCommit =
    requireString(
      resolvedCommits.head,
      "resolvedCommits.head",
    );

  if (
    provenance.resolvedCommits.base !==
      baseCommit
  ) {
    failMismatch(
      "resolvedCommits.base",
    );
  }

  if (
    provenance.resolvedCommits.head !==
      headCommit
  ) {
    failMismatch(
      "resolvedCommits.head",
    );
  }

  const repositoryContextSha256 =
    computeRepositoryContextSha256({
      repositoryRootRealpath,
      gitCommonDirRealpath,
    });

  if (
    provenance.repositoryContextSha256 !==
      repositoryContextSha256
  ) {
    failMismatch(
      "repositoryContextSha256",
    );
  }

  const executionContractSha256 =
    computeExecutionContractSha256(
      runtime.command,
    );

  if (
    provenance.executionContractSha256 !==
      executionContractSha256
  ) {
    failMismatch(
      "executionContractSha256",
    );
  }

  const envelopeSha256 =
    computeEnvelopeSha256({
      includedPaths:
        runtime.envelope.includedPaths,
    });

  if (
    provenance.envelopeSha256 !==
      envelopeSha256
  ) {
    failMismatch(
      "envelopeSha256",
    );
  }

  const failureSetSha256 =
    computeFailureSetSha256(
      runtime.expectedFailures,
    );

  if (
    provenance.failureSetSha256 !==
      failureSetSha256
  ) {
    failMismatch(
      "failureSetSha256",
    );
  }

  return {
    required: true,
    verified: true,

    candidateSha256:
      provenance.candidateSha256,

    prepareConfigSha256:
      provenance.prepareConfigSha256,
  };
}
