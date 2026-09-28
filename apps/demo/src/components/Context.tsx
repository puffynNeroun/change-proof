import { booleanLabel, outcomes, proof, type EvidenceId } from '../data/proofData';
import type { Stage } from '../proof/proofStages';

export function SelectedIdentity() {
  return <div className="selected-identity" data-testid="selected-identity">
    <span className="identity-mark" aria-hidden="true" />
    <span><span className="eyebrow">Selected HEAD test</span><code>{proof.selectedTest.path}</code></span>
  </div>;
}

export function CodeDiff() {
  return <div className="code-diff">
    <p className="eyebrow">The equality boundary</p>
    {(['base', 'head'] as const).map(revision => <div className="code-row" key={revision}>
      <span className="eyebrow">{revision.toUpperCase()}</span>
      <code>subtotal <strong className="operator">{proof[revision].operator}</strong> {proof.threshold}</code>
    </div>)}
    <p className="small">Exactly $50 changes from excluded to included.</p>
  </div>;
}

function SelectedTest() {
  return <div className="test-detail">
    <p className="small">{proof.selectedTest.name}</p>
    <dl className="values"><div><dt>Input · cents</dt><dd>{proof.selectedTest.input}</dd></div><div><dt>Expected</dt><dd>{booleanLabel(proof.selectedTest.expected)}</dd></div></dl>
    <p className="footnote">Explicitly selected from HEAD.</p>
  </div>;
}

function Comparator({ mismatch }: { mismatch: boolean }) {
  return <div className={mismatch ? 'comparator mismatch' : 'comparator'}>
    <dl className="values"><div><dt>Expected</dt><dd>{booleanLabel(proof.selectedTest.expected)}</dd></div><div><dt>Actual</dt><dd>{booleanLabel(proof.base.result)}</dd></div></dl>
    {mismatch && <><code className="assertion-result">{outcomes[2].result}</code><p className="small">An assertion mismatch.<br />The test catches this change.</p></>}
  </div>;
}

export function TechnicalContext({ stage, watch }: { stage: Stage; watch: boolean }) {
  switch (stage.context) {
    case 'idle': return <div className="idle-note"><span className="index-mark">002 /</span><p className="eyebrow">A recorded experiment</p><p className="small">One shipping boundary.<br />Two exact revisions.<br />One explicitly selected test.</p></div>;
    case 'request': return <div className="request-detail"><p className="eyebrow">Commerce specimen</p><h3>{proof.product}</h3><div className="price">{proof.price}<span>.00</span></div><dl className="receipt"><div><dt>Subtotal</dt><dd>5000 cents</dd></div><div><dt>Shipping</dt><dd>Should it be FREE?</dd></div></dl></div>;
    case 'change': return <CodeDiff />;
    case 'test': return <SelectedTest />;
    case 'a':
    case 'b': {
      const item = outcomes[stage.context === 'a' ? 0 : 1];
      return <div className="execution-detail"><p className="eyebrow">{watch ? 'Current implementation' : `Recorded control ${item.id}`}</p>
        {watch ? <><div className="expression"><code>5000 <strong>{proof.head.operator}</strong> 5000</code><span>→ TRUE</span></div><p className="small">Selected test expects TRUE.<br />Shipping is FREE.</p></> : <><div className="pairing"><strong>{item.implementation}</strong><span>+</span><strong>{item.tests}</strong></div><p className="pass-result">{item.result}</p><p className="footnote">{stage.context === 'a' ? 'Historical suite only. Selected HEAD test is held aside.' : 'Includes the selected HEAD regression test.'}</p></>}
        <p className="revision"><span>{item.implementation}</span><code>{item.revision.slice(0, 7)}</code></p>
      </div>;
    }
    case 'c': return <><p className="eyebrow">The historical experiment</p><div className="pairing compact"><strong>{outcomes[2].implementation}</strong><span>+</span><strong>{outcomes[2].tests}</strong></div><Comparator mismatch /></>;
    case 'comparison': return <><p className="eyebrow">Selected assertion</p><Comparator mismatch={false} /></>;
    case 'base': return <><p className="eyebrow">Historical implementation</p><div className="expression"><code>5000 <strong>{proof.base.operator}</strong> 5000</code><span>→ FALSE</span></div><p className="small">Same input. Same expected TRUE.<br />Exact recorded BASE.</p></>;
    case 'transition': return <><p className="eyebrow">Implementation exchange</p><p className="exchange">HEAD <span>→</span> BASE</p><p className="small">The test stays fixed.<br />The implementation changes.</p><SelectedTest /></>;
    case 'evidence': return <div className="record-detail"><p className="eyebrow">Exact recorded revisions</p><p className="revision"><span>BASE</span><code>{proof.base.revision.slice(0, 7)}</code></p><p className="revision"><span>HEAD</span><code>{proof.head.revision.slice(0, 7)}</code></p><p className="small">Selected test from HEAD.<br />Implementation from exact BASE.</p><p className="footnote">Run 002 · validated experiment boundary</p></div>;
    case 'return': return <><p className="eyebrow">Current product consequence</p><h3>{proof.product}</h3><div className="price">{proof.price}</div><p className="exchange">Shipping FREE</p></>;
    case 'verdict': return <div className="verdict-scope"><p className="eyebrow">What this proves</p><p className="small">{proof.scope}</p><p className="footnote">Bounded evidence, not global correctness.</p></div>;
  }
}

export function EvidenceRail({ ids }: { ids: readonly EvidenceId[] }) {
  return <div className="evidence-rail" aria-label="Observed evidence">
    <span className="eyebrow">{ids.length ? 'Retained evidence' : 'Evidence awaits observation'}</span>
    <ol>{ids.map(id => { const item = outcomes.find(outcome => outcome.id === id)!; return <li key={id}><span className="evidence-id">{id}</span><code>{item.result}</code></li>; })}</ol>
  </div>;
}
