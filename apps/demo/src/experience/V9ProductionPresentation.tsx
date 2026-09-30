import { useEffect, useRef, useState, type RefObject } from 'react';
import type { EvidenceCase } from './evidenceCase';
import { reached, type Presentation } from './presentation';
import './v9-production.css';

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
  onExplore: () => void;
  evidenceUnlocked: boolean;
}

function TestIdentity({ evidence }: { evidence: EvidenceCase }) {
  return <section className="v9-live-test" data-test-identity={evidence.id} aria-label="Selected test">
    <p className="v9-label">SELECTED TEST <span className="v9-test-constant"> / UNCHANGED</span></p>
    <h2><code>{evidence.test.path}</code></h2>
    <dl className="v9-test-values"><div><dt>INPUT</dt><dd>{evidence.test.input}</dd></div><div><dt>EXPECTS</dt><dd>{String(evidence.test.expected)}</dd></div></dl>
  </section>;
}

function Boundary({ evidence }: { evidence: EvidenceCase }) {
  return <div className="v9-boundary"><div><span>BASE</span><code>{evidence.change.baseOperator} {evidence.change.boundary}</code></div><span aria-hidden="true">→</span><div><span>HEAD</span><code>{evidence.change.headOperator} {evidence.change.boundary}</code></div></div>;
}

export function V9ProductionPresentation(props: Props) {
  const { evidence, state, videoRef, packetButtonRef } = props;
  const phase = state.phase;
  const opening = ['orientation', 'recordedChange', 'traceReady'].includes(phase);
  const shipping = phase === 'shippingTransition';
  const head = phase === 'headObservation';
  const selected = phase === 'selectedTest';
  const base = phase === 'baseReplay';
  const mismatch = phase === 'mismatch';
  const verdict = phase === 'verdict';
  const packet = phase === 'proofPacket';
  const intro = opening ? ['reveal', 'settle', 'reframe', 'narrative', 'register'][state.preparationRow] : phase === 'boot' ? 'prelude' : 'complete';
  const beat = opening || phase === 'boot' ? 1 : shipping || head ? 2 : selected || base ? 3 : mismatch || verdict ? 4 : 5;
  const observed = reached(state.replayEvent, 'observed');
  const headConfirmed = ['confirmed', 'settled', 'exiting'].includes(state.headEvent);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const readyActionRef = useRef<HTMLButtonElement>(null);
  const readyAction = phase === 'traceReady' ? 'trace' : head && state.headActionReady ? 'review' : selected ? 'base' : verdict && state.replayEvent === 'resolved' ? 'packet' : '';

  useEffect(() => {
    // Restore keyboard continuity when a phase removes the button that had focus.
    // Never steal focus from Skip, Evidence Trace, or another active control.
    if (readyAction && (document.activeElement === document.body || document.activeElement?.classList.contains('v9-production-viewport'))) {
      (readyAction === 'packet' ? packetButtonRef : readyActionRef).current?.focus({ preventScroll: true });
    }
  }, [readyAction, packetButtonRef]);
  useEffect(() => {
    if (packet && state.packetSettled) returnButtonRef.current?.focus({ preventScroll: true });
  }, [packet, state.packetSettled]);
  useEffect(() => () => { if (copyTimer.current !== null) window.clearTimeout(copyTimer.current); }, []);

  async function copyReference() {
    const previousFocus = document.activeElement as HTMLElement | null;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(evidence.id);
    } catch {
      const input = document.createElement('textarea');
      input.value = evidence.id;
      input.style.cssText = 'position:fixed;inset:0;opacity:0;width:1px;height:1px';
      document.body.appendChild(input);
      input.select();
      const success = document.execCommand('copy');
      input.remove();
      previousFocus?.focus({ preventScroll: true });
      if (!success) return;
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
  }

  const chapter = opening ? '01 / THE CHANGE' : shipping || head ? '02 / HEAD' : selected || base ? '03 / BASE' : mismatch ? '04 / MISMATCH' : verdict ? '04 / VERDICT' : '05 / PROOF RECORD';
  const announcement = phase === 'traceReady' ? 'Shipping changed from greater than 5000 to greater than or equal to 5000. Ready to trace.' : head && headConfirmed ? 'The selected test expects true. HEAD returns true and matches.' : selected ? 'Same test, same input, same expectation. Ready to replay against BASE.' : base && observed ? 'BASE returns false.' : mismatch ? 'HEAD true is not equal to BASE false at the changed boundary.' : verdict ? 'This test catches the exact change.' : packet ? 'Proof record open.' : '';

  return <main className="v9-production-viewport" tabIndex={-1} data-phase={phase} data-replay-event={state.replayEvent} data-paused={state.paused}>
    <div className="v9-production-stage" data-phase={phase} data-media-phase={state.mediaPhase} data-intro={intro} data-shipping-step={state.shippingStep} data-trace-mode={state.traceMode} data-head-event={state.headEvent} data-replay-event={state.replayEvent} data-packet-settled={state.packetSettled} data-packet-closing={state.packetClosing} data-replay-reset={state.replayReset}>
      <div className="v9-media-frame" aria-hidden="true">
        <img className="v9-production-media" src="./cinematic/v9-final/idle-final.png" alt="" onLoad={props.onIdleReady} onError={props.onIdleError} data-visible={state.mediaPhase === 'idle'} />
        <img className="v9-production-media" src="./cinematic/v9-final/head-final.png" alt="" data-visible={state.mediaPhase === 'head'} />
        <img className="v9-production-media" src="./cinematic/v9-final/base-final.png" alt="" data-visible={state.mediaPhase === 'base'} />
        <video ref={videoRef} className="v9-production-media" src="./cinematic/v9-final/shipping-final-3840x1440-60fps.mp4" poster="./cinematic/v9-final/idle-final.png" preload="auto" muted playsInline onCanPlay={props.onVideoReady} onError={props.onVideoError} onTimeUpdate={event => props.onVideoTime(event.currentTarget.currentTime)} onEnded={props.onVideoEnd} data-visible={state.mediaPhase === 'shipping' || state.mediaPhase === 'headToBase'} />
      </div>
      <div className="v9-production-tonal-field" aria-hidden="true" />
      <div className="v9-opening-veil" aria-hidden="true" />
      <div className="v9-replay-curtain" aria-hidden="true" />
      <header className="v9-production-masthead"><span className="v9-production-brand">CHANGE PROOF</span><span className="v9-production-context">SHIPPING / BOUNDARY CHECK</span></header>
      {phase !== 'boot' && <>
        <ol className="v9-phase-rail" aria-label="Proof sequence">
          {['CHANGE', 'HEAD', 'BASE', 'MISMATCH', 'RECORD'].map((label, index) => <li key={label} aria-current={beat === index + 1 ? 'step' : undefined} data-complete={beat > index + 1}><span>0{index + 1}</span>{label}</li>)}
        </ol>
        <div className="v9-case-anchor"><span>RECORDED SHIPPING BOUNDARY</span><code>{evidence.change.baseOperator} {evidence.change.boundary} <i>→</i> {evidence.change.headOperator} {evidence.change.boundary}</code></div>
        <header className="v9-production-narrative">
          <div className="v9-narrative-copy" key={opening ? 'opening' : phase}>
            <p className="v9-label">{chapter}</p>
            <h1>{opening ? <>Does this test<br />catch the change?</> : shipping ? <>Trace the<br />recorded change.</> : head ? <>One test.<br />Expectation met.</> : selected || base ? <>Same test.<br />Earlier revision.</> : mismatch ? <>One boundary.<br />Two behaviors.</> : verdict ? <>This test catches<br />the exact change.</> : <>Proof<br />record.</>}</h1>
          </div>
        </header>
        {opening && <section className="v9-opening-change" aria-label="Recorded change">
          <p className="v9-label">RECORDED CHANGE</p><h2>{evidence.change.area}</h2><Boundary evidence={evidence} />
          <p className="v9-opening-note">One boundary changed. Replay one selected test<br />against both implementations to see what it catches.</p>
        </section>}
        {shipping && <section className="v9-trace-target" aria-label="Tracing the recorded change">
          <div data-active={state.shippingStep === 'shipping'} data-located="true"><span>01</span><div><p className="v9-label">RECORDED CHANGE</p><strong>Shipping boundary</strong></div></div>
          <div data-active={state.shippingStep === 'implementation'} data-located={state.shippingStep !== 'shipping'}><span>02</span><div><p className="v9-label">IMPLEMENTATION</p><code>{state.shippingStep === 'shipping' ? 'Following the recorded change…' : evidence.head.implementationPath}</code></div></div>
          <div data-active={state.shippingStep === 'test'} data-located={state.shippingStep === 'test'}><span>03</span><div><p className="v9-label">SELECTED TEST</p><code>{state.shippingStep === 'test' ? evidence.test.path : 'Locating the boundary test…'}</code></div></div>
          <p className="v9-trace-status" role="status">{state.shippingStep === 'test' ? 'Test located. Reading HEAD behavior.' : 'Following one recorded change to one selected test.'}</p>
        </section>}
        {/* The test is one retained DOM object throughout HEAD and BASE. */}
        <div className="v9-live-experiment" hidden={opening || shipping}>
          <TestIdentity evidence={evidence} />
          {head && <section className="v9-observation" data-result-ready={headConfirmed} aria-label="HEAD observation">
            <p className="v9-label">HEAD <span className="v9-observed-label">/ OBSERVED</span></p><code className="v9-operation">{evidence.test.input} {evidence.change.headOperator} {evidence.change.boundary}</code>
            {headConfirmed ? <><strong className="v9-result v9-true">{String(evidence.head.observed).toUpperCase()}</strong><p>Matches the selected test’s expectation.</p></> : <p>Reading the recorded HEAD result…</p>}
          </section>}
          {(selected || base) && <div className="v9-continuity"><p>SAME TEST <span>·</span> SAME INPUT <span>·</span> SAME EXPECTATION</p><span>{selected ? 'HEAD returned true. Change only the implementation.' : 'HEAD → BASE / only implementation changes'}</span></div>}
          {base && <section className="v9-observation" aria-label="BASE observation"><p className="v9-label">BASE <span className="v9-observed-label">/ {observed ? 'OBSERVED' : 'REPLAYING'}</span></p><code className="v9-operation">{evidence.test.input} {evidence.change.baseOperator} {evidence.change.boundary}</code>{observed ? <><strong className="v9-result v9-false">{String(evidence.base.observed).toUpperCase()}</strong><p>The test still expects true.</p></> : <><strong className="v9-evaluating">Replaying…</strong><p>Only the implementation changed.</p></>}</section>}
          {(mismatch || verdict || packet) && <section className="v9-comparison" aria-label="HEAD true differs from BASE false">
            <div className="v9-comparison-head"><span>HEAD <small>OBSERVED</small></span><code>{evidence.test.input} {evidence.change.headOperator} {evidence.change.boundary}</code><strong className="v9-true">{String(evidence.head.observed).toUpperCase()}</strong><p>Matches expectation</p></div>
            <b className="v9-divergence-axis" aria-hidden="true"><span>≠</span></b>
            <div className="v9-comparison-base"><span>BASE <small>OBSERVED</small></span><code>{evidence.test.input} {evidence.change.baseOperator} {evidence.change.boundary}</code><strong className="v9-false">{String(evidence.base.observed).toUpperCase()}</strong><p>Does not match</p></div>
          </section>}
        </div>
        {(mismatch || verdict) && <section className="v9-localized-boundary"><p className="v9-label">AT THE EXACT SHIPPING BOUNDARY</p><Boundary evidence={evidence} /><p>The same selected test distinguishes BASE from HEAD.</p></section>}
        {(mismatch || verdict) && <p className="v9-comparison-constant">ONE SELECTED TEST / TWO IMPLEMENTATIONS</p>}
        {packet && <section className="v9-proof-record" aria-label="Shipping boundary proof record">
          <div className="v9-record-change"><p className="v9-label">RECORDED CHANGE</p><h2>Shipping boundary</h2><Boundary evidence={evidence} /></div>
          <dl className="v9-record-reference"><div><dt>Implementation</dt><dd><code>{evidence.head.implementationPath}</code></dd></div><div><dt>Case reference</dt><dd><code>{evidence.id}</code></dd></div></dl>
          <p className="v9-record-conclusion">This test catches<br />the exact change.</p>
          <div className="v9-record-status"><span>COMPARISON COMPLETE</span><p>One selected test.<br />Two recorded revisions.<br />One observable divergence.</p></div>
          <footer className="v9-live-packet-actions"><button ref={returnButtonRef} type="button" onClick={() => { setCopied(false); props.onReturn(); }}>← RETURN TO VERDICT</button><button type="button" onClick={copyReference} aria-live="polite">{copied ? 'COPIED' : 'COPY PROOF REFERENCE'} ↗</button></footer>
        </section>}
        <div className="v9-scene-action">
          {phase === 'traceReady' && <button ref={readyActionRef} className="v9-live-action" type="button" onClick={props.onTrace}>TRACE SHIPPING <span aria-hidden="true">→</span></button>}
          {opening && phase !== 'traceReady' && <p className="v9-label">PREPARING RECORDED CASE…</p>}
          {head && <button ref={readyActionRef} className="v9-live-action" type="button" disabled={!state.headActionReady} onClick={props.onReview}>REVIEW SELECTED TEST <span aria-hidden="true">→</span></button>}
          {selected && <button ref={readyActionRef} className="v9-live-action" type="button" onClick={props.onBase}>REPLAY AGAINST BASE <span aria-hidden="true">→</span></button>}
          {verdict && <><button ref={packetButtonRef} className="v9-live-action" type="button" disabled={state.replayEvent !== 'resolved'} onClick={props.onPacket}>VIEW PROOF RECORD <span aria-hidden="true">→</span></button><button type="button" className="v9-live-replay" onClick={props.onReplay}>REPLAY FROM START ↺</button></>}
        </div>
        <div className="v9-production-sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      </>}
      <button type="button" className="v9-evidence-escape" onClick={props.onExplore}>{props.evidenceUnlocked ? 'EXPLORE THE EVIDENCE ↓' : 'SKIP TO EVIDENCE ↓'}</button>
      {state.paused && <button type="button" className="v9-resume" onClick={props.onReplay}>REPLAY FROM START ↺</button>}
    </div>
    <div className="v9-production-boot" data-visible={phase === 'boot'} aria-hidden={phase !== 'boot'}><strong>CHANGE PROOF</strong><small>EVIDENCE, NOT ASSUMPTION</small></div>
    {props.bootError && <p className="v9-production-error">This recorded case could not be prepared. <button type="button" onClick={() => window.location.reload()}>Retry</button></p>}
  </main>;
}
