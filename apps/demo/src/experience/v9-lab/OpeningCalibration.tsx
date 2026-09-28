import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './opening-calibration.css';

/** Two held frames of the opening. No timers or production scene transitions. */
export function OpeningCalibration({ state }: { state: 'orientation' | 'trace' }) {
  const ready = state === 'trace';

  return <main className={`v9-opening v9-opening--${state}`} aria-label={ready ? 'Trace ready calibration' : 'Evidence preparation calibration'}>
    <img className="v9-opening__scene" src="/cinematic/shipping-final/idle.png" alt="The recorded commerce machine, with Catalog, Cart, Checkout, Shipping, Payments and Orders modules." />
    <div className="v9-opening__tonal-field" aria-hidden="true" />

    <header className="v9-opening__masthead">
      <div className="v9-opening__brand">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7h13v10H5m13-10h9v18H14v-8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
        <span>CHANGE PROOF</span>
      </div>
      <span className="v9-opening__context">SHIPPING <span>/</span> BOUNDARY CHECK</span>
    </header>

    <section className="v9-opening__narrative" aria-labelledby="v9-opening-title">
      <p className="v9-opening__chapter"><span>01</span> THE RECORDED CASE</p>
      <h1 id="v9-opening-title">Does this test<br />catch the change?</h1>
      <p className="v9-opening__explanation">Change Proof replays the same selected test<br />against two revisions to show exactly where<br />their behavior diverges.</p>
    </section>

    {ready && <svg className="v9-opening__registration" viewBox="0 0 2560 1440" fill="none" aria-hidden="true">
      <path className="v9-opening__module-mark" d="M1597 684h15v67h-15" />
      <path className="v9-opening__leader" d="M1612 717H1920" />
      <circle cx="1612" cy="717" r="3" />
    </svg>}

    <aside className="v9-opening-lens" aria-labelledby="v9-opening-status">
      <header className="v9-opening-lens__top">
        <h2><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>Proof lens</h2>
      </header>

      <div className="v9-opening-lens__intro">
        <h3 id="v9-opening-status">{ready ? 'READY TO TRACE' : 'PREPARING EVIDENCE'}</h3>
        <p>{ready ? 'One recorded case. Ready for you.' : 'One recorded case. No input needed.'}</p>
      </div>

      <div className="v9-opening-lens__assembly" aria-label={ready ? 'Recorded Shipping change and selected test identified' : 'Shipping and revisions registered; boundary registering; selected test next'}>
        <div className="v9-opening-lens__spine" aria-hidden="true" />
        <section className="v9-opening-lens__fact v9-opening-lens__change">
          <span className="v9-opening-lens__notch" aria-hidden="true" />
          <p className="v9-opening-lens__label">RECORDED CHANGE</p>
          <strong>Shipping</strong>
        </section>

        {ready ? <section className="v9-opening-lens__boundary" aria-label="Recorded boundary change: BASE greater than 5000; HEAD greater than or equal to 5000">
          <span className="v9-opening-lens__notch" aria-hidden="true" />
          <p className="v9-opening-lens__label">REVISIONS / BOUNDARY</p>
          <div className="v9-opening-lens__rules">
            <div><span>BASE</span><code>&gt; 5000</code></div>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h17m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.3" /></svg>
            <div><span>HEAD</span><code>&gt;= 5000</code></div>
          </div>
        </section> : <>
          <section className="v9-opening-lens__fact v9-opening-lens__revisions">
            <span className="v9-opening-lens__notch" aria-hidden="true" />
            <p className="v9-opening-lens__label">REVISIONS</p>
            <code>BASE <span className="v9-opening-lens__revision-arrow">→</span> HEAD</code>
          </section>
          <section className="v9-opening-lens__fact v9-opening-lens__registering">
            <span className="v9-opening-lens__notch" aria-hidden="true" />
            <p className="v9-opening-lens__label">BOUNDARY <span>REGISTERING</span></p>
            <div className="v9-opening-lens__capture"><code>5000</code><i aria-hidden="true" /></div>
          </section>
        </>}

        <section className={`v9-opening-lens__fact v9-opening-lens__test${ready ? '' : ' v9-opening-lens__test--pending'}`}>
          <span className="v9-opening-lens__notch" aria-hidden="true" />
          <p className="v9-opening-lens__label">SELECTED TEST</p>
          {ready ? <code>Identified</code> : <span className="v9-opening-lens__next">Next to register</span>}
        </section>
      </div>

      {ready ? <button className="v9-opening-lens__action" type="button">
        <span>TRACE SHIPPING</span><svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M3 12h25m-8-8 8 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button> : <footer className="v9-opening-lens__waiting">
        <span>Registration in progress.</span> Trace becomes available when ready.
      </footer>}
    </aside>
  </main>;
}
