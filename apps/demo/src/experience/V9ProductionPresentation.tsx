import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { EvidenceCase } from './evidenceCase';
import { reached, type Presentation } from './presentation';
import './v9-lab/opening-calibration.css';
import './v9-lab/head-calibration.css';
import './v9-lab/proof-sequence-calibration.css';
import './v9-lab/proof-packet-calibration.css';
import './v9-production.css';

const Arrow = () => <svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M3 12h25m-8-8 8 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const LensIcon = () => <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>;
const FileIcon = () => <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H5v18h14V8Zm0 0v5h5M8 13l2 2-2 2m5 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;

interface Props {
  evidence: EvidenceCase;
  state: Presentation;
  bootError: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  packetButtonRef: RefObject<HTMLButtonElement | null>;
  onIdleReady: () => void;
  onIdleError: () => void;
  onVideoReady: () => void;
  onVideoError: () => void;
  onVideoTime: (time: number) => void;
  onVideoEnd: () => void;
  onTrace: () => void;
  onReview: () => void;
  onBase: () => void;
  onPacket: () => void;
  onReturn: () => void;
  onReplay: () => void;
}

function TestIdentity({ evidence }: { evidence: EvidenceCase }) {
  return <div className="v9-live-test" data-test-identity={evidence.id}>
    <i className="v9-live-test-bracket" aria-hidden="true" />
    <p className="v9-live-label"><span className="v9-live-test-label">ONE SELECTED TEST</span><span className="v9-live-record-test-label">SAME SELECTED TEST</span></p>
    <div className="v9-live-filename"><FileIcon /><code>{evidence.test.path}</code></div>
    <div className="v9-live-values">
      <div><span className="v9-live-label">INPUT</span><strong>{evidence.test.input}</strong></div>
      <div><span className="v9-live-label">EXPECTS</span><strong>{String(evidence.test.expected)}</strong></div>
    </div>
  </div>;
}

function OpeningLens({ evidence, state, ready, onTrace }: Pick<Props, 'evidence' | 'state' | 'onTrace'> & { ready: boolean }) {
  const row = state.preparationRow;
  return <div className="v9-live-opening" data-preparation-row={row}>
    <div className="v9-live-opening-intro">
      <h3>{ready ? 'READY TO TRACE' : 'PREPARING EVIDENCE'}</h3>
      <p>{ready ? 'One recorded case. Ready for you.' : 'One recorded case. No input needed.'}</p>
    </div>
    <div className="v9-live-assembly" aria-label={ready ? 'Recorded Shipping change and selected test identified' : 'Preparing the recorded change, revisions, boundary and selected test'}>
      <div className="v9-live-spine" aria-hidden="true" />
      <section className="v9-live-fact v9-live-change" data-registered={ready || row >= 1}>
        <span className="v9-live-notch" aria-hidden="true" /><p className="v9-live-label">RECORDED CHANGE</p><strong>{evidence.change.area}</strong>
      </section>
      <section className="v9-live-boundary-ready" data-visible={ready} aria-label={`Recorded boundary change: BASE ${evidence.change.baseOperator} ${evidence.change.boundary}; HEAD ${evidence.change.headOperator} ${evidence.change.boundary}`}>
        <span className="v9-live-notch" aria-hidden="true" /><p className="v9-live-label">REVISIONS / BOUNDARY</p>
        <div className="v9-live-rules"><div><span>BASE</span><code>{evidence.change.baseOperator} {evidence.change.boundary}</code></div><span aria-hidden="true">→</span><div><span>HEAD</span><code>{evidence.change.headOperator} {evidence.change.boundary}</code></div></div>
      </section>
      <section className="v9-live-fact v9-live-revisions" data-registered={row >= 2} data-ready={ready}><span className="v9-live-notch" aria-hidden="true" /><p className="v9-live-label">REVISIONS</p><code><b>{evidence.base.revision}</b> <span>→</span> <b>{evidence.head.revision}</b></code></section>
      <section className="v9-live-fact v9-live-registering" data-registered={row >= 3} data-ready={ready}><span className="v9-live-notch" aria-hidden="true" /><p className="v9-live-label">BOUNDARY <span>REGISTERING</span></p><div className="v9-live-capture"><code>{evidence.change.boundary}</code><i aria-hidden="true" /></div></section>
      <section className="v9-live-fact v9-live-selected" data-registered={ready || row >= 4}><span className="v9-live-notch" aria-hidden="true" /><p className="v9-live-label">SELECTED TEST</p>{ready || row >= 4 ? <code>Identified</code> : <span className="v9-live-next">Next to register</span>}</section>
    </div>
    {ready && <button className="v9-live-action" type="button" onClick={onTrace}><span>TRACE SHIPPING</span><Arrow /></button>}
  </div>;
}

function EvidenceLens({ evidence, state, onReview, onBase, onPacket, onReturn, packetButtonRef }: Pick<Props, 'evidence' | 'state' | 'onReview' | 'onBase' | 'onPacket' | 'onReturn' | 'packetButtonRef'>) {
  const phase = state.phase;
  const packet = phase === 'proofPacket';
  const recordActive = packet && !state.packetFolded;
  const head = phase === 'headObservation';
  const selected = phase === 'selectedTest';
  const observed = reached(state.replayEvent, 'observed');
  const replayingBase = phase === 'baseReplay' && !observed;
  const localized = reached(state.replayEvent, 'localized');
  const mismatchNamed = reached(state.replayEvent, 'named');
  const verdict = phase === 'verdict';
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (recordActive && state.packetSettled) returnButtonRef.current?.focus({ preventScroll: true });
  }, [recordActive, state.packetSettled]);
  useEffect(() => () => { if (copyTimer.current !== null) window.clearTimeout(copyTimer.current); }, []);

  async function copyReference() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(evidence.id);
      else throw new Error('Clipboard API unavailable');
    } catch {
      const input = document.createElement('textarea');
      input.value = evidence.id;
      input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.appendChild(input); input.select();
      const success = document.execCommand('copy');
      input.remove();
      if (!success) return;
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
  }

  return <div className="v9-live-lens-body" data-mode={recordActive ? 'packet' : head ? 'head' : 'proof'} data-replay-event={state.replayEvent}>
    <section className="v9-live-record-conclusion" aria-hidden={!recordActive}><h3>This test catches<br />the exact change.</h3></section>
    <section className="v9-live-change-record" aria-hidden={!recordActive}>
      <p className="v9-live-label">RECORDED CHANGE</p><h3>{evidence.change.area} boundary</h3>
      <div className="v9-live-packet-rules"><div><span>BASE</span><code>{evidence.change.baseOperator} {evidence.change.boundary}</code></div><span aria-hidden="true">→</span><div><span>HEAD</span><code>{evidence.change.headOperator} {evidence.change.boundary}</code></div></div>
    </section>
    <div className="v9-live-experiment">
      <TestIdentity evidence={evidence} />
      <div className="v9-live-head-comparison"><div className="v9-live-shared">SAME TEST</div>
        <svg className="v9-live-routes" viewBox="0 0 410 80" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M205 0v24" /><path className="v9-live-route-head" d="M205 24v4q0 10-10 10h-83q-10 0-10 10v32" /><path className="v9-live-route-base" d="M205 24v4q0 10 10 10h83q10 0 10 10v32" /><path className="v9-live-route-base-active" pathLength="1" d="M205 24v4q0 10 10 10h83q10 0 10 10v32" /><circle cx="205" cy="24" r="3" fill="#c2ccd3" /></svg>
      </div>
      <div className="v9-live-observations">
        <div className="v9-live-head"><h3>HEAD</h3><div className="v9-live-match">✓ <strong>Matches</strong></div><strong className="v9-live-true">{String(evidence.head.observed)}</strong><span className="v9-live-head-caption">{head ? 'expectation' : selected ? 'observed' : 'recorded'}</span></div>
        <div className="v9-live-base"><h3>BASE</h3><strong className="v9-live-base-result" data-observed={observed}>{head ? 'Waiting' : observed ? String(evidence.base.observed) : replayingBase ? 'evaluating' : '—'}</strong><span className="v9-live-base-caption">{observed ? 'observed' : replayingBase ? 'Replay in progress' : head ? 'Not replayed' : 'not replayed'}</span><span className="v9-live-execution-mark" aria-hidden="true" /><span className="v9-live-operator">OPERATOR <code>{evidence.change.baseOperator}</code></span></div>
      </div>
      <p className="v9-live-replay-note">Same input. Same expectation.</p>
      <div className="v9-live-comparison" data-localized={localized} data-named={mismatchNamed}><svg viewBox="0 0 410 70" fill="none" aria-hidden="true"><path pathLength="1" d="M102 0v12q0 9 10 9h70q23 0 23 23v26M308 0v12q0 9-10 9h-70q-23 0-23 23" /><circle cx="205" cy="44" r="3" /></svg><div className="v9-live-equation-wrap"><p className="v9-live-compare-label">COMPARE TO EXPECTATION</p><p className="v9-live-equation"><span>{String(evidence.base.observed)}</span> <b>≠</b> {String(evidence.test.expected)}</p></div></div>
      <div className="v9-live-boundary"><p className="v9-live-label">{evidence.change.area.toUpperCase()} BOUNDARY</p><p><code>{evidence.change.baseOperator} {evidence.change.boundary}</code><span>→</span><code>{evidence.change.headOperator} {evidence.change.boundary}</code></p></div>
    </div>
    <div className="v9-live-record-secondary" aria-hidden={!recordActive}><div><span>Implementation</span><code>{evidence.head.implementationPath}</code></div><div><span>Case reference</span><code>{evidence.id}</code></div></div>
    <button type="button" className="v9-live-action v9-live-review-action" onClick={onReview} disabled={!head || !state.headActionReady} tabIndex={head && state.headActionReady ? 0 : -1}><span>REVIEW SELECTED TEST</span><Arrow /></button>
    <button type="button" className="v9-live-action v9-live-base-action" onClick={onBase} disabled={!selected} tabIndex={selected ? 0 : -1}><span>REPLAY AGAINST BASE</span><Arrow /></button>
    <button type="button" className="v9-live-action v9-live-record-action" ref={packetButtonRef} onClick={onPacket} disabled={!verdict || !reached(state.replayEvent, 'resolved')} tabIndex={verdict && reached(state.replayEvent, 'resolved') ? 0 : -1}><span>VIEW PROOF RECORD</span><Arrow /></button>
    <footer className="v9-live-packet-actions" aria-hidden={!recordActive}><button type="button" ref={returnButtonRef} tabIndex={recordActive && state.packetSettled ? 0 : -1} onClick={() => { setCopied(false); onReturn(); }}>← RETURN TO VERDICT</button><button type="button" tabIndex={recordActive && state.packetSettled ? 0 : -1} onClick={copyReference}><span>{copied ? 'COPIED' : 'COPY PROOF REFERENCE'}</span><Arrow /></button></footer>
  </div>;
}

function Registration({ opening }: { opening: boolean }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [route, setRoute] = useState({ path: '', x: 0, y: 0 });
  useLayoutEffect(() => {
    const target = anchor.current!;
    const stage = target.parentElement!;
    const measure = () => {
      const media = stage.querySelector('.v9-production-media')!.getBoundingClientRect();
      const end = target.getBoundingClientRect();
      const x = media.left + media.width * (opening ? 2252 : 2090) / 3840;
      const y = media.top + media.height * (opening ? 717 : 1080) / 1440;
      // One transfer point clears the machine; the Lens anchor stays fixed.
      const path = opening ? `M${x} ${y}L${end.left} ${end.top}`
        : `M${x} ${y}L${end.left - 32} ${y}L${end.left} ${end.top}`;
      setRoute({ path, x, y });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [opening]);
  return <><span ref={anchor} className={`v9-registration-target v9-registration-target--${opening ? 'opening' : 'head'}`} aria-hidden="true" />
    <svg className={`v9-production-registration v9-production-registration--${opening ? 'opening' : 'head'}`} fill="none" aria-hidden="true">
      <path d={route.path} pathLength="1" stroke="#344f658c" strokeWidth="1.25" />
      <circle cx={route.x} cy={route.y} r="3" fill="#e4e8e4" stroke="#416bb8" strokeWidth="1.5" />
    </svg></>;
}

export function V9ProductionPresentation(props: Props) {
  const { evidence, state, bootError, videoRef, packetButtonRef, onIdleReady, onIdleError, onVideoReady, onVideoError, onVideoTime, onVideoEnd, onTrace, onReview, onBase, onPacket, onReturn, onReplay } = props;
  const phase = state.phase;
  const opening = phase === 'orientation' || phase === 'recordedChange' || phase === 'traceReady';
  const shipping = phase === 'shippingTransition';
  const packet = phase === 'proofPacket';
  const head = phase === 'headObservation';
  const proofPhase = phase === 'selectedTest' ? 'selected-test' : phase === 'baseReplay' ? 'base' : phase === 'mismatch' ? 'mismatch' : 'verdict';
  const rootClass = opening ? `v9-opening v9-opening--${phase === 'traceReady' ? 'trace' : 'orientation'}` : head ? 'v9-head' : packet ? 'v9-packet' : `v9-proof v9-proof--${proofPhase}`;
  const announcement = phase === 'traceReady' ? 'Ready to trace Shipping.' : phase === 'headObservation' && state.headEvent === 'confirmed' ? 'HEAD returns true and matches the selected test.' : phase === 'selectedTest' ? 'Selected test ready to replay against BASE.' : phase === 'baseReplay' && state.replayEvent === 'observed' ? 'BASE returns false.' : phase === 'mismatch' && state.replayEvent === 'named' ? 'Mismatch: HEAD true, BASE false.' : phase === 'verdict' && state.replayEvent === 'resolved' ? 'This test catches the exact change.' : phase === 'proofPacket' && state.packetSettled ? 'Proof record open.' : '';

  return <main className="v9-production-viewport" tabIndex={-1} data-phase={phase} data-replay-event={state.replayEvent} data-paused={state.paused}>
    <div className={`v9-production-stage ${rootClass}`} data-phase={phase} data-media-phase={state.mediaPhase} data-base-evaluated={state.baseEvaluated} data-base-false-visible={state.baseFalseVisible} data-trace-mode={state.traceMode} data-head-event={state.headEvent} data-packet-closing={state.packetClosing} data-packet-settled={state.packetSettled} data-replay-reset={state.replayReset} data-replay-event={state.replayEvent}>
      <img className="v9-production-media" src="./cinematic/v9-final/idle-final.png" alt="" onLoad={onIdleReady} onError={onIdleError} data-visible={state.mediaPhase === 'idle'} />
      <img className="v9-production-media" src="./cinematic/v9-final/head-final.png" alt="" data-visible={state.mediaPhase === 'head'} />
      <img className="v9-production-media" src="./cinematic/v9-final/base-final.png" alt="" data-visible={state.mediaPhase === 'base'} />
      <video ref={videoRef} className="v9-production-media" src="./cinematic/v9-final/shipping-final-3840x1440-60fps.mp4" poster="./cinematic/v9-final/idle-final.png" preload="auto" muted playsInline onCanPlay={onVideoReady} onError={onVideoError} onTimeUpdate={event => onVideoTime(event.currentTarget.currentTime)} onEnded={onVideoEnd} data-visible={state.mediaPhase === 'shipping' || state.mediaPhase === 'headToBase'} />
      {phase !== 'boot' && <>
        <div className="v9-production-tonal-field" aria-hidden="true" />
        <header className="v9-production-masthead"><div className="v9-production-brand"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7h13v10H5m13-10h9v18H14v-8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg><span>CHANGE PROOF</span></div><span className="v9-production-context">{evidence.change.area.toUpperCase()} <span>/</span> BOUNDARY CHECK</span></header>
          <section className="v9-production-narrative" aria-labelledby="v9-production-title" data-visible={!shipping}>
            {opening ? <><p className="v9-production-chapter"><span>01</span> THE RECORDED CASE</p><h1 id="v9-production-title">Does this test<br />catch the change?</h1><p className="v9-production-explanation">Change Proof replays the same selected test<br />against two revisions to show exactly where<br />their behavior diverges.</p></> : head ? <><p className="v9-production-chapter"><span>03</span> CURRENT REVISION</p><h1 id="v9-production-title">At {evidence.test.input},<br />HEAD returns<br /><em>{String(evidence.head.observed)}.</em></h1><p className="v9-production-explanation">The boundary is included.<br />HEAD matches the selected<br />test’s expectation.</p></> : phase === 'selectedTest' ? <><p className="v9-production-chapter"><span>04</span> SELECTED TEST</p><h1 id="v9-production-title">One test.<br />One boundary<br />expectation.</h1><p className="v9-production-explanation">Does the same test<br />reject BASE behavior?</p></> : phase === 'baseReplay' ? <><p className="v9-production-chapter"><span>05</span> BASE REPLAY</p><h1 id="v9-production-title">Same test.<br />Earlier revision.</h1><p className="v9-production-explanation">Replaying the exact boundary<br />against BASE.</p></> : phase === 'mismatch' && reached(state.replayEvent, 'named') ? <><p className="v9-production-chapter"><span>06</span> MISMATCH</p><h1 id="v9-production-title">Same input.<br />Different result.</h1><p className="v9-production-explanation">HEAD returns {String(evidence.head.observed)}.<br />BASE returns {String(evidence.base.observed)}.</p></> : phase === 'verdict' || packet && !state.packetSettled ? <><p className="v9-production-chapter"><span>07</span> VERDICT</p><h1 id="v9-production-title">This test<br />catches the<br />exact change.</h1></> : packet ? <><p className="v9-production-chapter"><span>08</span> PROOF PACKET</p><h1 id="v9-production-title">The proof.<br />In one record.</h1><p className="v9-production-explanation">One selected test.<br />Two recorded revisions.</p></> : null}
          </section>
          <Registration opening /><Registration opening={false} />
        <aside className="v9-live-lens" data-opening={opening} data-shipping={shipping} data-trace-mode={state.traceMode} data-packet-closing={state.packetClosing} data-packet={packet && !state.packetFolded} data-head={head} data-head-event={state.headEvent} data-replay-event={state.replayEvent} data-phase={state.packetFolded ? 'verdict' : phase} aria-label={packet ? 'Shipping boundary proof record' : 'Proof lens'}><header className="v9-live-lens-top"><h2><LensIcon />Proof lens</h2><span className="v9-live-record-heading">CHANGE PROOF <b>/</b> EVIDENCE RECORD</span></header><div className="v9-live-opening-wrap" aria-hidden={!opening && !shipping}><OpeningLens evidence={evidence} state={state} ready={phase === 'traceReady' || shipping} onTrace={onTrace} /></div><div className="v9-live-trace-compact" data-step={state.shippingStep} aria-hidden={!shipping && !(head && (state.headEvent === 'awaiting' || state.headEvent === 'registered'))}>
          <span className="v9-live-label">TRACING {evidence.change.area.toUpperCase()}</span>
          <div data-active={state.shippingStep === 'shipping'} data-located="true"><span>Shipping</span><strong>{state.shippingStep === 'shipping' ? 'active' : 'traced'}</strong></div>
          <div data-active={state.shippingStep === 'implementation'} data-located={state.shippingStep !== 'shipping'}><span>Implementation</span><strong>located</strong></div>
          <div data-active={state.shippingStep === 'test'} data-located={state.shippingStep === 'test'}><span>Selected test</span><strong>located</strong></div>
        </div><div className="v9-live-evidence-wrap" aria-hidden={opening || shipping}><EvidenceLens evidence={evidence} state={state} onReview={onReview} onBase={onBase} onPacket={onPacket} onReturn={onReturn} packetButtonRef={packetButtonRef} /></div></aside>
        {phase === 'verdict' && reached(state.replayEvent, 'resolved') && <button type="button" className="v9-live-replay" onClick={onReplay}>REPLAY FROM START ↺</button>}
        <div className="v9-production-sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      </>}
    </div>
    <div className="v9-production-boot" data-revealed={phase !== 'boot'} aria-hidden={phase !== 'boot'}><strong>CHANGE PROOF</strong><span /><small>EVIDENCE, NOT ASSUMPTION</small></div>
    {bootError && <p className="v9-production-error">This recorded case could not be prepared. <button type="button" onClick={() => window.location.reload()}>Retry</button></p>}
  </main>;
}
