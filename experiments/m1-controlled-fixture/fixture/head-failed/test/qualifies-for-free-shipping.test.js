import test from "node:test";
import assert from "node:assert/strict";

import { qualifiesForFreeShipping } from "../src/qualifies-for-free-shipping.js";

test("rejects a subtotal below the threshold", () => {
  assert.equal(qualifiesForFreeShipping(49), false);
});

test("allows free shipping above the threshold", () => {
  assert.equal(qualifiesForFreeShipping(51), true);
});

test("allows free shipping at the exact threshold", () => {
  assert.equal(qualifiesForFreeShipping(50), true);
});
