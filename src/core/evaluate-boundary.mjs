export const BOUNDARY_REASON_CODES =
  Object.freeze({
    STATE_C_NOT_BASED_ON_BASE:
      "STATE_C_NOT_BASED_ON_BASE",

    INCLUDED_PATH_NOT_CHANGED_IN_HEAD:
      "INCLUDED_PATH_NOT_CHANGED_IN_HEAD",

    MATERIALIZED_PATHS_MISMATCH:
      "MATERIALIZED_PATHS_MISMATCH",

    RESULTING_CHANGED_PATHS_MISMATCH:
      "RESULTING_CHANGED_PATHS_MISMATCH",

    SELECTED_PATH_MISSING_HEAD_BLOB:
      "SELECTED_PATH_MISSING_HEAD_BLOB",

    SELECTED_PATH_MISSING_STATE_C_BLOB:
      "SELECTED_PATH_MISSING_STATE_C_BLOB",

    SELECTED_PATH_NOT_MATCH_HEAD:
      "SELECTED_PATH_NOT_MATCH_HEAD",

    UNCHANGED_PATH_MISSING_BASE_BLOB:
      "UNCHANGED_PATH_MISSING_BASE_BLOB",

    UNCHANGED_PATH_MISSING_STATE_C_BLOB:
      "UNCHANGED_PATH_MISSING_STATE_C_BLOB",

    UNCHANGED_PATH_NOT_MATCH_BASE:
      "UNCHANGED_PATH_NOT_MATCH_BASE",
  });

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireNonEmptyString(name, value) {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `invalid_boundary_string:${name}`,
    );
  }
}

function normalizePathArray(
  name,
  value,
  {
    requireNonEmpty = false,
  } = {},
) {
  if (!Array.isArray(value)) {
    throw new Error(
      `invalid_boundary_path_array:${name}`,
    );
  }

  if (
    requireNonEmpty &&
    value.length === 0
  ) {
    throw new Error(
      `empty_boundary_path_array:${name}`,
    );
  }

  const seen = new Set();
  const normalized = [];

  for (const path of value) {
    if (
      typeof path !== "string" ||
      path.length === 0 ||
      path.includes("\0")
    ) {
      throw new Error(
        `invalid_boundary_path:${name}`,
      );
    }

    if (seen.has(path)) {
      throw new Error(
        `duplicate_boundary_path:${name}:${path}`,
      );
    }

    seen.add(path);
    normalized.push(path);
  }

  return normalized.sort();
}

function normalizeBlobMap(name, value) {
  if (!isRecord(value)) {
    throw new Error(
      `invalid_boundary_blob_map:${name}`,
    );
  }

  const normalized = {};

  for (
    const path of Object.keys(value).sort()
  ) {
    const identity = value[path];

    if (
      path.length === 0 ||
      path.includes("\0")
    ) {
      throw new Error(
        `invalid_boundary_blob_path:${name}`,
      );
    }

    if (
      identity !== null &&
      (
        typeof identity !== "string" ||
        identity.length === 0
      )
    ) {
      throw new Error(
        "invalid_boundary_blob_identity:" +
        `${name}:${path}`,
      );
    }

    normalized[path] = identity;
  }

  return normalized;
}

function hasOwn(record, path) {
  return Object.prototype.hasOwnProperty.call(
    record,
    path,
  );
}

function samePathSet(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (path, index) =>
      path === right[index],
  );
}

function addReason(
  reasonCodes,
  reasonCodeSet,
  reasonCode,
) {
  if (reasonCodeSet.has(reasonCode)) {
    return;
  }

  reasonCodeSet.add(reasonCode);
  reasonCodes.push(reasonCode);
}

/**
 * Compares already-collected Git identity evidence for State C.
 *
 * The evaluator does not access Git, the filesystem, processes,
 * environment variables, clocks, or fixture-specific paths.
 *
 * Blob identities may be strings or null. A null identity represents
 * a path that is absent in the corresponding tree.
 */
export function evaluateBoundary(input = {}) {
  const {
    baseSha,
    stateCBaseSha,

    includedPaths,
    headChangedPaths,
    materializedPaths,
    resultingChangedPaths,

    baseBlobIds,
    headBlobIds,
    stateCBlobIds,
  } = input;

  requireNonEmptyString(
    "baseSha",
    baseSha,
  );

  requireNonEmptyString(
    "stateCBaseSha",
    stateCBaseSha,
  );

  const normalizedIncludedPaths =
    normalizePathArray(
      "includedPaths",
      includedPaths,
      {
        requireNonEmpty: true,
      },
    );

  const normalizedHeadChangedPaths =
    normalizePathArray(
      "headChangedPaths",
      headChangedPaths,
    );

  const normalizedMaterializedPaths =
    normalizePathArray(
      "materializedPaths",
      materializedPaths,
    );

  const normalizedResultingChangedPaths =
    normalizePathArray(
      "resultingChangedPaths",
      resultingChangedPaths,
    );

  const normalizedBaseBlobIds =
    normalizeBlobMap(
      "baseBlobIds",
      baseBlobIds,
    );

  const normalizedHeadBlobIds =
    normalizeBlobMap(
      "headBlobIds",
      headBlobIds,
    );

  const normalizedStateCBlobIds =
    normalizeBlobMap(
      "stateCBlobIds",
      stateCBlobIds,
    );

  const reasonCodes = [];
  const reasonCodeSet = new Set();

  const basedOnBase =
    stateCBaseSha === baseSha;

  if (!basedOnBase) {
    addReason(
      reasonCodes,
      reasonCodeSet,
      BOUNDARY_REASON_CODES
        .STATE_C_NOT_BASED_ON_BASE,
    );
  }

  const headChangedPathSet =
    new Set(
      normalizedHeadChangedPaths,
    );

  const includedPathsChangedInHead =
    normalizedIncludedPaths.every(
      (path) =>
        headChangedPathSet.has(path),
    );

  if (!includedPathsChangedInHead) {
    addReason(
      reasonCodes,
      reasonCodeSet,
      BOUNDARY_REASON_CODES
        .INCLUDED_PATH_NOT_CHANGED_IN_HEAD,
    );
  }

  const materializedPathsMatchEnvelope =
    samePathSet(
      normalizedMaterializedPaths,
      normalizedIncludedPaths,
    );

  if (!materializedPathsMatchEnvelope) {
    addReason(
      reasonCodes,
      reasonCodeSet,
      BOUNDARY_REASON_CODES
        .MATERIALIZED_PATHS_MISMATCH,
    );
  }

  const resultingChangedPathsMatchEnvelope =
    samePathSet(
      normalizedResultingChangedPaths,
      normalizedIncludedPaths,
    );

  if (!resultingChangedPathsMatchEnvelope) {
    addReason(
      reasonCodes,
      reasonCodeSet,
      BOUNDARY_REASON_CODES
        .RESULTING_CHANGED_PATHS_MISMATCH,
    );
  }

  let selectedPathsMatchHead = true;

  for (
    const path of normalizedIncludedPaths
  ) {
    const hasHeadBlob =
      hasOwn(
        normalizedHeadBlobIds,
        path,
      );

    const hasStateCBlob =
      hasOwn(
        normalizedStateCBlobIds,
        path,
      );

    if (!hasHeadBlob) {
      selectedPathsMatchHead = false;

      addReason(
        reasonCodes,
        reasonCodeSet,
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_HEAD_BLOB,
      );
    }

    if (!hasStateCBlob) {
      selectedPathsMatchHead = false;

      addReason(
        reasonCodes,
        reasonCodeSet,
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_STATE_C_BLOB,
      );
    }

    if (
      hasHeadBlob &&
      hasStateCBlob &&
      normalizedHeadBlobIds[path] !==
        normalizedStateCBlobIds[path]
    ) {
      selectedPathsMatchHead = false;

      addReason(
        reasonCodes,
        reasonCodeSet,
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_NOT_MATCH_HEAD,
      );
    }
  }

  const includedPathSet =
    new Set(
      normalizedIncludedPaths,
    );

  const changedPathsExcludedFromEnvelope =
    normalizedHeadChangedPaths.filter(
      (path) =>
        !includedPathSet.has(path),
    );

  let unchangedPathsMatchBase = true;

  for (
    const path of
      changedPathsExcludedFromEnvelope
  ) {
    const hasBaseBlob =
      hasOwn(
        normalizedBaseBlobIds,
        path,
      );

    const hasStateCBlob =
      hasOwn(
        normalizedStateCBlobIds,
        path,
      );

    if (!hasBaseBlob) {
      unchangedPathsMatchBase = false;

      addReason(
        reasonCodes,
        reasonCodeSet,
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_BASE_BLOB,
      );
    }

    if (!hasStateCBlob) {
      unchangedPathsMatchBase = false;

      addReason(
        reasonCodes,
        reasonCodeSet,
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_STATE_C_BLOB,
      );
    }

    if (
      hasBaseBlob &&
      hasStateCBlob &&
      normalizedBaseBlobIds[path] !==
        normalizedStateCBlobIds[path]
    ) {
      unchangedPathsMatchBase = false;

      addReason(
        reasonCodes,
        reasonCodeSet,
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_NOT_MATCH_BASE,
      );
    }
  }

  const boundaryValid =
    basedOnBase &&
    includedPathsChangedInHead &&
    materializedPathsMatchEnvelope &&
    resultingChangedPathsMatchEnvelope &&
    selectedPathsMatchHead &&
    unchangedPathsMatchBase;

  return {
    basedOnBase,
    selectedPathsMatchHead,
    unchangedPathsMatchBase,

    resultingChangedPaths: [
      ...normalizedResultingChangedPaths,
    ],

    boundaryValid,
    reasonCodes: [
      ...reasonCodes,
    ],
  };
}
