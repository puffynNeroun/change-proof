import { evidenceBoolean, type EvidenceCase } from './evidenceCase';

export type ExperiencePhase =
  | 'boot'
  | 'orientation'
  | 'recordedChange'
  | 'traceReady'
  | 'shippingTransition'
  | 'headObservation'
  | 'selectedTest'
  | 'baseReplay'
  | 'mismatch'
  | 'verdict'
  | 'proofPacket';

export type TransitionStep = 'shipping' | 'implementation' | 'test';

const traceLabels = [
  'Change',
  'Implementation',
  'Selected Test',
  'BASE Replay',
  'Verdict',
] as const;

function traceState(phase: ExperiencePhase, step: TransitionStep): Array<string> {
  if (phase === 'recordedChange') return ['✓', '—', '—', '—', '—'];
  if (phase === 'traceReady') return ['✓', 'ready', '—', '—', '—'];
  if (phase === 'shippingTransition') {
    return step === 'test'
      ? ['✓', '✓', 'active', '—', '—']
      : ['✓', 'active', '—', '—', '—'];
  }
  if (phase === 'headObservation' || phase === 'selectedTest') return ['✓', '✓', '✓', '—', '—'];
  if (phase === 'baseReplay') return ['✓', '✓', '✓', 'active', '—'];
  if (phase === 'mismatch') return ['✓', '✓', '✓', '✓', 'active'];
  return ['✓', '✓', '✓', '✓', '✓'];
}

function consoleStatus(phase: ExperiencePhase): string {
  const labels: Partial<Record<ExperiencePhase, string>> = {
    recordedChange: 'CHANGE LOCATED',
    traceReady: 'READY TO TRACE',
    shippingTransition: 'TRACING SHIPPING',
    headObservation: 'HEAD REPRODUCED',
    selectedTest: 'READY TO REPLAY',
    baseReplay: 'REPLAYING BASE',
    mismatch: 'BEHAVIOR DIVERGED',
    verdict: 'PROOF COMPLETE',
    proofPacket: 'PROOF COMPLETE',
  };
  return labels[phase] ?? '';
}

export function EvidenceConsole({
  evidence,
  phase,
  transitionStep,
}: {
  evidence: EvidenceCase;
  phase: ExperiencePhase;
  transitionStep: TransitionStep;
}) {
  if (phase === 'boot' || phase === 'orientation' || phase === 'proofPacket') return null;

  const trace = traceState(phase, transitionStep);
  const hasHead = !['recordedChange', 'traceReady', 'shippingTransition'].includes(phase);
  const hasBase = ['mismatch', 'verdict'].includes(phase);
  const isVerdict = phase === 'verdict';
  const showTest = ['selectedTest', 'baseReplay'].includes(phase);

  return (
    <aside className="cp-console" aria-label="Evidence Console">
      <div className="cp-console__masthead">
        <span>{isVerdict ? 'CHANGE PROOF' : `${evidence.change.area.toUpperCase()} / CHANGE 01`}</span>
        <span>EVIDENCE CONSOLE</span>
      </div>

      {isVerdict ? (
        <div className="cp-console__verdict">
          <small>VERDICT</small>
          <strong>{evidence.verdict.catchesChange ? 'CHANGE DETECTED' : 'CHANGE NOT DETECTED'}</strong>
          <div className="cp-console__verdict-grid">
            <span>CHANGE</span><b>{evidence.change.baseOperator} {evidence.change.boundary} → {evidence.change.headOperator} {evidence.change.boundary}</b>
            <span>TEST</span><b>{evidence.test.path}</b>
            <span>BOUNDARY</span><b>{evidence.change.boundary}</b>
            <span>EXPECTED</span><b>{evidenceBoolean(evidence.test.expected)}</b>
            <span>HEAD</span><b className="cp-green">{evidenceBoolean(evidence.head.observed)}</b>
            <span>BASE</span><b className="cp-magenta">{evidenceBoolean(evidence.base.observed)}</b>
          </div>
        </div>
      ) : (
        <>
          <div className="cp-console__section">
            <h3>{showTest ? 'SELECTED TEST' : 'REVISION'}</h3>
            {showTest ? (
              <div className="cp-console__test">
                <strong>{evidence.test.path}</strong>
                <div><span>input</span><b>{evidence.test.input}</b></div>
                <div><span>expected</span><b>{evidenceBoolean(evidence.test.expected)}</b></div>
                <div><span>HEAD observed</span><b className="cp-green">{evidenceBoolean(evidence.head.observed)}</b></div>
                <div><span>BASE observed</span><b>{hasBase ? evidenceBoolean(evidence.base.observed) : '—'}</b></div>
              </div>
            ) : hasHead ? (
              <div className="cp-console__revision">
                <div><span>HEAD / CURRENT</span><b className="cp-cobalt">{phase === 'baseReplay' ? 'reproduced' : 'observed'}</b></div>
                <div><span>BASE / EARLIER</span><b className={phase === 'baseReplay' ? 'cp-cobalt' : ''}>{phase === 'baseReplay' ? 'active' : hasBase ? 'observed' : '—'}</b></div>
              </div>
            ) : (
              <div className="cp-console__revision">
                <div><span>BASE</span><b>{evidence.change.baseOperator} {evidence.change.boundary}</b></div>
                <div><span>HEAD</span><b className="cp-cobalt">{evidence.change.headOperator} {evidence.change.boundary}</b></div>
              </div>
            )}
          </div>

          {phase === 'baseReplay' && <div className="cp-console__section">
            <h3>REVISION</h3>
            <div className="cp-console__revision">
              <div><span>BASE / EARLIER</span><b className="cp-cobalt">active</b></div>
              <div><span>HEAD / CURRENT</span><b className="cp-green">reproduced</b></div>
            </div>
          </div>}

          {hasHead && !showTest && (
            <div className="cp-console__section">
              <h3>OBSERVATION</h3>
              <div className="cp-console__observation">
                <div><span>input</span><b>{evidence.test.input}</b></div>
                <div><span>expected</span><b>{evidenceBoolean(evidence.test.expected)}</b></div>
                <div><span>HEAD</span><b className="cp-green">{evidenceBoolean(evidence.head.observed)}</b></div>
                <div><span>BASE</span><b className={hasBase ? 'cp-magenta' : ''}>{hasBase ? evidenceBoolean(evidence.base.observed) : '—'}</b></div>
                {hasBase && <div className="cp-console__delta"><span>DELTA</span><b>{evidenceBoolean(evidence.head.observed)} → {evidenceBoolean(evidence.base.observed)}</b></div>}
              </div>
            </div>
          )}

          <div className="cp-console__section cp-console__trace">
            <h3>TRACE</h3>
            {traceLabels.map((label, index) => (
              <div className="cp-console__trace-row" key={label} data-state={trace[index]}>
                <span>{String(index + 1).padStart(2, '0')} {label}</span>
                <b>{trace[index]}</b>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="cp-console__status">
        <span>STATUS</span>
        <strong>{consoleStatus(phase)}</strong>
      </div>
    </aside>
  );
}
