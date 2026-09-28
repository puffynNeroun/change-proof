import { evidenceBoolean, type EvidenceCase } from './evidenceCase';

export function EvidenceToken({ evidence, visible, selected }: {
  evidence: EvidenceCase;
  visible: boolean;
  selected: boolean;
}) {
  const identity = `${evidence.id}|${evidence.test.path}|${evidence.test.input}|${evidence.test.expected}`;
  return <div className="cp-v8-token" data-token-identity={identity} data-visible={visible} data-selected={selected} aria-hidden={!visible}>
    <div className="cp-v8-token__path">{evidence.test.path.split('/').map((part, index, parts) => <span key={`${index}-${part}`}>{part}{index < parts.length - 1 && <>/<wbr /></>}</span>)}</div>
    <div className="cp-v8-token__facts">
      <div><span>Input</span><strong>{evidence.test.input}</strong></div>
      <div><span>Expected</span><strong>{evidenceBoolean(evidence.test.expected)}</strong></div>
    </div>
    <p className="cp-v8-token__meaning">Free shipping should apply</p>
  </div>;
}
