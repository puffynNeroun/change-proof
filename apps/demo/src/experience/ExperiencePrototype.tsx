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
  const [evidenceSkipped, setEvidenceSkipped] = useState(false);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const evidenceUnlocked = evidenceSkipped || state.phase === 'verdict' || state.phase === 'proofPacket';

  function exploreEvidence() {
    setEvidenceSkipped(true);
    commit({ paused: true });
    videoRef.current?.pause();
    window.requestAnimationFrame(() => {
      evidenceRef.current?.focus({ preventScroll: true });
      evidenceRef.current?.scrollIntoView({ behavior: reduceMotion.current ? 'auto' : 'smooth', block: 'start' });
    });
  }

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
    const simple = reduceMotion.current || window.matchMedia('(max-width: 900px), (max-height: 600px)').matches;
    const start = fromBoot ? (simple ? 450 : 1000) : 0;
    if (simple) {
      startSequence([
        { at: start, commit: () => commit({ phase: 'orientation', preparationRow: 4, replayReset: false }) },
        { at: start + 350, commit: () => commit({ phase: 'traceReady' }) },
      ]);
      return;
    }
    // Reveal the whole object, hold its orientation, then reframe. The narrative
    // registers only after the camera-like movement has reached its destination.
    startSequence([
      { at: start, commit: () => commit({ phase: 'orientation', preparationRow: 0 }) },
      { at: start + 650, commit: () => commit({ preparationRow: 1, replayReset: false }) },
      { at: start + 1450, commit: () => commit({ preparationRow: 2 }) },
      { at: start + 2550, commit: () => commit({ preparationRow: 3 }) },
      { at: start + 3150, commit: () => commit({ preparationRow: 4 }) },
      { at: start + 3850, commit: () => commit({ phase: 'traceReady', traceMode: 'compact' }) },
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

    if (reduceMotion.current) {
      commit({
        phase: 'headObservation',
        mediaPhase: 'head',
        shippingStep: 'test',
        traceMode: 'compact',
        headEvent: 'awaiting',
        headActionReady: false,
      });
      startSequence([
        { at: 50, commit: () => commit({ headEvent: 'registered' }) },
        { at: 160, commit: () => commit({ headEvent: 'legible' }) },
        { at: 300, commit: () => commit({ headEvent: 'confirmed' }) },
        { at: 460, commit: () => commit({ headEvent: 'settled', headActionReady: true }) },
      ]);
      return;
    }

    // Do not replace the TRACE composition in the same paint.
    // First retract its narrative/evidence, then mount HEAD.
    commit({
      traceMode: 'contracting',
      headEvent: 'awaiting',
      headActionReady: false,
    });

    startSequence([
      {
        at: 200,
        commit: () => commit({
          phase: 'headObservation',
          mediaPhase: 'head',
          shippingStep: 'test',
          traceMode: 'compact',
          headEvent: 'registered',
          headActionReady: false,
        }),
      },
      { at: 1180, commit: () => commit({ headEvent: 'legible' }) },
      { at: 1520, commit: () => commit({ headEvent: 'confirmed' }) },
      { at: 1940, commit: () => commit({ headEvent: 'settled', headActionReady: true }) },
    ]);
  }

  function playShipping() {
    if (stateRef.current.phase !== 'traceReady' || actionLocked.current) return;
    actionLocked.current = true;
    const video = videoRef.current;
    if (reduceMotion.current || videoState !== 'ready' || !video) {
      commit({ phase: 'shippingTransition', mediaPhase: reduceMotion.current ? 'head' : 'shipping', shippingStep: 'shipping', traceMode: 'compact', headEvent: 'awaiting' });
      startSequence([{ at: 120, commit: finishShipping }]);
      return;
    }

    // Let the opening composition leave before the trace layout and media source
    // become visible. This avoids crossfading two incompatible geometries.
    commit({ traceMode: 'retracting', headEvent: 'awaiting' });
    startSequence([
      { at: 240, commit: () => {
        commit({ phase: 'shippingTransition', mediaPhase: 'shipping', shippingStep: 'shipping', traceMode: 'contracting' });
        video.currentTime = 0;
        video.playbackRate = finalMediaEvents.playbackRate;
        void video.play().catch(() => { setVideoState('failed'); finishShipping(); });
      } },
      { at: 620, commit: () => commit({ traceMode: 'compact' }) },
    ]);
  }

  function reviewTest() {
    if (stateRef.current.phase !== 'headObservation' || !stateRef.current.headActionReady) return;

    if (reduceMotion.current) {
      commit({ phase: 'selectedTest', headActionReady: false });
      return;
    }

    // Keep the selected test anchored while the resolved HEAD observation
    // and its narrative leave before the selected-test phase mounts.
    commit({ headEvent: 'exiting', headActionReady: false });

    startSequence([
      {
        at: 200,
        commit: () => commit({
          phase: 'selectedTest',
          headEvent: 'settled',
        }),
      },
    ]);
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
      { at: 2400, commit: () => commit({ replayEvent: 'comparing' }) },
      { at: 2650, commit: () => commit({ replayEvent: 'compared' }) },
      { at: 2900, commit: () => commit({ replayEvent: 'localized', phase: 'mismatch' }) },
      { at: 3120, commit: () => commit({ replayEvent: 'named' }) },
      { at: 6120, commit: () => commit({ phase: 'verdict' }) },
      { at: 6340, commit: () => commit({ replayEvent: 'resolved' }) },
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
      if (stateRef.current.phase === 'baseReplay' && !stateRef.current.paused) void video.play().catch(finishBase);
    };
    video.addEventListener('loadeddata', play, { once: true });
    video.load();
  }

  function finishBase() {
    if (stateRef.current.phase !== 'baseReplay') return;
    commit({ mediaPhase: 'base', replayEvent: 'observed', baseEvaluated: true, baseFalseVisible: true });
    startSequence([
      { at: 1550, commit: () => commit({ replayEvent: 'comparing' }) },
      { at: 1800, commit: () => commit({ replayEvent: 'compared' }) },
      { at: 2150, commit: () => commit({ replayEvent: 'localized', phase: 'mismatch' }) },
      { at: 2450, commit: () => commit({ replayEvent: 'named' }) },
      { at: 5600, commit: () => commit({ phase: 'verdict' }) },
      { at: 6100, commit: () => commit({ replayEvent: 'resolved' }) },
    ]);
  }

  function openPacket() {
    if (stateRef.current.phase !== 'verdict' || stateRef.current.replayEvent !== 'resolved') return;
    commit({ phase: 'proofPacket', packetSettled: false, packetClosing: false, packetFolded: false });
    startSequence([{ at: reduceMotion.current ? 80 : 420, commit: () => commit({ packetSettled: true }) }]);
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
    setEvidenceSkipped(false);
    cancelSequence();

    // Cover the currently rendered Proof Record BEFORE touching media, state,
    // or scroll. Two RAFs ensure the opaque curtain has reached a browser paint
    // before the light orientation state is restored underneath it.
    commit({ replayReset: true });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        videoRef.current?.pause();
        if (videoRef.current) {
          videoRef.current.src = ASSET.shipping;
          videoRef.current.poster = ASSET.idle;
          videoRef.current.currentTime = 0;
          videoRef.current.playbackRate = finalMediaEvents.playbackRate;
          videoRef.current.load();
        }

        actionLocked.current = false;

        // Keep the curtain opaque while the underlying opening scene resets.
        commit({ ...initialPresentation, phase: 'orientation', replayReset: true });
        window.scrollTo(0, 0);

        window.requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          document.querySelector<HTMLElement>('.v9-production-viewport')?.focus({ preventScroll: true });
        });

        startPreparation(false);
      });
    });
  }
  return <>
    <V9ProductionPresentation evidence={shippingEvidence} state={state} bootError={openFailed || idleFailed || !evidenceValid} videoRef={videoRef} packetButtonRef={packetButtonRef} onIdleReady={() => setIdleReady(true)} onIdleError={() => { setIdleFailed(true); setIdleReady(true); }} onVideoReady={() => setVideoState('ready')} onVideoError={() => { if (stateRef.current.phase === 'baseReplay') finishBase(); else { setVideoState('failed'); finishShipping(); } }} onVideoTime={mediaLandmark} onVideoEnd={() => { if (stateRef.current.phase === 'baseReplay') finishBase(); else finishShipping(); }} onTrace={playShipping} onReview={reviewTest} onBase={replayBase} onPacket={openPacket} onReturn={returnToVerdict} onReplay={replay} onExplore={exploreEvidence} evidenceUnlocked={evidenceUnlocked} />
    {evidenceUnlocked && <div ref={evidenceRef} id="evidence-trace" tabIndex={-1} aria-label="Evidence trace"><PostHeroContent /></div>}
  </>;
}
