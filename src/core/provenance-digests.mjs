import {
  createHash,
} from "node:crypto";

const SHA256_HEX_PATTERN =
  /^[0-9a-f]{64}$/;

const GENERIC_ASSERTION_FRAGMENT_PATTERNS =
  Object.freeze([
    /^code:\s*['"]ERR_ASSERTION['"]$/,
    /^operator:\s*['"][^'"]+['"]$/,
    /^failureType:\s*['"][^'"]+['"]$/,
  ]);

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function fail(code) {
  throw new Error(code);
}

function requireRecord(name, value) {
  if (!isRecord(value)) {
    fail(`invalid_provenance_record:${name}`);
  }

  return value;
}

function requireExactKeys(
  name,
  value,
  requiredKeys,
  optionalKeys = [],
) {
  const record =
    requireRecord(name, value);

  const allowed =
    new Set([
      ...requiredKeys,
      ...optionalKeys,
    ]);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail(
        `unknown_provenance_field:${name}.${key}`,
      );
    }
  }

  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) {
      fail(
        `missing_provenance_field:${name}.${key}`,
      );
    }
  }

  return record;
}

function requireString(name, value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    fail(`invalid_provenance_string:${name}`);
  }

  return value;
}

function requireStringArray(
  name,
  value,
  {
    nonEmpty = false,
    unique = false,
    allowEmptyItems = false,
  } = {},
) {
  if (
    !Array.isArray(value) ||
    (nonEmpty && value.length === 0)
  ) {
    fail(`invalid_provenance_string_array:${name}`);
  }

  const normalized =
    value.map((item) => {
      if (
        typeof item !== "string" ||
        item.includes("\0") ||
        (!allowEmptyItems && item.length === 0)
      ) {
        fail(
          `invalid_provenance_string_array:${name}`,
        );
      }

      return item;
    });

  if (
    unique &&
    new Set(normalized).size !==
      normalized.length
  ) {
    fail(`duplicate_provenance_string:${name}`);
  }

  return normalized;
}

function requirePositiveInteger(name, value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    fail(`invalid_provenance_integer:${name}`);
  }

  return value;
}

function requireSha256(name, value) {
  if (
    typeof value !== "string" ||
    !SHA256_HEX_PATTERN.test(value)
  ) {
    fail(`invalid_provenance_sha256:${name}`);
  }

  return value;
}

function compareUnicodeCodePoints(
  left,
  right,
) {
  const leftPoints = Array.from(
    left,
    (character) =>
      character.codePointAt(0),
  );
  const rightPoints = Array.from(
    right,
    (character) =>
      character.codePointAt(0),
  );

  const count =
    Math.min(
      leftPoints.length,
      rightPoints.length,
    );

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    if (
      leftPoints[index] <
      rightPoints[index]
    ) {
      return -1;
    }

    if (
      leftPoints[index] >
      rightPoints[index]
    ) {
      return 1;
    }
  }

  if (
    leftPoints.length <
    rightPoints.length
  ) {
    return -1;
  }

  if (
    leftPoints.length >
    rightPoints.length
  ) {
    return 1;
  }

  return 0;
}

function assertCanonicalJsonValue(
  value,
  path,
  ancestors = new Set(),
) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      fail(
        `non_canonical_json_number:${path}`,
      );
    }

    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    fail(
      `non_canonical_json_value:${path}`,
    );
  }

  if (ancestors.has(value)) {
    fail(`cyclic_canonical_json:${path}`);
  }

  ancestors.add(value);

  if (Array.isArray(value)) {
    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      assertCanonicalJsonValue(
        value[index],
        `${path}[${index}]`,
        ancestors,
      );
    }

    ancestors.delete(value);
    return;
  }

  const prototype =
    Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    ancestors.delete(value);
    fail(
      `non_plain_canonical_json_object:${path}`,
    );
  }

  for (const [key, nested] of
    Object.entries(value)) {
    if (
      key.length === 0 ||
      key.includes("\0")
    ) {
      ancestors.delete(value);
      fail(
        `invalid_canonical_json_key:${path}`,
      );
    }

    assertCanonicalJsonValue(
      nested,
      `${path}.${key}`,
      ancestors,
    );
  }

  ancestors.delete(value);
}

function serializeCanonicalValue(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Object.is(value, -0)
      ? "0"
      : String(value);
  }

  if (Array.isArray(value)) {
    return (
      "[" +
      value
        .map((item) =>
          serializeCanonicalValue(item))
        .join(",") +
      "]"
    );
  }

  const keys =
    Object.keys(value)
      .sort(compareUnicodeCodePoints);

  return (
    "{" +
    keys
      .map((key) =>
        `${JSON.stringify(key)}:` +
        serializeCanonicalValue(
          value[key],
        ))
      .join(",") +
    "}"
  );
}

/**
 * Serializes the strict Change Proof provenance JSON subset.
 *
 * Object keys are sorted by Unicode code-point order.
 * Array order is preserved.
 * No insignificant whitespace is emitted.
 */
export function canonicalSerialize(
  value,
) {
  assertCanonicalJsonValue(
    value,
    "$",
  );

  return serializeCanonicalValue(value);
}

/**
 * Returns a lowercase SHA-256 hex digest of UTF-8 text.
 */
export function sha256Hex(
  text,
) {
  if (typeof text !== "string") {
    fail("invalid_sha256_text");
  }

  return createHash("sha256")
    .update(text, "utf8")
    .digest("hex");
}

function digestCanonical(value) {
  return sha256Hex(
    canonicalSerialize(value),
  );
}

function normalizeEnvironment(value) {
  const environment =
    requireRecord(
      "executionContract.environment",
      value,
    );

  const normalized = {};

  for (const key of Object.keys(
    environment,
  )) {
    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0")
    ) {
      fail(
        "invalid_execution_environment_key",
      );
    }

    const environmentValue =
      environment[key];

    if (
      typeof environmentValue !== "string" ||
      environmentValue.includes("\0")
    ) {
      fail(
        "invalid_execution_environment_value",
      );
    }

    normalized[key] =
      environmentValue;
  }

  return normalized;
}

/**
 * Hashes the exact execution contract.
 *
 * arguments are intentionally order-sensitive.
 * environment object key order is not significant,
 * while environment values are identity-bearing.
 */
export function computeExecutionContractSha256(
  input,
) {
  const contract =
    requireExactKeys(
      "executionContract",
      input,
      [
        "executable",
        "arguments",
        "workingDirectory",
        "environment",
        "timeoutMs",
        "maxStdoutBytes",
        "maxStderrBytes",
      ],
    );

  const normalized = {
    executable:
      requireString(
        "executionContract.executable",
        contract.executable,
      ),

    arguments:
      requireStringArray(
        "executionContract.arguments",
        contract.arguments,
        {
          allowEmptyItems: true,
        },
      ),

    workingDirectory:
      requireString(
        "executionContract.workingDirectory",
        contract.workingDirectory,
      ),

    environment:
      normalizeEnvironment(
        contract.environment,
      ),

    timeoutMs:
      requirePositiveInteger(
        "executionContract.timeoutMs",
        contract.timeoutMs,
      ),

    maxStdoutBytes:
      requirePositiveInteger(
        "executionContract.maxStdoutBytes",
        contract.maxStdoutBytes,
      ),

    maxStderrBytes:
      requirePositiveInteger(
        "executionContract.maxStderrBytes",
        contract.maxStderrBytes,
      ),
  };

  return digestCanonical(normalized);
}

/**
 * Binds provenance to the concrete repository execution location.
 *
 * These values are expected to be resolved/validated by later I/O layers.
 * This pure primitive only hashes their semantic identities.
 */
export function computeRepositoryContextSha256(
  input,
) {
  const context =
    requireExactKeys(
      "repositoryContext",
      input,
      [
        "repositoryRootRealpath",
        "gitCommonDirRealpath",
      ],
    );

  return digestCanonical({
    repositoryRootRealpath:
      requireString(
        "repositoryContext.repositoryRootRealpath",
        context.repositoryRootRealpath,
      ),

    gitCommonDirRealpath:
      requireString(
        "repositoryContext.gitCommonDirRealpath",
        context.gitCommonDirRealpath,
      ),
  });
}

/**
 * Hashes an explicit envelope as a mathematical set of unique paths.
 */
export function computeEnvelopeSha256(
  input,
) {
  const envelope =
    requireExactKeys(
      "envelope",
      input,
      ["includedPaths"],
    );

  const includedPaths =
    requireStringArray(
      "envelope.includedPaths",
      envelope.includedPaths,
      {
        nonEmpty: true,
        unique: true,
      },
    )
      .sort(compareUnicodeCodePoints);

  return digestCanonical({
    includedPaths,
  });
}

function isGenericAssertionFragment(
  fragment,
) {
  return GENERIC_ASSERTION_FRAGMENT_PATTERNS
    .some((pattern) =>
      pattern.test(fragment));
}

function normalizeFailureSpecificFragments(
  value,
) {
  const fragments =
    requireStringArray(
      "candidateFailure.failureSpecificFragments",
      value,
      {
        nonEmpty: true,
        unique: true,
      },
    );

  if (
    fragments.some(
      isGenericAssertionFragment,
    )
  ) {
    fail(
      "generic_fragment_not_failure_specific",
    );
  }

  return fragments
    .sort(compareUnicodeCodePoints);
}

function normalizeSupplementaryFragments(
  value,
) {
  return requireStringArray(
    "candidateFailure.supplementaryFragments",
    value,
    {
      unique: true,
    },
  )
    .sort(compareUnicodeCodePoints);
}

/**
 * Derives a deterministic identity for one failed leaf.
 *
 * At least one failure-specific semantic fragment is mandatory.
 * ERR_ASSERTION/failureType/operator-only evidence is structurally
 * insufficient and cannot be mislabeled as failure-specific evidence.
 */
export function computeCandidateFailureId(
  input,
) {
  const failure =
    requireExactKeys(
      "candidateFailure",
      input,
      [
        "testName",
        "failureSpecificFragments",
      ],
      [
        "supplementaryFragments",
      ],
    );

  const failureSpecificFragments =
    normalizeFailureSpecificFragments(
      failure.failureSpecificFragments,
    );

  const supplementaryFragments =
    normalizeSupplementaryFragments(
      failure.supplementaryFragments ?? [],
    );

  const candidateOutputFragments =
    [
      ...new Set([
        ...failureSpecificFragments,
        ...supplementaryFragments,
      ]),
    ]
      .sort(compareUnicodeCodePoints);

  const digest =
    digestCanonical({
      kind:
        "node-test-assertion-leaf",

      testName:
        requireString(
          "candidateFailure.testName",
          failure.testName,
        ),

      candidateOutputFragments,
    });

  return `cpf_${digest}`;
}

function normalizeOutputIncludes(
  name,
  value,
) {
  return requireStringArray(
    name,
    value,
    {
      nonEmpty: true,
      unique: true,
    },
  )
    .sort(compareUnicodeCodePoints);
}

/**
 * Hashes the entire exact expected-failure contract.
 *
 * Failure ordering and outputIncludes ordering are non-semantic.
 * Duplicate test names are invalid.
 */
export function computeFailureSetSha256(
  input,
) {
  if (
    !Array.isArray(input) ||
    input.length === 0
  ) {
    fail("invalid_failure_set");
  }

  const failures =
    input.map(
      (item, index) => {
        const failure =
          requireExactKeys(
            `failureSet[${index}]`,
            item,
            [
              "testName",
              "outputIncludes",
            ],
          );

        return {
          testName:
            requireString(
              `failureSet[${index}].testName`,
              failure.testName,
            ),

          outputIncludes:
            normalizeOutputIncludes(
              `failureSet[${index}].outputIncludes`,
              failure.outputIncludes,
            ),
        };
      },
    );

  const names =
    failures.map(
      (failure) =>
        failure.testName,
    );

  if (
    new Set(names).size !==
    names.length
  ) {
    fail(
      "duplicate_failure_set_test_name",
    );
  }

  failures.sort(
    (left, right) =>
      compareUnicodeCodePoints(
        left.testName,
        right.testName,
      ),
  );

  return digestCanonical({
    expectedFailures: failures,
  });
}

/**
 * Computes candidateSha256 over immutable candidate.identity only.
 *
 * candidateSha256 is not part of the hashed payload.
 * metadata is intentionally excluded and may contain timestamps,
 * durations and other non-semantic operational information.
 *
 * repositoryContextSha256 is mandatory in candidate identity.
 */
export function computeCandidateSha256(
  candidate,
) {
  const value =
    requireExactKeys(
      "candidate",
      candidate,
      ["identity"],
      ["metadata"],
    );

  const identity =
    requireRecord(
      "candidate.identity",
      value.identity,
    );

  if (
    !Object.hasOwn(
      identity,
      "repositoryContextSha256",
    )
  ) {
    fail(
      "missing_candidate_repository_context",
    );
  }

  requireSha256(
    "candidate.identity.repositoryContextSha256",
    identity.repositoryContextSha256,
  );

  return digestCanonical(identity);
}
