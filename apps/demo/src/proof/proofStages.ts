import type { EvidenceId } from '../data/proofData';

export type ContextKind = 'idle' | 'request' | 'change' | 'test' | 'a' | 'b' | 'c' | 'evidence' | 'verdict' | 'transition' | 'base' | 'comparison' | 'return';
export type Stage = {
  id: string; label: string; heading: string; explanation: string;
  context: ContextKind; role: 'neutral' | 'selected' | 'mismatch';
  selected: boolean; evidence: readonly EvidenceId[]; anchor: number; forward: string;
};
export const stages: readonly Stage[] = [
  { id: 'idle', label: 'Ready to inspect', heading: 'A passing test.\nA missing proof.', explanation: 'A new regression test passes on HEAD. Does it catch the exact recorded BASE behavior?', context: 'idle', role: 'neutral', selected: false, evidence: [], anchor: 0.8, forward: 'Run the proof' },
  { id: 'request', label: 'Request', heading: 'Right at\nthe boundary.', explanation: 'A $50 order. Should shipping be free? Follow the decision into Shipping.', context: 'request', role: 'neutral', selected: false, evidence: [], anchor: 4.9, forward: 'Inspect change' },
  { id: 'change', label: 'Change', heading: 'One operator.\nDifferent behavior.', explanation: 'The fix includes the equality boundary. At exactly 5000 cents, > returns FALSE; >= returns TRUE.', context: 'change', role: 'neutral', selected: false, evidence: [], anchor: 10.5, forward: 'Select test' },
  { id: 'selected-test', label: 'Selected test', heading: 'Keep this\ntest constant.', explanation: 'Explicitly select the changed HEAD regression test. Its input and expectation stay fixed while the implementation changes.', context: 'test', role: 'selected', selected: true, evidence: [], anchor: 12.9, forward: 'Run A' },
  { id: 'state-a', label: 'State A', heading: 'The historical\ncontrol.', explanation: 'BASE passes its own tests. The selected HEAD regression test did not exist in that historical suite.', context: 'a', role: 'neutral', selected: true, evidence: ['A'], anchor: 0.8, forward: 'Run B' },
  { id: 'state-b', label: 'State B', heading: 'The current\ncontrol.', explanation: 'HEAD passes its tests, including the selected regression test. At $50, the current implementation grants free shipping.', context: 'b', role: 'neutral', selected: true, evidence: ['A', 'B'], anchor: 15.5, forward: 'Run C' },
  { id: 'state-c', label: 'State C', heading: 'Same test.\nExact BASE.', explanation: 'The selected HEAD test expects TRUE. The exact recorded BASE implementation returns FALSE. That assertion mismatch is useful evidence.', context: 'c', role: 'mismatch', selected: true, evidence: ['A', 'B', 'C'], anchor: 26, forward: 'Retain evidence' },
  { id: 'evidence', label: 'Evidence', heading: 'The difference\nis recorded.', explanation: 'Two passing controls. One selected test that distinguishes the revisions. The assertion failure completes this bounded experiment.', context: 'evidence', role: 'neutral', selected: true, evidence: ['A', 'B', 'C'], anchor: 28.7, forward: 'Resolve' },
  { id: 'verdict', label: 'Verdict', heading: 'THE SELECTED TEST\nCATCHES THE CHANGE', explanation: 'One selected test. One boundary case. Exact recorded revisions.', context: 'verdict', role: 'neutral', selected: true, evidence: ['A', 'B', 'C'], anchor: 38.4, forward: 'Run again' },
];
