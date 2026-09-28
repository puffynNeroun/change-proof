// Final Run03 handoff governs these values. Documentary source: Run 002 report.json.
export const proof = {
  product: 'Mechanical Keyboard',
  subtotal: 5000,
  price: '$50',
  threshold: 5000,
  path: ['Shipping', 'src/shipping/quote.js', 'src/shipping/eligibility.js', 'qualifiesForFreeShipping()'],
  base: { revision: '9bc771b46566d474642aaf29e8f2323320cbfde6', operator: '>', result: false },
  head: { revision: '3daeb8c7efd5c1a6e1df5c04370b7c55b1879ebd', operator: '>=', result: true },
  selectedTest: {
    id: 'selected-head-checkout-threshold',
    path: 'test/checkout.test.js',
    name: 'checkout grants free shipping exactly at the threshold',
    origin: 'HEAD', input: 5000, expected: true,
  },
  verdict: 'THE SELECTED TEST\nCATCHES THE CHANGE',
  supporting: 'SELECTED TEST · HEAD PASS · BASE ASSERTION FAILURE',
  scope: 'The explicitly selected changed regression test distinguished the exact recorded BASE behavior from current HEAD behavior at this selected boundary case.',
} as const;

export const outcomes = [
  { id: 'A', implementation: 'BASE', tests: 'BASE tests', result: 'PASS', revision: proof.base.revision },
  { id: 'B', implementation: 'HEAD', tests: 'HEAD tests', result: 'PASS', revision: proof.head.revision },
  { id: 'C', implementation: 'EXACT BASE', tests: 'SELECTED HEAD test', result: 'TEST_ASSERTION_FAILURE', revision: proof.base.revision, expected: true, actual: false },
] as const;
export type EvidenceId = typeof outcomes[number]['id'];
export const booleanLabel = (value: boolean) => value ? 'TRUE' : 'FALSE';
