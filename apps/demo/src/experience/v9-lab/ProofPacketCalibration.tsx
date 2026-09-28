import { useState } from 'react';
import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { shippingEvidence as evidence } from '../evidenceCase';
import './proof-record-final-calibration.css';

/** Static 2560 × 1320 Evidence Sheet. Only mounted by the isolated packet lab route. */
export function ProofPacketCalibration() {
  const [copyStatus, setCopyStatus] = useState('');
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(evidence.id);
      setCopyStatus('Proof reference copied.');
    } catch {
      setCopyStatus('Copy unavailable. Select the case reference above.');
    }
  }

  return <main className="v9-record">
    <img className="v9-record__scene" src="/cinematic/shipping-final/open.png" alt="The Shipping machine behind the completed evidence sheet." />
    <div className="v9-record__recession" aria-hidden="true" />
    <header className="v9-record__masthead">
      <div className="v9-record__brand">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7h13v10H5m13-10h9v18H14v-8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
        <span>CHANGE PROOF</span>
      </div>
      <span className="v9-record__context">SHIPPING <span>/</span> BOUNDARY CHECK</span>
    </header>

    <article className="v9-record__sheet" aria-labelledby="record-title">
      <header className="v9-record__sheet-top">
        <h1 id="record-title">CHANGE PROOF <span>/</span> EVIDENCE RECORD</h1>
        <div className="v9-record__lens-mark">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>
          Proof lens
        </div>
      </header>

      <div className="v9-record__body">
        <div className="v9-record__conclusion">
          <h2>This test catches<br />the exact change.</h2>
        </div>

        <section className="v9-record__test" data-test-identity="checkout-boundary" aria-labelledby="record-test">
          <h3 id="record-test" className="v9-record__label">SAME SELECTED TEST</h3>
          <div className="v9-record__filename">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H5v18h14V8Zm0 0v5h5M8 13l2 2-2 2m5 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
            <code>{evidence.test.path}</code>
          </div>
          <div className="v9-record__values">
            <div><span>input</span><strong>{evidence.test.input}</strong></div>
            <div><span>expected</span><strong>{String(evidence.test.expected)}</strong></div>
          </div>
        </section>

        <section className="v9-record__change" aria-labelledby="record-change">
          <h3 id="record-change" className="v9-record__label">RECORDED CHANGE</h3>
          <p className="v9-record__subject">Shipping boundary</p>
          <div className="v9-record__rules">
            <div><span>BASE</span><code>{evidence.change.baseOperator} {evidence.change.boundary}</code></div>
            <span className="v9-record__arrow" aria-hidden="true">→</span>
            <div><span>HEAD</span><code>{evidence.change.headOperator} {evidence.change.boundary}</code></div>
          </div>
        </section>

        <section className="v9-record__observations" aria-labelledby="record-observations">
          <h3 id="record-observations" className="v9-record__label">OBSERVATIONS</h3>
          <div className="v9-record__results">
            <div className="v9-record__head"><span>HEAD</span><strong>{String(evidence.head.observed)}</strong></div>
            <div className="v9-record__base"><span>BASE</span><strong>{String(evidence.base.observed)}</strong></div>
          </div>
        </section>
      </div>

      <div className="v9-record__secondary">
        <div><span>Implementation</span><code>{evidence.head.implementationPath}</code></div>
        <div><span>Case reference</span><code>{evidence.id}</code></div>
        {/* Closed disclosure affordance only; raw content is outside this calibration. */}
        <button className="v9-record__raw" type="button" aria-expanded="false">INSPECT RAW EVIDENCE <span aria-hidden="true">⌄</span></button>
      </div>

      <footer className="v9-record__actions">
        <a href="?v9lab=verdict">← RETURN TO VERDICT</a>
        <span className="v9-record__copy-status" role="status">{copyStatus}</span>
        <button type="button" onClick={copyReference}>COPY PROOF REFERENCE <span aria-hidden="true">→</span></button>
      </footer>
    </article>
  </main>;
}
