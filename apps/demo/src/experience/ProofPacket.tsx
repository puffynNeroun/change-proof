import { useState } from 'react';
import { evidenceBoolean, implementationExpression, type EvidenceCase } from './evidenceCase';

export function ProofPacket({ evidence, onReplay }: { evidence: EvidenceCase; onReplay: () => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(evidence.id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="cp-packet" aria-labelledby="cp-packet-title">
      <header className="cp-packet__header">
        <div><small>CHANGE PROOF / EVIDENCE RECORD</small><h1 id="cp-packet-title">Proof packet.</h1></div>
        <p>{evidence.verdict.catchesChange ? 'The same selected test, at the same input, distinguishes HEAD from BASE.' : 'The same selected test was compared against HEAD and BASE.'}</p>
      </header>
      <div className="cp-packet__body">
        <section><h2>01 / RECORDED CHANGE</h2><dl>
          <div><dt>Area</dt><dd>{evidence.change.area}</dd></div>
          <div><dt>BASE revision</dt><dd>{evidence.base.revision}</dd></div>
          <div><dt>HEAD revision</dt><dd>{evidence.head.revision}</dd></div>
          <div><dt>Boundary</dt><dd>{evidence.change.baseOperator} {evidence.change.boundary} → {evidence.change.headOperator} {evidence.change.boundary}</dd></div>
        </dl></section>
        <section><h2>02 / IMPLEMENTATION</h2><dl>
          <div><dt>BASE path</dt><dd>{evidence.base.implementationPath}</dd></div>
          <div><dt>HEAD path</dt><dd>{evidence.head.implementationPath}</dd></div>
          <div><dt>BASE</dt><dd><code>{implementationExpression(evidence, 'base')}</code></dd></div>
          <div><dt>HEAD</dt><dd><code>{implementationExpression(evidence, 'head')}</code></dd></div>
        </dl></section>
        <section><h2>03 / SELECTED TEST</h2><dl>
          <div><dt>Path</dt><dd>{evidence.test.path}</dd></div>
          <div><dt>Input</dt><dd>{evidence.test.input}</dd></div>
          <div><dt>Expected</dt><dd>{evidenceBoolean(evidence.test.expected)}</dd></div>
        </dl></section>
        <section><h2>04 / OBSERVATIONS</h2><dl>
          <div><dt>HEAD</dt><dd className="cp-green">{evidenceBoolean(evidence.head.observed)}</dd></div>
          <div><dt>BASE</dt><dd className="cp-magenta">{evidenceBoolean(evidence.base.observed)}</dd></div>
        </dl></section>
      </div>
      <div className="cp-packet__conclusion"><small>05 / VERDICT</small><strong>{evidence.verdict.catchesChange ? 'The selected test catches the recorded boundary change.' : 'The selected test does not catch the recorded boundary change.'}</strong><p>At {evidence.test.input}, HEAD returns {evidenceBoolean(evidence.head.observed)} and BASE returns {evidenceBoolean(evidence.base.observed)}. The test expects {evidenceBoolean(evidence.test.expected)}.</p></div>
      <footer className="cp-packet__actions">
        <button type="button" onClick={copyReference}>{copied ? 'REFERENCE COPIED ✓' : 'COPY PROOF REFERENCE'}</button>
        <button type="button" aria-expanded={showRaw} onClick={() => setShowRaw((value) => !value)}>{showRaw ? 'HIDE RAW EVIDENCE' : 'INSPECT RAW EVIDENCE'}</button>
        <button type="button" onClick={onReplay}>REPLAY →</button>
      </footer>
      {showRaw && <pre className="cp-packet__raw">{JSON.stringify(evidence, null, 2)}</pre>}
    </section>
  );
}
