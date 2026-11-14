import type { FormEvent } from 'react'
import { MAX_STATEMENT_LENGTH, MIN_STATEMENT_LENGTH } from '../types/api'
import { isLinkOnly, LINK_ONLY_MESSAGE } from '../utils/linkOnly'
import PasteChecklist from './PasteChecklist'

interface ProblemInputProps {
  statement: string
  loading: boolean
  assessing: boolean
  searching: boolean
  onChange: (statement: string) => void
  onAnalyze: () => void
  onAssess: () => void
  onSimilar: () => void
}

export default function ProblemInput({ statement, loading, assessing, searching, onChange, onAnalyze, onAssess, onSimilar }: ProblemInputProps) {
  // Count Unicode code points, as Python does, rather than UTF-16 code units.
  const count = Array.from(statement.trim()).length
  const linkOnly = isLinkOnly(statement)
  const valid = count >= MIN_STATEMENT_LENGTH && count <= MAX_STATEMENT_LENGTH && !linkOnly
  const validationMessage = count === 0 ? null : linkOnly ? LINK_ONLY_MESSAGE : count < MIN_STATEMENT_LENGTH
    ? `Add at least ${MIN_STATEMENT_LENGTH} characters to continue.`
    : count > MAX_STATEMENT_LENGTH ? `Shorten the statement to ${MAX_STATEMENT_LENGTH.toLocaleString()} characters or fewer.` : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valid && !loading) onAnalyze()
  }

  return (
    <section aria-labelledby="input-title" className={`panel lg:sticky lg:top-20 ${loading ? 'scan' : ''}`}>
      <div className="mb-5 flex items-center gap-3"><span className="step">01</span><h2 id="input-title" className="font-display text-xl font-semibold">Paste a problem</h2></div>
      <form onSubmit={submit} aria-busy={loading}>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="statement" className="text-sm font-semibold">Problem statement</label>
          <p id="statement-count" className="font-mono text-[0.7rem] text-ink-3">{count.toLocaleString()} / {MAX_STATEMENT_LENGTH.toLocaleString()}</p>
        </div>
        <p id="statement-help" className="mb-3 text-sm leading-6 text-ink-2">Paste the full text — story, input, output and constraints. Links are not opened.</p>
        <textarea id="statement" aria-describedby="statement-help statement-paste-tip statement-count statement-validation" aria-invalid={Boolean(validationMessage)} value={statement} disabled={loading} onChange={event => onChange(event.target.value)} placeholder="Paste the problem text here (not the link)…" className="statement-box min-h-72" />
        <p id="statement-validation" className={`mt-2 min-h-5 text-sm ${linkOnly ? 'rounded-lg bg-warn-soft p-2.5 text-warn' : 'text-warn'}`}>{validationMessage}</p>
        <PasteChecklist statement={statement} />
        <details id="statement-paste-tip" className="mt-3 text-xs text-ink-3"><summary className="caret font-mono">Paste tip</summary><p className="mt-1.5 leading-5">Preserve mathematical expressions when copying. Check powers after pasting: <code>2 × 10⁵</code> can be written as <code>2 * 10^5</code> or <code>2e5</code>.</p></details>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={!valid || loading} className="btn btn-primary flex-1">{loading && !assessing && !searching ? 'Analyzing…' : 'Analyze Problem'}</button>
          <button type="button" disabled={!statement || loading} onClick={() => onChange('')} className="btn btn-quiet">Clear</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={!valid || loading} onClick={onAssess} className="btn btn-line py-2.5">{loading && assessing ? 'Assessing…' : 'Assess constraints only'}</button>
          <button type="button" disabled={!valid || loading} onClick={onSimilar} className="btn btn-line py-2.5">{searching ? 'Searching…' : 'Find similar problems'}</button>
        </div>
        <p className="mt-2 text-center font-mono text-[0.68rem] text-ink-3">These two run offline and use no AI.</p>
      </form>
    </section>
  )
}
