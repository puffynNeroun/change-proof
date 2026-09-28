import { useEffect, useRef, useState } from 'react';
import { implementationExpression, type EvidenceCase } from './evidenceCase';
import { ProcessDiagram } from './ProcessDiagram';
import type { Presentation } from './presentation';

export function ProcessViewer({ evidence, state, onReturn, onReplay }: {
  evidence: EvidenceCase;
  state: Presentation;
  onReturn: () => void;
  onReplay: () => void;
}) {
  const { phase, preparationRow, shippingStep } = state;
  const mode = phase === 'orientation' ? 'preparing' : phase === 'recordedChange' || phase === 'traceReady' ? 'ready' : phase === 'shippingTransition' && shippingStep !== 'test' ? 'shipping' : phase === 'verdict' ? 'verdict' : phase === 'proofPacket' ? 'packet' : 'graph';
  const packet = mode === 'packet';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
  useEffect(() => { if (packet && state.packetSettled) headingRef.current?.focus(); }, [packet, state.packetSettled]);

  async function copyReference() {
    window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(evidence.id);
      setCopyFeedback('copied');
    } catch {
      setCopyFeedback('failed');
    }
    copyTimer.current = window.setTimeout(() => setCopyFeedback('idle'), 2000);
  }

  return <aside className="cp-v8-viewer" data-mode={mode} data-settled={state.packetSettled} aria-label="Proof process viewer">
    {packet ? <header className="cp-v8-packet-header">
      <div>
        <span>Change Proof / Evidence record</span>
        <h2 ref={headingRef} tabIndex={-1}>Shipping boundary</h2>
        <p>Recorded case: <code>{evidence.id}</code></p>
      </div>
      <button type="button" className="cp-v8-link" onClick={onReturn}>Return to verdict <span aria-hidden="true">↗</span></button>
    </header> : <header className="cp-v8-viewer-header">
      <h2>{mode === 'preparing' ? 'Preparing evidence' : 'Proof process'}</h2>
      <p>{evidence.change.area} · recorded case</p>
    </header>}

    {mode === 'preparing' && <div className="cp-v8-preparation" aria-label="Recorded case preparation">
      <div><span>Recorded change</span><strong>{preparationRow >= 1 ? evidence.change.area : 'Reading record'}</strong></div>
      <div><span>Revisions</span><strong>{preparationRow >= 2 ? `Earlier ${evidence.base.revision} → Current ${evidence.head.revision}` : 'Pairing versions'}</strong></div>
      <div><span>Boundary</span><strong>{preparationRow >= 3 ? evidence.change.boundary : 'Locating boundary'}</strong></div>
    </div>}

    {mode === 'ready' && <div className="cp-v8-ready">
      <h3>Recorded change</h3>
      <div className="cp-v8-ready__pair">
        <div><span>Earlier / {evidence.base.revision}</span><strong>{evidence.change.baseOperator} {evidence.change.boundary}</strong></div>
        <span aria-hidden="true">→</span>
        <div><span>Current / {evidence.head.revision}</span><strong>{evidence.change.headOperator} {evidence.change.boundary}</strong></div>
      </div>
      <p>{phase === 'traceReady' ? 'Ready to trace' : 'Preparing trace'}</p>
    </div>}

    {mode === 'shipping' && <div className="cp-v8-shipping">
      <p>{evidence.change.baseOperator} {evidence.change.boundary} <span aria-hidden="true">→</span> {evidence.change.headOperator} {evidence.change.boundary}</p>
      <strong>{shippingStep === 'shipping' ? 'Opening Shipping' : 'Locating the boundary'}</strong>
    </div>}

    {(mode === 'graph' || mode === 'verdict' || mode === 'packet') && <ProcessDiagram evidence={evidence} state={state} />}

    {packet && <div className="cp-v8-packet-extra">
      <div className="cp-v8-packet-explanation">At {evidence.test.input}, HEAD matches the test's expectation; BASE does not.</div>
      <div className="cp-v8-disclosures">
        <details><summary>Implementation details</summary><div className="cp-v8-disclosure-body">
          <p><code>{evidence.head.implementationPath}</code></p>
          <dl>
            <div><dt>Earlier / {evidence.base.revision}</dt><dd><code>{implementationExpression(evidence, 'base')}</code></dd></div>
            <div><dt>Current / {evidence.head.revision}</dt><dd><code>{implementationExpression(evidence, 'head')}</code></dd></div>
          </dl>
        </div></details>
        <details><summary>Raw evidence</summary><pre>{JSON.stringify(evidence, null, 2)}</pre></details>
      </div>
      <footer className="cp-v8-packet-actions">
        <button type="button" className="cp-v8-link" onClick={copyReference}>Copy record reference</button>
        <span aria-live="polite">{copyFeedback === 'copied' ? 'Reference copied' : copyFeedback === 'failed' ? <>Select and copy this reference: <code>{evidence.id}</code></> : ''}</span>
        <button type="button" className="cp-v8-link" onClick={onReplay}>Replay experience <span aria-hidden="true">→</span></button>
      </footer>
    </div>}
  </aside>;
}
