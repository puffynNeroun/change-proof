export type ExperiencePhase =
  | 'boot' | 'orientation' | 'recordedChange' | 'traceReady'
  | 'shippingTransition' | 'headObservation' | 'selectedTest'
  | 'baseReplay' | 'mismatch' | 'verdict' | 'proofPacket';

export type ShippingStep = 'shipping' | 'implementation' | 'test';
export type HeadEvent = 'awaiting' | 'registered' | 'legible' | 'confirmed' | 'settled' | 'exiting';
export type ReplayEvent =
  | 'idle' | 'released' | 'transferring' | 'registered'
  | 'evaluating' | 'observed' | 'comparing' | 'compared'
  | 'localized' | 'named' | 'resolved';

export interface Presentation {
  phase: ExperiencePhase;
  mediaPhase: 'idle' | 'shipping' | 'head' | 'headToBase' | 'base';
  preparationRow: 0 | 1 | 2 | 3 | 4;
  shippingStep: ShippingStep;
  traceMode: 'retracting' | 'contracting' | 'compact';
  replayEvent: ReplayEvent;
  baseEvaluated: boolean;
  baseFalseVisible: boolean;
  headActionReady: boolean;
  headEvent: HeadEvent;
  packetSettled: boolean;
  packetClosing: boolean;
  packetFolded: boolean;
  replayReset: boolean;
  paused: boolean;
}

export const initialPresentation: Presentation = {
  phase: 'boot', mediaPhase: 'idle', preparationRow: 0, shippingStep: 'shipping', traceMode: 'retracting',
  replayEvent: 'idle', baseEvaluated: false, baseFalseVisible: false, headActionReady: false, headEvent: 'awaiting',
  packetSettled: false, packetClosing: false, packetFolded: false, replayReset: false, paused: false,
};

export const replayOrder: ReplayEvent[] = [
  'idle', 'released', 'transferring', 'registered', 'evaluating',
  'observed', 'comparing', 'compared', 'localized', 'named', 'resolved',
];

export const reached = (current: ReplayEvent, event: ReplayEvent) =>
  replayOrder.indexOf(current) >= replayOrder.indexOf(event);
