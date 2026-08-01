import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDARY_REASON_CODES,
  evaluateBoundary,
} from "../../src/core/evaluate-boundary.mjs";

function createInput() {
  const sourcePath =
    "src/example.js";

  const selectedTestPath =
    "test/example.test.js";

  return {
    baseSha: "base-sha",
    stateCBaseSha: "base-sha",

    includedPaths: [
      selectedTestPath,
    ],

    headChangedPaths: [
      sourcePath,
      selectedTestPath,
    ],

    materializedPaths: [
      selectedTestPath,
    ],

    resultingChangedPaths: [
      selectedTestPath,
    ],

    baseBlobIds: {
      [sourcePath]:
        "base-source-blob",

      [selectedTestPath]:
        "base-test-blob",
    },

    headBlobIds: {
      [sourcePath]:
        "head-source-blob",

      [selectedTestPath]:
        "head-test-blob",
    },

    stateCBlobIds: {
      [sourcePath]:
        "base-source-blob",

      [selectedTestPath]:
        "head-test-blob",
    },
  };
}

test(
  "accepts a valid explicit State C boundary",
  () => {
    const evidence =
      evaluateBoundary(createInput());

    assert.deepEqual(evidence, {
      basedOnBase: true,
      selectedPathsMatchHead: true,
      unchangedPathsMatchBase: true,

      resultingChangedPaths: [
        "test/example.test.js",
      ],

      boundaryValid: true,
      reasonCodes: [],
    });
  },
);

test(
  "canonicalizes path ordering deterministically",
  () => {
    const input = createInput();

    input.includedPaths = [
      "test/z.test.js",
      "test/a.test.js",
    ];

    input.headChangedPaths = [
      "test/z.test.js",
      "src/example.js",
      "test/a.test.js",
    ];

    input.materializedPaths = [
      "test/a.test.js",
      "test/z.test.js",
    ];

    input.resultingChangedPaths = [
      "test/z.test.js",
      "test/a.test.js",
    ];

    input.baseBlobIds = {
      "src/example.js":
        "base-source",
    };

    input.headBlobIds = {
      "src/example.js":
        "head-source",

      "test/a.test.js":
        "head-a",

      "test/z.test.js":
        "head-z",
    };

    input.stateCBlobIds = {
      "src/example.js":
        "base-source",

      "test/a.test.js":
        "head-a",

      "test/z.test.js":
        "head-z",
    };

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      true,
    );

    assert.deepEqual(
      evidence.resultingChangedPaths,
      [
        "test/a.test.js",
        "test/z.test.js",
      ],
    );
  },
);

test(
  "rejects State C that is not based on exact base",
  () => {
    const input = createInput();

    input.stateCBaseSha =
      "different-base";

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.basedOnBase,
      false,
    );

    assert.equal(
      evidence.boundaryValid,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .STATE_C_NOT_BASED_ON_BASE,
      ],
    );
  },
);

test(
  "rejects an included path absent from the head change set",
  () => {
    const input = createInput();

    input.headChangedPaths = [
      "src/example.js",
    ];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .INCLUDED_PATH_NOT_CHANGED_IN_HEAD,
      ],
    );
  },
);

test(
  "rejects a missing materialized envelope path",
  () => {
    const input = createInput();

    input.materializedPaths = [];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .MATERIALIZED_PATHS_MISMATCH,
      ],
    );
  },
);

test(
  "rejects an extra materialized path",
  () => {
    const input = createInput();

    input.materializedPaths.push(
      "src/example.js",
    );

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .MATERIALIZED_PATHS_MISMATCH,
      ],
    );
  },
);

test(
  "rejects a missing resulting changed path",
  () => {
    const input = createInput();

    input.resultingChangedPaths = [];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .RESULTING_CHANGED_PATHS_MISMATCH,
      ],
    );
  },
);

test(
  "rejects an extra resulting changed path",
  () => {
    const input = createInput();

    input.resultingChangedPaths.push(
      "src/example.js",
    );

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .RESULTING_CHANGED_PATHS_MISMATCH,
      ],
    );
  },
);

test(
  "rejects a selected path with no head blob identity",
  () => {
    const input = createInput();

    delete input.headBlobIds[
      "test/example.test.js"
    ];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.selectedPathsMatchHead,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_HEAD_BLOB,
      ],
    );
  },
);

test(
  "rejects a selected path with no State C blob identity",
  () => {
    const input = createInput();

    delete input.stateCBlobIds[
      "test/example.test.js"
    ];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.selectedPathsMatchHead,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_STATE_C_BLOB,
      ],
    );
  },
);

test(
  "rejects a selected path that does not match head",
  () => {
    const input = createInput();

    input.stateCBlobIds[
      "test/example.test.js"
    ] = "wrong-test-blob";

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.selectedPathsMatchHead,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_NOT_MATCH_HEAD,
      ],
    );
  },
);

test(
  "rejects an excluded changed path with no base blob identity",
  () => {
    const input = createInput();

    delete input.baseBlobIds[
      "src/example.js"
    ];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.unchangedPathsMatchBase,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_BASE_BLOB,
      ],
    );
  },
);

test(
  "rejects an excluded changed path with no State C blob identity",
  () => {
    const input = createInput();

    delete input.stateCBlobIds[
      "src/example.js"
    ];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.unchangedPathsMatchBase,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_STATE_C_BLOB,
      ],
    );
  },
);

test(
  "rejects an excluded changed path that differs from base",
  () => {
    const input = createInput();

    input.stateCBlobIds[
      "src/example.js"
    ] = "head-source-blob";

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.unchangedPathsMatchBase,
      false,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_NOT_MATCH_BASE,
      ],
    );
  },
);

test(
  "accumulates failure reasons in stable precedence order",
  () => {
    const input = createInput();

    input.stateCBaseSha =
      "wrong-base";

    input.headChangedPaths = [
      "src/example.js",
    ];

    input.materializedPaths = [];
    input.resultingChangedPaths = [];

    delete input.headBlobIds[
      "test/example.test.js"
    ];

    delete input.stateCBlobIds[
      "test/example.test.js"
    ];

    delete input.baseBlobIds[
      "src/example.js"
    ];

    delete input.stateCBlobIds[
      "src/example.js"
    ];

    const evidence =
      evaluateBoundary(input);

    assert.deepEqual(
      evidence.reasonCodes,
      [
        BOUNDARY_REASON_CODES
          .STATE_C_NOT_BASED_ON_BASE,

        BOUNDARY_REASON_CODES
          .INCLUDED_PATH_NOT_CHANGED_IN_HEAD,

        BOUNDARY_REASON_CODES
          .MATERIALIZED_PATHS_MISMATCH,

        BOUNDARY_REASON_CODES
          .RESULTING_CHANGED_PATHS_MISMATCH,

        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_HEAD_BLOB,

        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_STATE_C_BLOB,

        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_BASE_BLOB,

        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_STATE_C_BLOB,
      ],
    );
  },
);

test(
  "validates required SHA strings",
  () => {
    for (const name of [
      "baseSha",
      "stateCBaseSha",
    ]) {
      const input = createInput();

      input[name] = "";

      assert.throws(
        () => evaluateBoundary(input),
        {
          message:
            `invalid_boundary_string:${name}`,
        },
      );
    }
  },
);

test(
  "validates every path-array input",
  () => {
    for (const name of [
      "includedPaths",
      "headChangedPaths",
      "materializedPaths",
      "resultingChangedPaths",
    ]) {
      const input = createInput();

      input[name] = null;

      assert.throws(
        () => evaluateBoundary(input),
        {
          message:
            "invalid_boundary_path_array:" +
            name,
        },
      );
    }
  },
);

test(
  "rejects an empty explicit envelope",
  () => {
    const input = createInput();

    input.includedPaths = [];

    assert.throws(
      () => evaluateBoundary(input),
      {
        message:
          "empty_boundary_path_array:" +
          "includedPaths",
      },
    );
  },
);

test(
  "rejects duplicate paths in every path array",
  () => {
    for (const name of [
      "includedPaths",
      "headChangedPaths",
      "materializedPaths",
      "resultingChangedPaths",
    ]) {
      const input = createInput();

      input[name] = [
        "duplicate.js",
        "duplicate.js",
      ];

      assert.throws(
        () => evaluateBoundary(input),
        {
          message:
            "duplicate_boundary_path:" +
            `${name}:duplicate.js`,
        },
      );
    }
  },
);

test(
  "validates every blob-map input",
  () => {
    for (const name of [
      "baseBlobIds",
      "headBlobIds",
      "stateCBlobIds",
    ]) {
      const input = createInput();

      input[name] = null;

      assert.throws(
        () => evaluateBoundary(input),
        {
          message:
            "invalid_boundary_blob_map:" +
            name,
        },
      );
    }
  },
);

test(
  "validates blob identity values",
  () => {
    for (const name of [
      "baseBlobIds",
      "headBlobIds",
      "stateCBlobIds",
    ]) {
      const input = createInput();

      input[name][
        "src/example.js"
      ] = 42;

      assert.throws(
        () => evaluateBoundary(input),
        {
          message:
            "invalid_boundary_blob_identity:" +
            `${name}:src/example.js`,
        },
      );
    }
  },
);

test(
  "accepts deeply frozen input without mutation",
  () => {
    const input = createInput();

    Object.freeze(input.includedPaths);
    Object.freeze(input.headChangedPaths);
    Object.freeze(input.materializedPaths);
    Object.freeze(
      input.resultingChangedPaths,
    );

    Object.freeze(input.baseBlobIds);
    Object.freeze(input.headBlobIds);
    Object.freeze(input.stateCBlobIds);
    Object.freeze(input);

    const before =
      JSON.stringify(input);

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      true,
    );

    assert.equal(
      JSON.stringify(input),
      before,
    );
  },
);

test(
  "is deterministic for identical boundary evidence",
  () => {
    const input = createInput();

    const expected =
      evaluateBoundary(input);

    for (
      let index = 0;
      index < 100;
      index += 1
    ) {
      assert.deepEqual(
        evaluateBoundary(input),
        expected,
      );
    }
  },
);

test(
  "returns independent result arrays",
  () => {
    const input = createInput();

    const first =
      evaluateBoundary(input);

    const second =
      evaluateBoundary(input);

    assert.notEqual(first, second);

    assert.notEqual(
      first.resultingChangedPaths,
      second.resultingChangedPaths,
    );

    assert.notEqual(
      first.reasonCodes,
      second.reasonCodes,
    );

    assert.deepEqual(first, second);
  },
);

test(
  "supports null blob identities for additions and deletions",
  () => {
    const input = {
      baseSha: "base",
      stateCBaseSha: "base",

      includedPaths: [
        "src/new.js",
      ],

      headChangedPaths: [
        "src/new.js",
        "src/old.js",
      ],

      materializedPaths: [
        "src/new.js",
      ],

      resultingChangedPaths: [
        "src/new.js",
      ],

      baseBlobIds: {
        "src/new.js": null,
        "src/old.js": "base-old",
      },

      headBlobIds: {
        "src/new.js": "head-new",
        "src/old.js": null,
      },

      stateCBlobIds: {
        "src/new.js": "head-new",
        "src/old.js": "base-old",
      },
    };

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.boundaryValid,
      true,
    );

    assert.deepEqual(
      evidence.reasonCodes,
      [],
    );
  },
);

test(
  "treats an empty excluded-path set as unchanged",
  () => {
    const input = createInput();

    input.headChangedPaths = [
      "test/example.test.js",
    ];

    delete input.baseBlobIds[
      "src/example.js"
    ];

    delete input.headBlobIds[
      "src/example.js"
    ];

    delete input.stateCBlobIds[
      "src/example.js"
    ];

    const evidence =
      evaluateBoundary(input);

    assert.equal(
      evidence.unchangedPathsMatchBase,
      true,
    );

    assert.equal(
      evidence.boundaryValid,
      true,
    );
  },
);
