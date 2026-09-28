import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './proof-sequence-calibration.css';

export type ProofSequenceState = 'selected-test' | 'base' | 'mismatch' | 'verdict';

const chapters = {
  'selected-test': ['04', 'SELECTED TEST'],
  base: ['05', 'BASE REPLAY'],
  mismatch: ['06', 'MISMATCH'],
  verdict: ['07', 'VERDICT'],
} as const;

/** One invariant specimen, registered to different revision positions in held frames. */
function TestIdentity() {
  return <div className="v9-proof__test" data-test-identity="checkout-boundary">
    <p className="v9-proof__label">ONE SELECTED TEST</p>
    <div className="v9-proof__filename">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H5v18h14V8Zm0 0v5h5M8 13l2 2-2 2m5 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
      <code>test/checkout.test.js</code>
    </div>
    <div className="v9-proof__values">
      <div><span className="v9-proof__label">INPUT</span><strong>5000</strong></div>
      <div><span className="v9-proof__label">EXPECTS</span><strong>true</strong></div>
    </div>
  </div>;
}

/** Static lab routes only: no production state, timers, media alteration, or motion. */
export function ProofSequenceCalibration({ state }: { state: ProofSequenceState }) {
  const selected = state === 'selected-test';
  const replay = state === 'base';
  const mismatch = state === 'mismatch';
  const resolved = state === 'verdict';
  const compared = mismatch || resolved;
  const chapter = chapters[state];

  return <main className={`v9-proof v9-proof--${state}`}>
    <img className="v9-proof__scene" src="/cinematic/shipping-final/open.png" alt="Open Shipping machine with its green selected checkout test carriage." />
    <div className="v9-proof__tonal-field" aria-hidden="true" />
    <header className="v9-proof__masthead">
      <div className="v9-proof__brand">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7h13v10H5m13-10h9v18H14v-8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
        <span>CHANGE PROOF</span>
      </div>
      <span className="v9-proof__context">SHIPPING <span>/</span> BOUNDARY CHECK</span>
    </header>

    <section className="v9-proof__narrative">
      <p className="v9-proof__chapter"><span>{chapter[0]}</span>{chapter[1]}</p>
      {selected && <><h1>One test.<br />One boundary<br />expectation.</h1><p className="v9-proof__explanation">Does the same test<br />reject BASE behavior?</p></>}
      {replay && <><h1>Same test.<br />Earlier revision.</h1><p className="v9-proof__explanation">Replaying the exact boundary<br />against BASE.</p></>}
      {mismatch && <><h1>Same input.<br />Different result.</h1><p className="v9-proof__explanation">HEAD returns true.<br />BASE returns false.</p></>}
      {resolved && <h1>This test<br />catches the<br />exact change.</h1>}
    </section>

    {selected && <svg className="v9-proof__registration" viewBox="0 0 2560 1440" fill="none" aria-hidden="true">
      <path d="M1390 1080h434a20 20 0 0 0 20-20V435a20 20 0 0 1 20-20h56" />
      <circle cx="1390" cy="1080" r="3" />
    </svg>}

    <aside className="v9-proof__lens" aria-label="Proof lens">
      <header className="v9-proof__lens-top">
        <h2><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>Proof lens</h2>
      </header>

      <div className="v9-proof__body">
        <TestIdentity />

        <svg className="v9-proof__routes" viewBox="0 0 410 80" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path className="v9-proof__stem" d="M205 0v24" />
          <path className="v9-proof__route-head" d="M205 24v4q0 10-10 10h-83q-10 0-10 10v32" />
          <path className="v9-proof__route-base" d="M205 24v4q0 10 10 10h83q10 0 10 10v32" />
          <circle cx="205" cy="24" r="3" fill="#c2ccd3" />
        </svg>

        <div className="v9-proof__observations">
          <div className="v9-proof__head-observation">
            <h3>HEAD</h3><strong className="v9-proof__true">true</strong>
            <span className="v9-proof__caption">{selected ? 'observed' : 'recorded'}</span>
          </div>
          <div className="v9-proof__base-observation">
            <h3>BASE</h3>
            {selected && <><strong className="v9-proof__unresolved">—</strong><span className="v9-proof__caption">not replayed</span></>}
            {replay && <><strong className="v9-proof__evaluating">evaluating<span aria-hidden="true" /></strong><span className="v9-proof__operator">OPERATOR <code>&gt;</code></span></>}
            {compared && <><strong className="v9-proof__false">false</strong><span className="v9-proof__caption">observed</span></>}
          </div>
        </div>

        {mismatch && <div className="v9-proof__comparison">
          <svg viewBox="0 0 410 70" fill="none" aria-hidden="true"><path d="M102 0v12q0 9 10 9h70q23 0 23 23v26M308 0v12q0 9-10 9h-70q-23 0-23 23" stroke="#a9b8c2" strokeWidth="1.5" /><circle cx="205" cy="44" r="3" fill="#e799c0" /></svg>
          <p className="v9-proof__compare-label">COMPARE TO EXPECTATION</p>
          <p className="v9-proof__equation"><span>false</span> <b>≠</b> true</p>
        </div>}

        {replay && <p className="v9-proof__replay-note">Same input. Same expectation.</p>}

        {resolved && <div className="v9-proof__boundary">
          <p className="v9-proof__label">SHIPPING BOUNDARY</p>
          <p><code>&gt; 5000</code><span>→</span><code>&gt;= 5000</code></p>
        </div>}
      </div>

      {selected && <a className="v9-proof__action" href="?v9lab=base"><span>REPLAY AGAINST BASE</span><Arrow /></a>}
      {resolved && <button className="v9-proof__action" type="button"><span>VIEW PROOF RECORD</span><Arrow /></button>}
    </aside>
  </main>;
}

function Arrow() {
  return <svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M3 12h25m-8-8 8 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
