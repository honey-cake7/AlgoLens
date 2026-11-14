// Live feedback on how complete the pasted statement looks. These are simple
// presence checks on the text's shape, not analysis of the problem.
const CHECKS: { label: string; test: (text: string) => boolean }[] = [
  { label: 'Task described', test: text => text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '').trim().length >= 120 },
  { label: 'Input format', test: text => /\binput\b/i.test(text) },
  { label: 'Output format', test: text => /\boutput\b|\bprint\b|\breturn\b/i.test(text) },
  { label: 'Bounds (like n ≤ 2·10⁵)', test: text => /≤|<=|\b10\s*(?:\^|\*\*)\s*\d|10[⁰¹²³⁴⁵⁶⁷⁸⁹]|\d\s*e\s*\d|\b\d{4,}\b/i.test(text) },
  { label: 'Example', test: text => /\b(?:examples?|samples?)\b/i.test(text) },
]

export default function PasteChecklist({ statement }: { statement: string }) {
  const results = CHECKS.map(check => check.test(statement))
  const done = results.filter(Boolean).length
  return (
    <div className="mt-4 rounded-xl border border-dashed border-rule p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Paste checklist</p>
        <p className="font-mono text-[0.7rem] text-ink-3">{done}/{CHECKS.length}</p>
      </div>
      <div className="meter mt-2" data-full={done === CHECKS.length}><span style={{ ['--fill' as string]: `${(done / CHECKS.length) * 100}%` }} /></div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-[0.78rem] text-ink-3 sm:grid-cols-2">
        {CHECKS.map((check, index) => (
          <li key={check.label} className="check-item flex items-center gap-2" data-on={results[index]}>
            <span className="check-box" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--color-paper)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5 4.8 9 10 3" /></svg></span>
            <span>{check.label}<span className="sr-only">{results[index] ? ': found' : ': not found yet'}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[0.75rem] leading-5 text-ink-3">{done === CHECKS.length ? 'Looks like a complete statement.' : 'Optional — but the more of the original you paste, the better the result.'}</p>
    </div>
  )
}
