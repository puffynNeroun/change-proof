import { stages } from './proofStages';

export type Mode = 'run' | 'watch';
export type ProofState = { mode: Mode; index: number; observedThrough: number };
export type Action = { type: 'next' | 'previous' | 'restart' } | { type: 'mode'; mode: Mode };
export const initialState: ProofState = { mode: 'run', index: 0, observedThrough: 0 };
export function proofReducer(state: ProofState, action: Action): ProofState {
  switch (action.type) {
    case 'next': {
      const index = Math.min(state.index + 1, stages.length - 1);
      return { ...state, index, observedThrough: Math.max(index, state.observedThrough) };
    }
    case 'previous': return { ...state, index: Math.max(0, state.index - 1) };
    case 'restart': return { ...initialState };
    case 'mode': return { ...state, mode: action.mode };
  }
}
export function observedEvidence(state: ProofState) { return stages[state.observedThrough].evidence; }
export function hasSelectedTest(state: ProofState) { return stages[state.observedThrough].selected; }
