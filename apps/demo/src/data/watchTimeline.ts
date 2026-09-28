import { stages, type Stage } from '../proof/proofStages';

export const FILM_DURATION = 39;
export type Chapter = { start: number; end: number; view: Stage };
function view(index: number, overrides: Partial<Stage> = {}): Stage { return { ...stages[index], evidence: [], ...overrides }; }
// Half-open intervals use the supplied 24fps V2 contract; State A is never depicted.
export const chapters: readonly Chapter[] = [
  { start: 0, end: 3, view: view(0, { label: 'The question' }) },
  { start: 3, end: 5.5, view: view(1) },
  { start: 5.5, end: 9.5, view: view(2, { label: 'Shipping extraction' }) },
  { start: 9.5, end: 13, view: view(3, { label: 'Anatomy / selected test' }) },
  { start: 13, end: 16.5, view: view(5, { label: 'HEAD behavior', heading: 'Current HEAD.\nShipping FREE.' }) },
  { start: 16.5, end: 464 / 24, view: view(3, { label: 'Implementation exchange', context: 'transition', heading: 'Hold the test.\nChange the revision.', explanation: 'HEAD withdraws from the shared implementation locus. The selected HEAD test remains unchanged.' }) },
  { start: 464 / 24, end: 24, view: view(6, { label: 'BASE substitution', context: 'base', role: 'neutral', heading: 'Exact BASE.\nSame expectation.', explanation: 'The historical > operator enters the same locus. At 5000 cents, BASE returns FALSE through normal execution.' }) },
  { start: 24, end: 606 / 24, view: view(6, { label: 'Assertion comparison', context: 'comparison', role: 'neutral', heading: 'Compare the\nobservation.', explanation: 'The observed FALSE reaches the selected test’s unchanged expectation: TRUE.' }) },
  { start: 606 / 24, end: 630 / 24, view: view(6, { label: 'Assertion mismatch', evidence: ['C'] }) },
  { start: 630 / 24, end: 27.25, view: view(6, { label: 'Evidence opening', evidence: ['C'] }) },
  { start: 27.25, end: 33.5, view: view(7, { label: 'Recorded evidence', evidence: ['A', 'B', 'C'] }) },
  { start: 33.5, end: 36, view: view(7, { label: 'Return to product', context: 'return', heading: 'Evidence retained.\nHEAD restored.', explanation: 'The diagnostic assembly returns to Shipping. The selected test and the recorded evidence remain identified.', evidence: ['A', 'B', 'C'] }) },
  { start: 36, end: 37, view: view(7, { label: 'Current product', context: 'return', heading: '$50 order.\nShipping FREE.', explanation: 'The restored HEAD implementation includes the equality boundary. The current product consequence remains free shipping.', evidence: ['A', 'B', 'C'] }) },
  { start: 37, end: 39, view: view(8, { evidence: ['A', 'B', 'C'] }) },
];
export function chapterAt(time: number): number {
  const safe = Number.isFinite(time) ? Math.max(0, Math.min(time, FILM_DURATION)) : 0;
  const index = chapters.findIndex(chapter => safe < chapter.end);
  return index === -1 ? chapters.length - 1 : index;
}
