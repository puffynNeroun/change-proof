import { useCallback, useEffect, useReducer, useState } from 'react';
import { EvidenceRail, SelectedIdentity, TechnicalContext } from './components/Context';
import { MachineStage } from './components/MachineStage';
import { proof } from './data/proofData';
import { chapters } from './data/watchTimeline';
import { hasSelectedTest, initialState, observedEvidence, proofReducer } from './proof/controller';
import { stages } from './proof/proofStages';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function App() {
  const [state, dispatch] = useReducer(proofReducer, initialState);
  const [chapter, setChapter] = useState(0);
  const reducedMotion = useReducedMotion();
  const watch = state.mode === 'watch';
  const stage = watch ? chapters[chapter].view : stages[state.index];
  const selected = watch ? stage.selected : hasSelectedTest(state);
  const evidence = watch ? stage.evidence : observedEvidence(state);
  const onChapter = useCallback((index: number) => setChapter(index), []);

  return <>
    <a className="skip-link" href="#proof-controls">Skip to proof controls</a>
    <main>
      <section className={`instrument ${stage.context === 'verdict' ? 'is-verdict' : ''}`} aria-label="Change Proof evidence instrument" data-stage={stage.id} data-mode={state.mode}>
        <header className="status-rail">
          <a className="wordmark" href="#" aria-label="Change Proof, top"><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M4 26V6h14v9H4m14-9h10v20H14V15" /></svg>CHANGE PROOF</a>
          <span className="run-number">RUN 002 <span>/</span> SHIPPING</span>
          <div className="mode-switch" role="group" aria-label="Instrument mode"><button aria-pressed={!watch} onClick={() => dispatch({ type: 'mode', mode: 'run' })}>Run</button><button aria-pressed={watch} onClick={() => dispatch({ type: 'mode', mode: 'watch' })}>Watch</button></div>
        </header>
        <div className="chapter-rail"><span className="eyebrow">{watch ? 'Watch the proof' : 'Run the proof'}</span><span className="stage-indicator" aria-live="polite" aria-atomic="true">{!watch && <span className="stage-number">{String(state.index).padStart(2, '0')} / 08</span>}{stage.label}</span></div>
        <div className="theater">
          <div className="human-context" key={stage.context}>
            <p className="eyebrow context-index">{stage.context === 'idle' ? 'The missing experiment' : stage.context === 'verdict' ? 'The conclusion' : 'Anatomy of a change'}</p>
            <h1 className={stage.context === 'verdict' ? 'verdict' : ''}>{stage.heading}</h1>
            {stage.context === 'verdict' && <p className="verdict-support">{proof.supporting}</p>}
            <p className="explanation">{stage.explanation}</p>
            {stage.context === 'idle' && <p className="invitation">Run the new regression test<br /><em>against yesterday.</em></p>}
            {stage.context === 'change' && <ol className="source-path">{proof.path.map(item => <li key={item}>{item}</li>)}</ol>}
          </div>
          <MachineStage mode={state.mode} stage={stages[state.index]} activeChapter={chapter} onChapter={onChapter} onRun={() => dispatch({ type: 'mode', mode: 'run' })} reducedMotion={reducedMotion} />
          <aside className="technical-context" aria-label="Current proof context">
            {selected && <SelectedIdentity />}
            <div className="technical-content" key={`${stage.context}-${watch}`}><TechnicalContext stage={stage} watch={watch} /></div>
          </aside>
        </div>
        <div className="proof-transport">
          <div className="instrument-bottom">
            <EvidenceRail ids={evidence} />
          </div>
          <div className="proof-controls" id="proof-controls" tabIndex={-1}>
            {watch ? <><p className="small transport-note">One continuous film.<br />The same bounded experiment.</p><button className="primary" onClick={() => dispatch({ type: 'mode', mode: 'run' })}>Run the proof <span aria-hidden="true">↗</span></button></> : <>
              <div className="secondary-controls"><button onClick={() => dispatch({ type: 'previous' })} disabled={state.index === 0}>← <span>Previous</span></button><button onClick={() => dispatch({ type: 'restart' })} disabled={state.observedThrough === 0}>Restart</button><button onClick={() => dispatch({ type: 'mode', mode: 'watch' })}>{state.index === 0 ? 'Watch the proof' : 'Watch film'} <span aria-hidden="true">↗</span></button></div>
              <button className="primary" onClick={() => dispatch({ type: state.index === stages.length - 1 ? 'restart' : 'next' })}>{stage.forward}<span aria-hidden="true">{state.index === stages.length - 1 ? '↺' : '→'}</span></button>
            </>}
          </div>
        </div>
        <div className="instrument-foot"><span>EXACT REVISIONS. BOUNDED EVIDENCE.</span><span>Interactive demonstration · recorded Run 002</span></div>
      </section>
      <section className="editorial" aria-labelledby="reading-title">
        <div className="editorial-title"><p className="eyebrow">Read the experiment</p><h2 id="reading-title">A green test is a start.<br />Discrimination is the evidence.</h2></div>
        <div className="editorial-grid"><article><p className="eyebrow">01 / The change</p><h3>Equality matters.</h3><p>Free shipping starts at $50. The change from <code>&gt;</code> to <code>&gt;=</code> includes the exact threshold, where the historical implementation excluded it.</p></article><article><p className="eyebrow">02 / Selected test</p><h3>One fixed expectation.</h3><p>The changed HEAD test supplies 5000 cents and expects TRUE. Change Proof preserves that selected test while reconstructing the exact BASE implementation.</p></article><article><p className="eyebrow">03 / What this proves</p><h3>A bounded distinction.</h3><p>{proof.scope}</p></article><article><p className="eyebrow">04 / What this does not prove</p><h3>No broader guarantee.</h3><p>This does not prove every test is useful, the whole application is correct, or all regressions are covered. The assertion mismatch is not a production outage.</p></article></div>
      </section>
    </main>
    <footer><span>CHANGE PROOF</span><p>Run the new regression test against yesterday.</p><a href="#">Back to instrument ↑</a></footer>
  </>;
}
