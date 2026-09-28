import { describe, expect, it } from 'vitest';
import { outcomes, proof } from '../src/data/proofData';
import { chapterAt, chapters, FILM_DURATION } from '../src/data/watchTimeline';
import { hasSelectedTest, initialState, observedEvidence, proofReducer } from '../src/proof/controller';
import { stages } from '../src/proof/proofStages';

describe('authoritative proof contract', () => {
  it('uses the exact manual stage order and reaches every stage', () => {
    const expected = ['idle', 'request', 'change', 'selected-test', 'state-a', 'state-b', 'state-c', 'evidence', 'verdict'];
    expect(stages.map(stage => stage.id)).toEqual(expected);
    let state = initialState;
    const visited = [stages[state.index].id];
    for (let i = 1; i < stages.length; i++) {
      state = proofReducer(state, { type: 'next' });
      visited.push(stages[state.index].id);
    }
    expect(visited).toEqual(expected);
    expect(proofReducer(state, { type: 'next' })).toEqual(state);
  });
  it('records BASE with BASE tests and HEAD with HEAD tests as neutral passing controls', () => {
    expect(outcomes[0]).toMatchObject({ id: 'A', implementation: 'BASE', tests: 'BASE tests', result: 'PASS', revision: proof.base.revision });
    expect(outcomes[1]).toMatchObject({ id: 'B', implementation: 'HEAD', tests: 'HEAD tests', result: 'PASS', revision: proof.head.revision });
    expect(stages[4].role).toBe('neutral');
    expect(stages[5].role).toBe('neutral');
  });
  it('keeps the exact BASE and selected HEAD test pairing in C', () => {
    expect(outcomes[2]).toEqual({ id: 'C', implementation: 'EXACT BASE', tests: 'SELECTED HEAD test', revision: proof.base.revision, result: 'TEST_ASSERTION_FAILURE', expected: true, actual: false });
    expect(proof.selectedTest.input).toBe(5000);
    expect(proof.selectedTest.expected).toBe(true);
    expect(proof.subtotal > proof.threshold).toBe(outcomes[2].actual);
    expect(proof.subtotal >= proof.threshold).toBe(proof.head.result);
  });
  it('uses the exact final verdict and bounded technical support', () => {
    expect(stages[8].heading).toBe(proof.verdict);
    expect(proof.verdict).toBe('THE SELECTED TEST\nCATCHES THE CHANGE');
    expect(proof.supporting).toBe('SELECTED TEST · HEAD PASS · BASE ASSERTION FAILURE');
  });
  it('never exposes unobserved results and retains observed evidence when revisiting', () => {
    let state = initialState;
    const expected = [[], [], [], [], ['A'], ['A', 'B'], ['A', 'B', 'C'], ['A', 'B', 'C'], ['A', 'B', 'C']];
    expected.forEach((evidence, index) => {
      expect(state.index).toBe(index);
      expect(observedEvidence(state)).toEqual(evidence);
      expect(hasSelectedTest(state)).toBe(index >= 3);
      state = proofReducer(state, { type: 'next' });
    });
    for (let i = 0; i < stages.length; i++) state = proofReducer(state, { type: 'previous' });
    expect(state.index).toBe(0);
    expect(hasSelectedTest(state)).toBe(true);
    expect(observedEvidence(state)).toEqual(['A', 'B', 'C']);
    state = proofReducer(state, { type: 'restart' });
    expect(state).toEqual(initialState);
    expect(hasSelectedTest(state)).toBe(false);
    expect(observedEvidence(state)).toEqual([]);
  });
  it('mode switching preserves manual progress and returning to RUN does not skip stages', () => {
    const progressed = proofReducer(initialState, { type: 'next' });
    const watch = proofReducer(progressed, { type: 'mode', mode: 'watch' });
    expect(watch).toEqual({ ...progressed, mode: 'watch' });
    expect(proofReducer(watch, { type: 'mode', mode: 'run' })).toEqual(progressed);
  });
});

describe('V2 semantic timeline', () => {
  it('covers the full film with contiguous monotonic half-open intervals', () => {
    expect(chapters[0].start).toBe(0);
    expect(chapters.at(-1)?.end).toBe(FILM_DURATION);
    chapters.forEach((chapter, index) => {
      expect(chapter.end).toBeGreaterThan(chapter.start);
      expect(chapterAt(chapter.start)).toBe(index);
      expect(chapterAt(chapter.end - 0.001)).toBe(index);
      if (index) expect(chapter.start).toBe(chapters[index - 1].end);
    });
  });
  it('handles seek bounds and never calls a cinematic interval State A', () => {
    expect(chapterAt(-1)).toBe(0);
    expect(chapterAt(NaN)).toBe(0);
    expect(chapterAt(39)).toBe(chapters.length - 1);
    expect(chapterAt(50)).toBe(chapters.length - 1);
    expect(chapters.some(chapter => chapter.view.context === 'a' || chapter.view.label === 'State A')).toBe(false);
  });
  it('holds selection through exchange and withholds mismatch/evidence until observed', () => {
    chapters.forEach(chapter => {
      expect(chapter.view.selected).toBe(chapter.start >= 9.5);
      if (chapter.start < 606 / 24) expect(chapter.view.evidence).toEqual([]);
      if (chapter.start < 27.25) expect(chapter.view.evidence).not.toContain('A');
      if (chapter.start < 606 / 24) expect(chapter.view.role).not.toBe('mismatch');
    });
    expect(chapters[chapterAt(26)].view.evidence).toEqual(['C']);
    expect(chapters[chapterAt(28)].view.evidence).toEqual(['A', 'B', 'C']);
  });
  it('uses valid media anchors and a neutral recorded frame for State A', () => {
    for (const stage of stages) {
      expect(stage.anchor).toBeGreaterThanOrEqual(0);
      expect(stage.anchor).toBeLessThan(FILM_DURATION);
    }
    expect(stages[4].anchor).toBe(stages[0].anchor);
  });
});
