import { useCallback, useEffect, useRef, useState } from 'react';
import { shippingEvidence } from './evidenceCase';
import { V9ProductionPresentation } from './V9ProductionPresentation';
import { PostHeroContent } from './PostHeroContent';
import { initialPresentation, type Presentation, type ShippingStep } from './presentation';
import finalMediaEvents from './finalMediaEvents.json';
import '@fontsource-variable/sora/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

const ASSET = {
  idle: './cinematic/v9-final/idle-final.png',
  open: './cinematic/v9-final/head-final.png',
  shipping: './cinematic/v9-final/shipping-final-3840x1440-60fps.mp4',
  base: './cinematic/v9-final/head-to-base-final-3840x1440-60fps.mp4',
};

const eventTime = (film: 'shipping' | 'base', name: string) => {
  const event = finalMediaEvents.films[film].events.find((entry) => entry.name === name);
  if (!event) throw new Error(`Missing final media event: ${name}`);
  return event.time_seconds;
};

type ClockEvent = { at: number; commit: () => void };
type Clock = { events: ClockEvent[]; elapsed: number; last: number; next: number; frame: number; active: boolean };

export function ExperiencePrototype() {
  const [state, setState] = useState<Presentation>(initialPresentation);
  const stateRef = useRef(state);
  const [fontsReady, setFontsReady] = useState(false);
  const [idleReady, setIdleReady] = useState(false);
  const [idleFailed, setIdleFailed] = useState(false);
  const [openReady, setOpenReady] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [videoState, setVideoState] = useState<'pending' | 'ready' | 'failed'>('pending');
  const bootStarted = useRef(false);
  const clockRef = useRef<Clock | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const packetButtonRef = useRef<HTMLButtonElement>(null);
  const actionLocked = useRef(false);
  const reduceMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const resourcesReady = fontsReady && idleReady && openReady && videoState !== 'pending';
  const evidenceValid = Boolean(shippingEvidence.id && shippingEvidence.change.area && shippingEvidence.test.path && Number.isFinite(shippingEvidence.test.input));

  const commit = useCallback((patch: Partial<Presentation>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
  }, []);

  const cancelSequence = useCallback(() => {
    const clock = clockRef.current;
    if (clock) { clock.active = false; window.cancelAnimationFrame(clock.frame); }
    clockRef.current = null;
  }, []);

  const startSequence = useCallback((events: ClockEvent[]) => {
    cancelSequence();
    const clock: Clock = { events, elapsed: 0, last: performance.now(), next: 0, frame: 0, active: true };
    clockRef.current = clock;
    const tick = (now: number) => {
      if (!clock.active) return;
      if (!document.hidden && !stateRef.current.paused) clock.elapsed += now - clock.last;
      clock.last = now;
      while (clock.next < clock.events.length && clock.elapsed >= clock.events[clock.next].at) {
        clock.events[clock.next].commit();
        clock.next += 1;
      }
      if (clock.next < clock.events.length) clock.frame = window.requestAnimationFrame(tick);
      else { clock.active = false; if (clockRef.current === clock) clockRef.current = null; }
    };
    clock.frame = window.requestAnimationFrame(tick);
  }, [cancelSequence]);

  useEffect(() => {
    document.documentElement.classList.remove('cp-preboot');
    let active = true;
    const fontFallback = window.setTimeout(() => { if (active) setFontsReady(true); }, 4000);
    const videoFallback = window.setTimeout(() => { if (active) setVideoState((value) => value === 'pending' ? 'failed' : value); }, 10000);
    void Promise.allSettled([
      document.fonts.load('500 24px "Sora Variable"'),
      document.fonts.load('500 28px "IBM Plex Mono"'),
    ]).then(() => { if (active) setFontsReady(true); });
    const open = new Image();
    open.onload = () => { if (active) setOpenReady(true); };
    open.onerror = () => { if (active) { setOpenFailed(true); setOpenReady(true); } };
    open.src = ASSET.open;
    return () => { active = false; window.clearTimeout(fontFallback); window.clearTimeout(videoFallback); };
  }, []);

  const startPreparation = useCallback((fromBoot: boolean) => {
    const start = fromBoot ? (reduceMotion.current ? 900 : 1100) : 0;
    const step = reduceMotion.current ? 120 : 540;
    startSequence([
      { at: start, commit: () => commit({ phase: 'orientation', preparationRow: 0 }) },
      { at: start + 350, commit: () => commit({ preparationRow: 1, replayReset: false }) },
      { at: start + 350 + step, commit: () => commit({ preparationRow: 2 }) },
      { at: start + 350 + step * 2, commit: () => commit({ preparationRow: 3 }) },
      { at: start + 350 + step * 3, commit: () => commit({ preparationRow: 4 }) },
      { at: start + 350 + step * 3 + (reduceMotion.current ? 450 : 1100), commit: () => commit({ phase: 'traceReady' }) },
    ]);
  }, [startSequence, commit]);

  useEffect(() => {
    if (!resourcesReady || !evidenceValid || openFailed || bootStarted.current) return;
    bootStarted.current = true;
    startPreparation(true);
  }, [resourcesReady, evidenceValid, openFailed, startPreparation]);

  useEffect(() => {
    const handleVisibility = () => {
      if (clockRef.current) clockRef.current.last = performance.now();
      const video = videoRef.current;
      if (!video || !['shippingTransition', 'baseReplay'].includes(stateRef.current.phase)) return;
      if (document.hidden) video.pause();
      else if (!stateRef.current.paused && videoState === 'ready' && !reduceMotion.current) void video.play().catch(() => setVideoState('failed'));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [videoState]);

  useEffect(() => () => { cancelSequence(); videoRef.current?.pause(); }, [cancelSequence]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.requestVideoFrameCallback) return;
    let active = true;
    const frame = () => {
      if (!active) return;
      mediaLandmark(video.currentTime);
      video.requestVideoFrameCallback(frame);
    };
    video.requestVideoFrameCallback(frame);
    return () => { active = false; };
  });

  function shippingLandmark(time: number) {
    if (stateRef.current.phase !== 'shippingTransition' || stateRef.current.mediaPhase !== 'shipping') return;
    const step: ShippingStep = time < eventTime('shipping', 'shipping.implementation_visible') ? 'shipping' : time < eventTime('shipping', 'shipping.selected_test_visible') ? 'implementation' : 'test';
    if (stateRef.current.shippingStep !== step) commit({ shippingStep: step });
    if (time >= eventTime('shipping', 'shipping.head_registration') && stateRef.current.headEvent === 'awaiting') commit({ headEvent: 'registered' });
  }

  function baseLandmark(time: number) {
    if (stateRef.current.phase !== 'baseReplay' || stateRef.current.mediaPhase !== 'headToBase') return;
    if (time >= eventTime('base', 'base.evaluation') && !stateRef.current.baseEvaluated) commit({ baseEvaluated: true });
    if (time >= eventTime('base', 'base.false_visible') && !stateRef.current.baseFalseVisible) commit({ baseFalseVisible: true });
    const event = time < eventTime('base', 'base.operator_release') ? 'idle'
      : time < eventTime('base', 'base.revision_swap') ? 'released'
      : time < eventTime('base', 'base.registration') ? 'transferring'
      : 'observed';
    if (stateRef.current.replayEvent !== event) commit({ replayEvent: event });
  }

  function mediaLandmark(time: number) {
    if (stateRef.current.phase === 'shippingTransition') shippingLandmark(time);
    else if (stateRef.current.phase === 'baseReplay') baseLandmark(time);
  }

  function finishShipping() {
    if (stateRef.current.phase !== 'shippingTransition') return;
    commit({ phase: 'headObservation', mediaPhase: 'head', shippingStep: 'test', headEvent: reduceMotion.current ? 'awaiting' : 'registered', headActionReady: false });
    const motion = reduceMotion.current;
    startSequence([
      { at: motion ? 50 : 0, commit: () => commit({ headEvent: 'registered' }) },
      { at: motion ? 160 : 980, commit: () => commit({ headEvent: 'legible' }) },
      { at: motion ? 300 : 1320, commit: () => commit({ headEvent: 'confirmed' }) },
      { at: motion ? 460 : 1740, commit: () => commit({ headEvent: 'settled', headActionReady: true }) },
    ]);
  }

  function playShipping() {
    if (stateRef.current.phase !== 'traceReady' || actionLocked.current) return;
    actionLocked.current = true;
    commit({ phase: 'shippingTransition', mediaPhase: reduceMotion.current ? 'head' : 'shipping', shippingStep: 'shipping', traceMode: 'retracting', headEvent: 'awaiting' });
    const video = videoRef.current;
    if (reduceMotion.current || videoState !== 'ready' || !video) {
      startSequence([{ at: 120, commit: finishShipping }]);
      return;
    }
    startSequence([
      { at: 180, commit: () => commit({ traceMode: 'contracting' }) },
      { at: 760, commit: () => commit({ traceMode: 'compact' }) },
    ]);
    video.currentTime = 0;
    video.playbackRate = finalMediaEvents.playbackRate;
    void video.play().catch(() => { setVideoState('failed'); finishShipping(); });
  }

  function reviewTest() {
    if (stateRef.current.phase !== 'headObservation' || !stateRef.current.headActionReady) return;
    commit({ phase: 'selectedTest' });
  }

  function replayBase() {
    if (stateRef.current.phase !== 'selectedTest') return;
    commit({ phase: 'baseReplay', mediaPhase: reduceMotion.current ? 'base' : 'headToBase', replayEvent: 'idle', baseEvaluated: false, baseFalseVisible: false });
    const reduced: ClockEvent[] = [
      { at: 120, commit: () => commit({ replayEvent: 'released' }) },
      { at: 220, commit: () => commit({ replayEvent: 'transferring' }) },
      { at: 340, commit: () => commit({ replayEvent: 'registered' }) },
      { at: 460, commit: () => commit({ replayEvent: 'evaluating' }) },
      { at: 760, commit: () => commit({ replayEvent: 'observed' }) },
      { at: 1180, commit: () => commit({ replayEvent: 'comparing' }) },
      { at: 1300, commit: () => commit({ replayEvent: 'compared' }) },
      { at: 1600, commit: () => commit({ replayEvent: 'localized', phase: 'mismatch' }) },
      { at: 1820, commit: () => commit({ replayEvent: 'named' }) },
      { at: 3820, commit: () => commit({ phase: 'verdict' }) },
      { at: 4040, commit: () => commit({ replayEvent: 'resolved' }) },
    ];
    if (reduceMotion.current) { commit({ baseEvaluated: true, baseFalseVisible: true }); startSequence(reduced); return; }
    const video = videoRef.current;
    if (!video) { finishBase(); return; }
    video.pause();
    video.poster = ASSET.open;
    video.src = ASSET.base;
    video.currentTime = 0;
    video.playbackRate = finalMediaEvents.playbackRate;
    const play = () => {
      if (stateRef.current.phase === 'baseReplay') void video.play().catch(finishBase);
    };
    video.addEventListener('loadeddata', play, { once: true });
    video.load();
  }

  function finishBase() {
    if (stateRef.current.phase !== 'baseReplay') return;
    commit({ mediaPhase: 'base', replayEvent: 'observed', baseEvaluated: true, baseFalseVisible: true });
    startSequence([
      { at: 250, commit: () => commit({ replayEvent: 'comparing' }) },
      { at: 630, commit: () => commit({ replayEvent: 'compared' }) },
      { at: 930, commit: () => commit({ replayEvent: 'localized', phase: 'mismatch' }) },
      { at: 1330, commit: () => commit({ replayEvent: 'named' }) },
      { at: 3330, commit: () => commit({ phase: 'verdict' }) },
      { at: 3930, commit: () => commit({ replayEvent: 'resolved' }) },
    ]);
  }

  function openPacket() {
    if (stateRef.current.phase !== 'verdict' || stateRef.current.replayEvent !== 'resolved') return;
    commit({ phase: 'proofPacket', packetSettled: false, packetClosing: false, packetFolded: false });
    startSequence([{ at: reduceMotion.current ? 80 : 850, commit: () => commit({ packetSettled: true }) }]);
  }

  function returnToVerdict() {
    if (stateRef.current.phase !== 'proofPacket' || stateRef.current.packetClosing) return;
    cancelSequence();
    commit({ packetClosing: true, packetSettled: false });
    startSequence([
      { at: reduceMotion.current ? 20 : 180, commit: () => commit({ packetFolded: true }) },
      { at: reduceMotion.current ? 80 : 800, commit: () => {
      commit({ phase: 'verdict', packetClosing: false, packetFolded: false });
      window.requestAnimationFrame(() => packetButtonRef.current?.focus({ preventScroll: true }));
    } }]);
  }

  function replay() {
    cancelSequence();
    videoRef.current?.pause();
    if (videoRef.current) {
      videoRef.current.src = ASSET.shipping;
      videoRef.current.poster = ASSET.idle;
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = finalMediaEvents.playbackRate;
      videoRef.current.load();
    }
    actionLocked.current = false;
    // Replay keeps the loaded stage and Lens mounted. Boot belongs to fresh entry only.
    commit({ ...initialPresentation, phase: 'orientation', replayReset: true });
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.querySelector<HTMLElement>('.v9-production-viewport')?.focus({ preventScroll: true });
    });
    startPreparation(false);
  }
  return <>
    <V9ProductionPresentation evidence={shippingEvidence} state={state} bootError={openFailed || idleFailed || !evidenceValid} videoRef={videoRef} packetButtonRef={packetButtonRef} onIdleReady={() => setIdleReady(true)} onIdleError={() => { setIdleFailed(true); setIdleReady(true); }} onVideoReady={() => setVideoState('ready')} onVideoError={() => { if (stateRef.current.phase === 'baseReplay') finishBase(); else { setVideoState('failed'); finishShipping(); } }} onVideoTime={mediaLandmark} onVideoEnd={() => { if (stateRef.current.phase === 'baseReplay') finishBase(); else finishShipping(); }} onTrace={playShipping} onReview={reviewTest} onBase={replayBase} onPacket={openPacket} onReturn={returnToVerdict} onReplay={replay} />
    <PostHeroContent />
  </>;
}
