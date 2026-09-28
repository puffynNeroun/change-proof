import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/tokens.css';
import './styles/proof.css';

const rootElement =
  document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root');
}

const root =
  ReactDOM.createRoot(rootElement);

const params =
  new URLSearchParams(
    window.location.search,
  );

if (params.get('v9lab') === 'capabilities') {
  import('./experience/v9-lab/CapabilitiesCalibration').then(
    ({ CapabilitiesCalibration }) => {
      root.render(
        <React.StrictMode>
          <CapabilitiesCalibration />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('v9lab') === 'evidence-trace') {
  import('./experience/v9-lab/EvidenceTraceCalibration').then(
    ({ EvidenceTraceCalibration }) => {
      root.render(
        <React.StrictMode>
          <EvidenceTraceCalibration />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('v9lab') === 'motion-proof') {
  import('./experience/v9-lab/MotionProofCalibration').then(
    ({ MotionProofCalibration }) => {
      root.render(
        <React.StrictMode>
          <MotionProofCalibration />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('v9lab') === 'head') {
  import('./experience/v9-lab/HeadCalibration').then(
    ({ HeadCalibration }) => {
      root.render(
        <React.StrictMode>
          <HeadCalibration />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('v9lab') === 'orientation' || params.get('v9lab') === 'trace') {
  import('./experience/v9-lab/OpeningCalibration').then(
    ({ OpeningCalibration }) => {
      root.render(
        <React.StrictMode>
          <OpeningCalibration state={params.get('v9lab') === 'trace' ? 'trace' : 'orientation'} />
        </React.StrictMode>,
      );
    },
  );
} else if (['selected-test', 'base', 'mismatch', 'verdict'].includes(params.get('v9lab') ?? '')) {
  import('./experience/v9-lab/ProofSequenceCalibration').then(
    ({ ProofSequenceCalibration }) => {
      const state = params.get('v9lab') as 'selected-test' | 'base' | 'mismatch' | 'verdict';
      root.render(
        <React.StrictMode>
          <ProofSequenceCalibration state={state} />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('v9lab') === 'packet') {
  import('./experience/v9-lab/ProofPacketCalibration').then(
    ({ ProofPacketCalibration }) => {
      root.render(
        <React.StrictMode>
          <ProofPacketCalibration />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('experience') === '1') {
  import(
    './experience/ExperiencePrototype'
  ).then(
    ({ ExperiencePrototype }) => {
      root.render(
        <React.StrictMode>
          <ExperiencePrototype />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('shipping') === '1') {
  import(
    './spike/shipping-v2/ShippingV2Spike'
  ).then(
    ({ ShippingV2Spike }) => {
      root.render(
        <React.StrictMode>
          <ShippingV2Spike />
        </React.StrictMode>,
      );
    },
  );
} else if (params.get('webgl') === '1') {
  import('./spike/WebGLSpike').then(
    ({ WebGLSpike }) => {
      root.render(
        <React.StrictMode>
          <WebGLSpike />
        </React.StrictMode>,
      );
    },
  );
} else {
  import(
    './experience/ExperiencePrototype'
  ).then(
    ({ ExperiencePrototype }) => {
      root.render(
        <React.StrictMode>
          <ExperiencePrototype />
        </React.StrictMode>,
      );
    },
  );
}
