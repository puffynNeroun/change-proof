import { useRef } from 'react';
import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './head-calibration.css';

function Check() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function HeadCalibration() {
  const selectedTest = useRef<HTMLDivElement>(null);

  return <main className="v9-head" aria-label="HEAD observation calibration">
    <img className="v9-head__scene" src="/cinematic/shipping-final/open.png" alt="Shipping machine with subtotal 5000, greater-than-or-equal comparison, result true, and selected checkout test expecting true." />
    <div className="v9-head__tonal-field" aria-hidden="true" />

    <header className="v9-head__masthead">
      <div className="v9-head__brand">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7h13v10H5m13-10h9v18H14v-8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
        <span>CHANGE PROOF</span>
      </div>
      <span className="v9-head__context">SHIPPING <span>/</span> BOUNDARY CHECK</span>
    </header>

    <section className="v9-head__narrative" aria-labelledby="v9-head-title">
      <p className="v9-head__chapter"><span>03</span> CURRENT REVISION</p>
      <h1 id="v9-head-title">At 5000,<br />HEAD returns<br /><em>true.</em></h1>
      <p className="v9-head__explanation">The boundary is included.<br />HEAD matches the selected<br />test’s expectation.</p>
    </section>

    <svg className="v9-head__registration" viewBox="0 0 2560 1440" fill="none" aria-hidden="true">
      <path d="M1390 1080h434a20 20 0 0 0 20-20V452a20 20 0 0 1 20-20h90" />
      <circle cx="1390" cy="1080" r="3" />
    </svg>

    <aside className="v9-lens" aria-labelledby="v9-lens-title">
      <header className="v9-lens__top">
        <h2 id="v9-lens-title"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>Proof lens</h2>
      </header>

      <div className="v9-lens__body">
        <div className="v9-lens__test" ref={selectedTest} tabIndex={-1} aria-label="Selected test: test/checkout.test.js, input 5000, expects true">
          <p className="v9-lens__label">ONE SELECTED TEST</p>
          <div className="v9-lens__filename"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H5v18h14V8Zm0 0v5h5M8 13l2 2-2 2m5 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg><code>test/checkout.test.js</code></div>
          <div className="v9-lens__values">
            <div><span className="v9-lens__label">INPUT</span><strong>5000</strong></div>
            <div><span className="v9-lens__label">EXPECTS</span><strong>true</strong></div>
          </div>
        </div>

        <div className="v9-lens__comparison" aria-label="The same selected test: HEAD matches expectation; BASE has not been replayed">
          <div className="v9-lens__shared">SAME TEST</div>
          <svg className="v9-lens__branches" viewBox="0 0 410 92" fill="none" aria-hidden="true">
            <path d="M205 0v30" stroke="#c2ccd3" strokeWidth="2" />
            <path d="M205 30v6a10 10 0 0 1-10 10h-84a10 10 0 0 0-10 10v36" stroke="#83a6ff" strokeWidth="2.5" />
            <path d="M205 30v6a10 10 0 0 0 10 10h84a10 10 0 0 1 10 10v36" stroke="#9ba7af" strokeWidth="2" strokeDasharray="4 6" />
            <circle cx="205" cy="30" r="4" fill="#c2ccd3" />
          </svg>
          <div className="v9-lens__revisions">
            <div className="v9-lens__head-result">
              <div className="v9-lens__revision-label">HEAD</div>
              <div className="v9-lens__result"><span className="v9-lens__check"><Check /></span><strong>Matches</strong></div>
              <span className="v9-lens__result-caption">expectation</span>
            </div>
            <div className="v9-lens__base-result">
              <div className="v9-lens__revision-label">BASE</div>
              <div className="v9-lens__waiting">Waiting</div>
              <span className="v9-lens__result-caption">Not replayed</span>
            </div>
          </div>
        </div>

      </div>
        <button className="v9-lens__action" onClick={() => selectedTest.current?.focus({ preventScroll: true })}>
          <span>REVIEW SELECTED TEST</span><svg className="v9-lens__arrow" viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M3 12h25m-8-8 8 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
    </aside>

  </main>;
}
