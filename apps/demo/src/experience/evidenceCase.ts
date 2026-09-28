export interface EvidenceCase {
  id: string;
  change: {
    area: string;
    boundary: number;
    baseOperator: string;
    headOperator: string;
  };
  base: {
    revision: string;
    implementationPath: string;
    observed: boolean;
  };
  head: {
    revision: string;
    implementationPath: string;
    observed: boolean;
  };
  test: {
    path: string;
    input: number;
    expected: boolean;
  };
  verdict: {
    catchesChange: boolean;
  };
}

export const shippingEvidence: EvidenceCase = {
  id: 'shipping-boundary-5000',
  change: {
    area: 'Shipping',
    boundary: 5000,
    baseOperator: '>',
    headOperator: '>=',
  },
  base: {
    revision: 'BASE',
    implementationPath: 'src/shipping/eligibility.js',
    observed: false,
  },
  head: {
    revision: 'HEAD',
    implementationPath: 'src/shipping/eligibility.js',
    observed: true,
  },
  test: {
    path: 'test/checkout.test.js',
    input: 5000,
    expected: true,
  },
  verdict: {
    catchesChange: true,
  },
};

export const evidenceBoolean = (value: boolean) => String(value);

export const implementationExpression = (
  evidence: EvidenceCase,
  revision: 'base' | 'head',
) => `subtotalCents ${evidence.change[revision === 'base' ? 'baseOperator' : 'headOperator']} FREE_SHIPPING_THRESHOLD_CENTS`;
