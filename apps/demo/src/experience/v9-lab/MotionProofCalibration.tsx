import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './proof-sequence-calibration.css';
import './motion-proof-calibration.css';

gsap.registerPlugin(CustomEase);
CustomEase.create('proofTransfer', '.45,0,.2,1');

// One clock owns both semantic events and visual interpolation. These labels are
// also the integration points for future physical M5 media (no media clock yet).
const events = {
  selected: 0, release: .16, transfer: .44, baseRegistered: 1.24,
  evaluating: 1.54, baseObserved: 2.14, comparison: 2.56,
  comparisonHold: 2.94, mismatch: 3.24, mismatchHold: 3.64,
  verdict: 5.64, complete: 6.24,
} as const;
type Event = keyof typeof events;

declare global {
  interface Window {
    __v9MotionProof?: {
      events: Record<Event, number>; duration: number; reduced: boolean;
      seek: (seconds: number) => void; play: () => void; reset: () => void;
    };
  }
}

const narratives = [
  ['04', 'SELECTED TEST', 'One test.', 'One boundary', 'expectation.', 'Does the same test', 'reject BASE behavior?'],
  ['05', 'BASE REPLAY', 'Same test.', 'Earlier revision.', '', 'Replaying the exact boundary', 'against BASE.'],
  ['06', 'MISMATCH', 'Same input.', 'Different result.', '', 'HEAD returns true.', 'BASE returns false.'],
  ['07', 'VERDICT', 'This test', 'catches the', 'exact change.', '', ''],
];

export function MotionProofCalibration() {
  const rootRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const started = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const q = (name: string) => root.querySelector<HTMLElement>(`.${name}`)!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Preserve the observation/comparison reading pauses in the shorter version.
    const e = reduced ? {
      selected: 0, release: .12, transfer: .22, baseRegistered: .34,
      evaluating: .46, baseObserved: .76, comparison: 1.18,
      comparisonHold: 1.3, mismatch: 1.6, mismatchHold: 1.82,
      verdict: 3.82, complete: 4.04,
    } : events;
    const action = q('v9-proof__action') as HTMLButtonElement;
    const text = (selector: string, value: string) => {
      const el = q(selector);
      if (el.textContent !== value) el.textContent = value;
    };
    const renderSemantics = (t: number) => {
      const semantic = (Object.keys(e) as Event[]).filter(key => t >= e[key]).at(-1)!;
      root.dataset.event = semantic;
      root.dataset.time = t.toFixed(3);
      const chapter = t >= e.verdict + (e.complete - e.verdict) * .45 ? 3
        : t >= e.mismatch + (e.mismatchHold - e.mismatch) * .45 ? 2
        : t >= e.transfer + .18 * (reduced ? .3 : 1) ? 1 : 0;
      const copy = narratives[chapter];
      ['motion-number', 'motion-chapter', 'motion-line-1', 'motion-line-2', 'motion-line-3', 'motion-explanation-1', 'motion-explanation-2']
        .forEach((selector, i) => text(selector, copy[i]));
      text('motion-head-caption', t < e.release ? 'observed' : 'recorded');
      text('motion-result', t >= e.baseObserved ? 'false' : t >= e.baseRegistered ? 'evaluating' : '—');
      root.dataset.base = t >= e.baseObserved ? 'observed' : t >= e.baseRegistered ? 'evaluating' : 'waiting';
      text('motion-action-label', t >= e.verdict ? 'VIEW PROOF RECORD' : 'REPLAY AGAINST BASE');
      action.disabled = t > 0;
      // The retained endpoint action is a visual reference; packet navigation is
      // outside this calibration. R resets the instrument for manual recording.
    };
    const context = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut', autoRound: false }, onUpdate: () => renderSemantics(tl.time()) });
      timelineRef.current = tl;
      Object.entries(e).forEach(([name, time]) => tl.addLabel(name, time));
      const tween = (selector: string, vars: gsap.TweenVars, at: number) => tl.to(q(selector), vars, at);
      const travel = (value: number) => reduced ? 0 : value;
      const settle = e.evaluating - e.baseRegistered;
      // Acknowledgement belongs to the footer, before any narrative movement.
      tween('v9-proof__action', { opacity: .22, duration: e.release }, 0);
      tween('v9-proof__action', { opacity: 0, duration: e.transfer - e.release }, e.release);
      tween('v9-proof__registration', { opacity: 0, duration: e.transfer - e.release }, e.release);
      tween('v9-proof__route-head', { stroke: '#81958b', strokeWidth: 1.5, duration: e.transfer - e.release }, e.release);
      tween('v9-proof__head-observation', { borderColor: '#81958b', '--head-fill': 0, duration: e.transfer - e.release }, e.release);
      tween('motion-head-title', { color: '#d0d8de', duration: e.transfer - e.release }, e.release);
      tween('motion-bracket', { y: travel(210), duration: e.transfer - e.release }, e.release);
      // The same identity moves 32px to the approved BASE position. Its bracket
      // follows the bottom rule and registers on BASE; neither object is copied.
      ['v9-proof__test', 'v9-proof__routes', 'v9-proof__observations'].forEach(name =>
        tween(name, { y: travel(32), duration: e.baseRegistered - e.transfer, ease: 'proofTransfer' }, e.transfer));
      tween('motion-bracket', { x: travel(461), rotationY: travel(180), duration: e.baseRegistered - e.transfer, ease: 'proofTransfer' }, e.transfer);
      tween('motion-base-route-active', { strokeDashoffset: 0, duration: e.baseRegistered - e.transfer, ease: 'proofTransfer' }, e.transfer);
      tween('v9-proof__lens', { height: 723.6875, duration: e.evaluating - e.transfer, ease: 'proofTransfer' }, e.transfer);
      tween('motion-bracket', { y: 0, duration: settle }, e.baseRegistered);
      tween('v9-proof__base-observation', { borderColor: '#83a6ff', '--base-fill': .1255, duration: settle }, e.baseRegistered);
      tween('motion-base-title', { color: '#aac3ff', duration: settle }, e.baseRegistered);
      tween('motion-base-caption', { opacity: 0, duration: .08 }, e.baseRegistered - .08);
      tween('v9-proof__operator', { opacity: 1, duration: settle }, e.baseRegistered);
      tween('v9-proof__replay-note', { opacity: 1, duration: settle }, e.baseRegistered);
      // One restrained execution emphasis within the instrument, no looping UI.
      tween('motion-execution-mark', { opacity: 1, duration: (e.baseObserved - e.evaluating) / 2 }, e.evaluating);
      tween('motion-execution-mark', { opacity: 0, duration: (e.baseObserved - e.evaluating) / 2 }, (e.evaluating + e.baseObserved) / 2);
      tween('v9-proof__operator', { opacity: 0, duration: .1 }, e.baseObserved - .1);
      tl.set(q('motion-base-caption'), { textContent: 'observed' }, e.baseObserved);
      tween('motion-base-caption', { opacity: 1, duration: .08 }, e.baseObserved);
      // false is neutral for 1.1 seconds before localization starts. The first
      // 420ms has no camera, layout, path, or narrative movement.
      tween('v9-proof__replay-note', { opacity: 0, duration: .14 }, e.comparison);
      ['v9-proof__test', 'v9-proof__routes', 'v9-proof__observations'].forEach(name =>
        tween(name, { y: 0, duration: e.comparisonHold - e.comparison }, e.comparison));
      tween('motion-bracket', { x: 0, rotationY: 0, duration: e.comparisonHold - e.comparison }, e.comparison);
      tween('v9-proof__lens', { height: 775.578125, duration: e.comparisonHold - e.comparison }, e.comparison);
      tween('v9-proof__true', { fontSize: 46, duration: e.comparisonHold - e.comparison }, e.comparison);
      tl.fromTo(q('motion-result'), { fontSize: 35 }, { fontSize: 46, duration: e.comparisonHold - e.comparison, immediateRender: false }, e.comparison);
      tween('motion-comparison-path', { strokeDashoffset: 0, duration: e.comparisonHold - e.comparison }, e.comparison);
      tween('motion-comparison-dot', { opacity: 1, duration: .1 }, e.comparisonHold - .1);
      tween('motion-base-route-active', { stroke: '#a9b8c2', strokeWidth: 1.5, duration: .2 }, e.comparison);
      tween('v9-proof__base-observation', { borderColor: '#7b8a93', '--base-fill': 0, duration: .2 }, e.comparison);
      tween('motion-base-title', { color: '#d0d8de', duration: .2 }, e.comparison);
      tween('v9-proof__route-head', { stroke: '#83a6ff', strokeWidth: 2, duration: .2 }, e.comparison);
      tween('v9-proof__head-observation', { borderColor: '#7da3ff', duration: .2 }, e.comparison);
      tween('motion-head-title', { color: '#aac3ff', duration: .2 }, e.comparison);
      tl.fromTo(q('motion-result'), { color: '#d0d8de' }, { color: '#e799c0', duration: reduced ? .12 : .22, immediateRender: false }, e.mismatch);
      tween('motion-comparison-dot', { fill: '#e799c0', duration: reduced ? .12 : .22 }, e.mismatch);
      tween('motion-equation', { opacity: 1, y: 0, duration: reduced ? .12 : .22 }, e.mismatch);
      // Verdict returns exactly to the locked layout; the shell's top never moves.
      tween('v9-proof__comparison', { opacity: 0, duration: (e.complete - e.verdict) * .5 }, e.verdict);
      tween('v9-proof__lens', { height: 761.28125, duration: e.complete - e.verdict }, e.verdict);
      tween('v9-proof__routes', { scaleY: .8, transformOrigin: 'top', duration: e.complete - e.verdict }, e.verdict);
      tween('v9-proof__observations', { y: reduced ? 0 : -16, duration: e.complete - e.verdict }, e.verdict);
      tween('v9-proof__true', { fontSize: 35, duration: e.complete - e.verdict }, e.verdict);
      tween('motion-result', { fontSize: 35, duration: e.complete - e.verdict }, e.verdict);
      ['motion-head-caption', 'motion-base-caption'].forEach(name => tween(name, { opacity: 0, duration: .15 }, e.verdict));
      tween('v9-proof__boundary', { opacity: 1, y: 0, duration: (e.complete - e.verdict) * .6 }, e.verdict + (e.complete - e.verdict) * .4);
      tl.set(q('v9-proof__action'), { y: 88.390625 }, e.verdict);
      tween('v9-proof__action', { opacity: 1, duration: (e.complete - e.verdict) * .6 }, e.verdict + (e.complete - e.verdict) * .4);
      // Each editorial change uses the existing h1/paragraph/chapter elements.
      // All lines move together; text changes only while fully transparent.
      const editorial = (at: number, duration: number) => {
        tween('motion-editorial', { opacity: 0, y: travel(-9), duration: duration * .45 }, at);
        tl.set(q('motion-editorial'), { y: travel(9) }, at + duration * .45);
        tween('motion-editorial', { opacity: 1, y: 0, duration: duration * .55 }, at + duration * .45);
      };
      editorial(e.transfer, reduced ? .12 : .4);
      editorial(e.mismatch, e.mismatchHold - e.mismatch);
      editorial(e.verdict, e.complete - e.verdict);
      window.__v9MotionProof = {
        events: e, duration: e.complete, reduced,
        seek: seconds => { started.current = seconds > 0; tl.pause().time(seconds, false); renderSemantics(tl.time()); },
        play: () => { if (!started.current) { started.current = true; action.disabled = true; tl.play(0); } },
        reset: () => { started.current = false; tl.pause(0, false); renderSemantics(0); },
      };
      renderSemantics(0);
    }, root);
    const keys = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') window.__v9MotionProof?.reset();
      if (event.code === 'Space' && event.target === document.body) { event.preventDefault(); window.__v9MotionProof?.play(); }
    };
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('keydown', keys); context.revert(); timelineRef.current = null; delete window.__v9MotionProof; };
  }, []);

  return <main ref={rootRef} className="v9-proof v9-motion" data-event="selected">
    <img className="v9-proof__scene" src="/cinematic/shipping-final/open.png" alt="Physical HEAD machine, unchanged throughout this calibration." />
    <div className="v9-proof__tonal-field" aria-hidden="true" />
    <header className="v9-proof__masthead">
      <div className="v9-proof__brand"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7h13v10H5m13-10h9v18H14v-8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg><span>CHANGE PROOF</span></div>
      <span className="v9-proof__context">SHIPPING <span>/</span> BOUNDARY CHECK</span>
    </header>
    <section className="v9-proof__narrative">
      <div className="motion-editorial">
        <p className="v9-proof__chapter"><span className="motion-number">04</span><b className="motion-chapter">SELECTED TEST</b></p>
        <h1><span className="motion-line-1">One test.</span><span className="motion-line-2">One boundary</span><span className="motion-line-3">expectation.</span></h1>
        <p className="v9-proof__explanation"><span className="motion-explanation-1">Does the same test</span><span className="motion-explanation-2">reject BASE behavior?</span></p>
      </div>
    </section>
    <svg className="v9-proof__registration" viewBox="0 0 2560 1440" fill="none" aria-hidden="true"><path d="M1390 1080h434a20 20 0 0 0 20-20V435a20 20 0 0 1 20-20h56" /><circle cx="1390" cy="1080" r="3" /></svg>
    <aside className="v9-proof__lens" aria-label="Proof lens">
      <header className="v9-proof__lens-top"><h2><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>Proof lens</h2></header>
      <div className="v9-proof__body">
        <div className="v9-proof__test" data-test-identity="checkout-boundary">
          <i className="motion-bracket" aria-hidden="true" />
          <p className="v9-proof__label">ONE SELECTED TEST</p>
          <div className="v9-proof__filename"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H5v18h14V8Zm0 0v5h5M8 13l2 2-2 2m5 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg><code>test/checkout.test.js</code></div>
          <div className="v9-proof__values"><div><span className="v9-proof__label">INPUT</span><strong>5000</strong></div><div><span className="v9-proof__label">EXPECTS</span><strong>true</strong></div></div>
        </div>
        <svg className="v9-proof__routes" viewBox="0 0 410 80" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path className="v9-proof__stem" d="M205 0v24" /><path className="v9-proof__route-head" d="M205 24v4q0 10-10 10h-83q-10 0-10 10v32" />
          <path className="v9-proof__route-base" d="M205 24v4q0 10 10 10h83q10 0 10 10v32" />
          <path className="motion-base-route-active" pathLength="1" d="M205 24v4q0 10 10 10h83q10 0 10 10v32" /><circle cx="205" cy="24" r="3" fill="#c2ccd3" />
        </svg>
        <div className="v9-proof__observations">
          <div className="v9-proof__head-observation"><h3 className="motion-head-title">HEAD</h3><strong className="v9-proof__true">true</strong><span className="v9-proof__caption motion-head-caption">observed</span></div>
          <div className="v9-proof__base-observation"><h3 className="motion-base-title">BASE</h3><strong className="motion-result">—</strong><span className="motion-execution-mark" aria-hidden="true" /><span className="v9-proof__caption motion-base-caption">not replayed</span><span className="v9-proof__operator">OPERATOR <code>&gt;</code></span></div>
        </div>
        <p className="v9-proof__replay-note">Same input. Same expectation.</p>
        <div className="v9-proof__comparison"><svg viewBox="0 0 410 70" fill="none" aria-hidden="true"><path className="motion-comparison-path" pathLength="1" d="M102 0v12q0 9 10 9h70q23 0 23 23v26M308 0v12q0 9-10 9h-70q-23 0-23 23" stroke="#a9b8c2" strokeWidth="1.5" /><circle className="motion-comparison-dot" cx="205" cy="44" r="3" fill="#a9b8c2" /></svg><div className="motion-equation"><p className="v9-proof__compare-label">COMPARE TO EXPECTATION</p><p className="v9-proof__equation"><span>false</span> <b>≠</b> true</p></div></div>
        <div className="v9-proof__boundary"><p className="v9-proof__label">SHIPPING BOUNDARY</p><p><code>&gt; 5000</code><span>→</span><code>&gt;= 5000</code></p></div>
      </div>
      <button className="v9-proof__action" type="button" onClick={() => window.__v9MotionProof?.play()} title="Play calibration. Press R to reset."><span className="motion-action-label">REPLAY AGAINST BASE</span><svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M3 12h25m-8-8 8 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
    </aside>
  </main>;
}
