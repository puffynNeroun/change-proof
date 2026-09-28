import { evidenceBoolean, type EvidenceCase } from './evidenceCase';
import { EvidenceToken } from './EvidenceToken';
import { reached, type Presentation } from './presentation';

export function ProcessDiagram({ evidence, state }: { evidence: EvidenceCase; state: Presentation }) {
  const { phase, replayEvent } = state;
  const shippingTest = phase === 'shippingTransition' && state.shippingStep === 'test';
  const head = ['headObservation', 'selectedTest', 'baseReplay', 'mismatch', 'verdict', 'proofPacket'].includes(phase);
  const tokenVisible = shippingTest || head;
  const baseObserved = reached(replayEvent, 'observed');
  const comparison = reached(replayEvent, 'comparing');
  const compared = reached(replayEvent, 'compared');
  const localized = reached(replayEvent, 'localized');
  const named = reached(replayEvent, 'named');
  const packet = phase === 'proofPacket';
  const verdict = phase === 'verdict' || packet;

  return <div className="cp-v8-diagram" data-token-position={packet ? 'record' : verdict ? 'record-preview' : reached(replayEvent, 'registered') ? 'base' : reached(replayEvent, 'transferring') ? 'transferring' : 'head'}>
    <section className="cp-v8-change" aria-label="Recorded change">
      <h3>Recorded change</h3>
      <div className="cp-v8-change__pair">
        <div><span>Earlier / {evidence.base.revision}</span><strong>{evidence.change.baseOperator} {evidence.change.boundary}</strong></div>
        <span className="cp-v8-change__arrow" aria-hidden="true">→</span>
        <div><span>Current / {evidence.head.revision}</span><strong>{evidence.change.headOperator} {evidence.change.boundary}</strong></div>
      </div>
      <p>The current condition includes the boundary itself.</p>
    </section>

    <section className="cp-v8-head" aria-label="Current revision observation">
      <h3>Current / {evidence.head.revision}</h3>
      <div className="cp-v8-result" data-observed={head}>
        <strong>{head ? evidenceBoolean(evidence.head.observed) : 'Not observed'}</strong>
        {packet && <span>Matches expected {evidenceBoolean(evidence.test.expected)}</span>}
      </div>
    </section>

    {packet && <h3 className="cp-v8-observations-title">Observations at {evidence.test.input}</h3>}

    <section className="cp-v8-test" aria-label="Selected test"><h3>Selected test</h3></section>
    <EvidenceToken evidence={evidence} visible={tokenVisible} selected={phase === 'selectedTest'} />

    <section className="cp-v8-base" aria-label="Earlier revision observation">
      <h3>Earlier / {evidence.base.revision}</h3>
      <div className="cp-v8-result" data-observed={baseObserved || verdict} data-localized={localized || verdict}>
        <strong>{baseObserved || verdict ? evidenceBoolean(evidence.base.observed) : reached(replayEvent, 'evaluating') ? `Evaluating ${evidence.test.input}` : 'Not replayed'}</strong>
        {packet && <span>Does not match expected {evidenceBoolean(evidence.test.expected)}</span>}
      </div>
    </section>

    <div className="cp-v8-dock cp-v8-dock--head" aria-hidden="true" />
    <div className="cp-v8-dock cp-v8-dock--base" aria-hidden="true" />
    <svg className="cp-v8-geometry" viewBox="0 0 496 832" preserveAspectRatio="none" aria-hidden="true">
      {reached(replayEvent, 'released') && !verdict && <path className="cp-v8-transfer-route" d="M 32 358 H 22 V 566 H 32" />}
      {comparison && !verdict && <path className="cp-v8-comparison-route" d="M 448 250 H 460 V 650 H 448 M 448 458 H 460" />}
      {localized && !verdict && <path className="cp-v8-mismatch-route" d="M 448 458 H 460" />}
    </svg>

    {compared && !verdict && <section className="cp-v8-comparison" aria-label="Comparison at the shared input">
      <h3>At {evidence.test.input}</h3>
      <div><span>Current / HEAD</span><strong>{evidenceBoolean(evidence.head.observed)}</strong></div>
      <div><span>Earlier / BASE</span><strong data-localized={localized}>{evidenceBoolean(evidence.base.observed)}</strong></div>
      {localized && <p>{evidenceBoolean(evidence.base.observed)} ≠ expected {evidenceBoolean(evidence.test.expected)}</p>}
      {named && <p className="cp-v8-comparison__name">Mismatch · BASE does not match the test's expectation.</p>}
    </section>}
    {verdict && <section className="cp-v8-resolution"><h3>Verdict</h3><strong>The selected test catches the recorded boundary change.</strong></section>}
    {!packet && <p className="cp-v8-process-state">{verdict ? 'Test catches this change' : named ? 'Mismatch' : comparison ? 'Comparing observations' : baseObserved ? 'BASE observation recorded' : reached(replayEvent, 'evaluating') ? 'Evaluating the earlier condition' : reached(replayEvent, 'registered') ? 'Earlier revision registered' : phase === 'selectedTest' ? 'Ready to replay on BASE' : head ? 'HEAD observation recorded' : 'Preparing trace'}</p>}
  </div>;
}
