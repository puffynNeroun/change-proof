import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { shippingEvidence as evidence } from '../evidenceCase';
import './evidence-trace-calibration.css';

/** The approved resting composition serves both its lab route and the production page. */
export function EvidenceTraceCalibration({ embedded = false }: { embedded?: boolean }) {
  const Root = embedded ? 'div' : 'main';
  return <Root className="v9-evidence-trace">
    <section className="v9-evidence-trace__spread" aria-labelledby="evidence-trace-title">
      <header className="v9-evidence-trace__intro">
        <h1 id="evidence-trace-title">EVIDENCE TRACE</h1>
        <p>One recorded change.<br />One selected test.<br />Two revisions.<br />One observable divergence.</p>
      </header>

      <ol className="v9-evidence-trace__ledger" aria-label="From recorded change to proof">
        <li className="v9-evidence-trace__row v9-evidence-trace__change" data-evidence-event="recorded-change">
          <span className="v9-evidence-trace__index" aria-hidden="true">01</span>
          <div className="v9-evidence-trace__heading"><h2>RECORDED CHANGE</h2><p>Shipping boundary</p></div>
          <dl className="v9-evidence-trace__pair">
            <div><dt>BASE</dt><dd>{evidence.change.baseOperator} {evidence.change.boundary}</dd></div>
            <div><dt>HEAD</dt><dd>{evidence.change.headOperator} {evidence.change.boundary}</dd></div>
          </dl>
        </li>

        <li className="v9-evidence-trace__row v9-evidence-trace__test" data-evidence-event="selected-test">
          <span className="v9-evidence-trace__index" aria-hidden="true">02</span>
          <div className="v9-evidence-trace__heading"><h2>SELECTED TEST</h2></div>
          <div className="v9-evidence-trace__test-evidence">
            <code className="v9-evidence-trace__filename">{evidence.test.path}</code>
            <dl className="v9-evidence-trace__pair"><div><dt>input</dt><dd>{evidence.test.input}</dd></div><div><dt>expected</dt><dd>{String(evidence.test.expected)}</dd></div></dl>
          </div>
        </li>

        <li className="v9-evidence-trace__row v9-evidence-trace__head" data-evidence-event="head-replay">
          <span className="v9-evidence-trace__index" aria-hidden="true">03</span>
          <div className="v9-evidence-trace__heading"><h2>HEAD REPLAY</h2></div>
          <dl className="v9-evidence-trace__observation"><div><dt>observed</dt><dd>{String(evidence.head.observed)}</dd></div></dl>
        </li>

        <li className="v9-evidence-trace__row v9-evidence-trace__base" data-evidence-event="base-replay">
          <span className="v9-evidence-trace__index" aria-hidden="true">04</span>
          <div className="v9-evidence-trace__heading"><h2>BASE REPLAY</h2></div>
          <dl className="v9-evidence-trace__observation"><div><dt>observed</dt><dd>{String(evidence.base.observed)}</dd></div></dl>
        </li>

        <li className="v9-evidence-trace__row v9-evidence-trace__mismatch" data-evidence-event="mismatch">
          <span className="v9-evidence-trace__index" aria-hidden="true">05</span>
          <div className="v9-evidence-trace__heading"><h2>MISMATCH</h2></div>
          <div><p className="v9-evidence-trace__equation"><span>false</span> <span>≠</span> true</p><p className="v9-evidence-trace__comparison">Same input. Same expectation.<br />Different behavior.</p></div>
        </li>

        <li className="v9-evidence-trace__row v9-evidence-trace__record" data-evidence-event="proof-record">
          <span className="v9-evidence-trace__index" aria-hidden="true">06</span>
          <div className="v9-evidence-trace__heading"><h2>PROOF RECORD</h2></div>
          <div><code className="v9-evidence-trace__reference">{evidence.id}</code><p className="v9-evidence-trace__conclusion">This test catches<br />the exact change.</p></div>
        </li>
      </ol>

      <p className="v9-evidence-trace__signature">CHANGE PROOF <span>/</span> SHIPPING BOUNDARY</p>
    </section>
  </Root>;
}
