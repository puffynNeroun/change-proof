import type { RefObject } from 'react';
import type { EvidenceCase } from './evidenceCase';
import type { Presentation } from './presentation';
import { reached } from './presentation';

function Action({ children, onClick, buttonRef, secondary = false }: {
  children: React.ReactNode; onClick: () => void; buttonRef?: RefObject<HTMLButtonElement | null>; secondary?: boolean;
}) {
  return <button ref={buttonRef} className={`cp-v8-action${secondary ? ' cp-v8-action--secondary' : ''}`} type="button" onClick={onClick}>{children}<span aria-hidden="true">{secondary ? '↺' : '→'}</span></button>;
}

export function NarrativeRail({ evidence, state, onReview, onReplayBase, onPacket, onReplay, packetButtonRef, videoFailed }: {
  evidence: EvidenceCase; state: Presentation; onReview: () => void; onReplayBase: () => void;
  onPacket: () => void; onReplay: () => void; packetButtonRef: RefObject<HTMLButtonElement | null>; videoFailed: boolean;
}) {
  const { phase, shippingStep, replayEvent } = state;
  const prep = phase === 'orientation' || phase === 'recordedChange' || phase === 'traceReady';
  const mismatchNamed = reached(replayEvent, 'named');
  if (phase === 'boot' || phase === 'proofPacket') return null;
  let index = 'RECORDED EVIDENCE';
  let title: React.ReactNode = <>Does this test<br />catch the change?</>;
  let body = 'Follow one test through the current and earlier versions. See what changes at the same input.';
  let status = phase === 'orientation' ? 'Preparing this recorded case. Trace Shipping will be available shortly.' : phase === 'recordedChange' ? 'Preparing evidence.' : 'Ready to trace.';
  if (phase === 'recordedChange' || phase === 'traceReady') {
    index = '01 / RECORDED CHANGE';
    body = `${evidence.change.area} changed from above ${evidence.change.boundary} to ${evidence.change.boundary} or above. We will trace the test at exactly that boundary.`;
  }
  if (phase === 'shippingTransition') {
    index = '02 / SHIPPING TRACE'; title = <>Follow the<br />change.</>;
    body = shippingStep === 'shipping' ? 'Opening Shipping.' : shippingStep === 'implementation' ? 'Locating the boundary.' : 'Registering the selected test.';
    status = '';
  }
  if (phase === 'headObservation') {
    index = '03 / CURRENT REVISION'; title = <>At {evidence.test.input},<br />true.</>;
    body = 'The current version, HEAD, applies free shipping. This matches the test’s expectation.'; status = '';
  }
  if (phase === 'selectedTest') {
    index = '04 / SELECTED TEST'; title = <>One test.<br />Same expectation.</>;
    body = `This test expects free shipping at ${evidence.test.input}. Replay it against the earlier version, BASE.`; status = '';
  }
  if (phase === 'baseReplay' || phase === 'mismatch') {
    index = mismatchNamed ? '06 / MISMATCH' : '05 / BASE REPLAY';
    title = mismatchNamed ? <>Same input.<br />Different result.</> : <>Same test.<br />Earlier revision.</>;
    body = mismatchNamed ? 'The test expects true. HEAD returns true. BASE returns false.' : reached(replayEvent, 'observed') ? 'BASE returns false.' : reached(replayEvent, 'evaluating') ? `Evaluating ${evidence.test.input} with the earlier condition.` : 'Registering the same test on BASE.';
    status = 'Physical BASE view pending final media.';
  }
  if (phase === 'verdict') {
    index = '07 / VERDICT'; title = <>This test<br />catches the<br />exact change.</>;
    body = `At ${evidence.test.input}, the test expects true. HEAD returns true; BASE returns false.`;
    status = 'Physical BASE view pending final media.';
  }
  return <section className="cp-v8-narrative" aria-label="Experience narrative">
    <div className="cp-v8-narrative__index">{index}</div>
    <h1>{title}</h1>
    <p>{body}</p>
    {status && <p className="cp-v8-narrative__status">{status}</p>}
    {phase === 'headObservation' && state.headActionReady && <Action onClick={onReview}>Review selected test</Action>}
    {phase === 'selectedTest' && <Action onClick={onReplayBase}>Replay against BASE</Action>}
    {phase === 'verdict' && <div className="cp-v8-narrative__actions"><Action onClick={onPacket} buttonRef={packetButtonRef}>View proof packet</Action><Action onClick={onReplay} secondary>Replay experience</Action></div>}
    {prep && videoFailed && phase !== 'traceReady' && <p className="cp-v8-narrative__fallback">The Shipping film is unavailable. The recorded stills are ready.</p>}
  </section>;
}
