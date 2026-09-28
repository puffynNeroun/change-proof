import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { shippingEvidence as evidence } from '../evidenceCase';
import './capabilities-calibration.css';

/** The approved resting composition serves both its lab route and the production page. */
export function CapabilitiesCalibration({ embedded = false }: { embedded?: boolean }) {
  const Root = embedded ? 'div' : 'main';
  return <Root className="v9-capabilities">
    <section className="v9-capabilities__spread" aria-labelledby="capabilities-title">
      <header className="v9-capabilities__intro">
        <h1 id="capabilities-title">WHAT CHANGE PROOF DOES</h1>
      </header>

      <ol className="v9-capabilities__field" aria-label="Product capabilities">
        <li className="v9-capabilities__band" data-capability="record">
          <span className="v9-capabilities__number" aria-hidden="true">01</span>
          <h2>RECORD THE CHANGE</h2>
          <p className="v9-capabilities__explanation">Keep BASE and HEAD tied to one<br />exact behavioral boundary.</p>
          <div className="v9-capabilities__fragment v9-capabilities__boundary" aria-label="BASE greater than 5000 changes to HEAD greater than or equal to 5000">
            <div><span className="v9-capabilities__label">BASE</span><code>{evidence.change.baseOperator} {evidence.change.boundary}</code></div>
            <span className="v9-capabilities__arrow" aria-hidden="true">→</span>
            <div><span className="v9-capabilities__label">HEAD</span><code>{evidence.change.headOperator} {evidence.change.boundary}</code></div>
          </div>
        </li>

        <li className="v9-capabilities__band" data-capability="replay">
          <span className="v9-capabilities__number" aria-hidden="true">02</span>
          <h2>REPLAY THE SAME TEST</h2>
          <p className="v9-capabilities__explanation">Same test. Same input.<br />Same expectation. Different revision.</p>
          <div className="v9-capabilities__fragment v9-capabilities__test">
            <code className="v9-capabilities__path">{evidence.test.path}</code>
            <div className="v9-capabilities__test-values"><span><span className="v9-capabilities__label">input</span><code>{evidence.test.input}</code></span><span><span className="v9-capabilities__label">expects</span><code>{String(evidence.test.expected)}</code></span></div>
          </div>
        </li>

        <li className="v9-capabilities__band" data-capability="localize">
          <span className="v9-capabilities__number" aria-hidden="true">03</span>
          <h2>LOCALIZE THE DIVERGENCE</h2>
          <p className="v9-capabilities__explanation">See exactly where observed<br />behavior separates.</p>
          <div className="v9-capabilities__fragment v9-capabilities__observations">
            <div><span className="v9-capabilities__label">HEAD</span><code className="v9-capabilities__true">{String(evidence.head.observed)}</code></div>
            <span className="v9-capabilities__difference" aria-label="differs from">≠</span>
            <div><span className="v9-capabilities__label">BASE</span><code className="v9-capabilities__false">{String(evidence.base.observed)}</code></div>
          </div>
        </li>

        <li className="v9-capabilities__band" data-capability="keep">
          <span className="v9-capabilities__number" aria-hidden="true">04</span>
          <h2>KEEP THE PROOF</h2>
          <p className="v9-capabilities__explanation">Produce a compact evidence record<br />for review after the run.</p>
          <div className="v9-capabilities__fragment v9-capabilities__record"><span className="v9-capabilities__label">evidence record</span><code>{evidence.id}</code></div>
        </li>
      </ol>
    </section>
  </Root>;
}
