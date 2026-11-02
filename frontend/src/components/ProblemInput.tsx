import type { FormEvent } from 'react'
import { MAX_STATEMENT_LENGTH, MIN_STATEMENT_LENGTH } from '../types/api'

interface ProblemInputProps {
  statement: string
  loading: boolean
  assessing: boolean
  onChange: (statement: string) => void
  onAnalyze: () => void
  onAssess: () => void
}

export default function ProblemInput({ statement, loading, assessing, onChange, onAnalyze, onAssess }: ProblemInputProps) {
  // Count Unicode code points, as Python does, rather than UTF-16 code units.
  const count = Array.from(statement.trim()).length
  const valid = count >= MIN_STATEMENT_LENGTH && count <= MAX_STATEMENT_LENGTH
  const validationMessage = count === 0 ? null : count < MIN_STATEMENT_LENGTH
    ? `Add at least ${MIN_STATEMENT_LENGTH} characters to continue.`
    : count > MAX_STATEMENT_LENGTH ? `Shorten the statement to ${MAX_STATEMENT_LENGTH.toLocaleString()} characters or fewer.` : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valid && !loading) onAnalyze()
  }

  return (
    <section aria-labelledby="input-title" className="panel lg:sticky lg:top-6">
      <div className="mb-6 flex items-center gap-3"><span className="step">01</span><h2 id="input-title" className="text-lg font-semibold">Start with a problem</h2></div>
      <form onSubmit={submit} aria-busy={loading}>
        <label htmlFor="statement" className="mb-2 block text-sm font-medium">Problem statement</label>
        <p id="statement-help" className="mb-3 text-sm leading-6 text-slate-500">Include the statement, constraints, and examples. Your text goes to the backend; in Groq mode it is also sent to Groq. Demo Mode returns a fixed, unrelated example.</p>
        <textarea id="statement" aria-describedby="statement-help statement-count statement-validation" aria-invalid={Boolean(validationMessage)} value={statement} disabled={loading} onChange={event => onChange(event.target.value)} placeholder="Paste a competitive programming problem here…" className="min-h-80 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm leading-6 placeholder:text-slate-400 disabled:opacity-70" />
        <p id="statement-count" className="mt-2 text-xs text-slate-500">{count.toLocaleString()} / {MAX_STATEMENT_LENGTH.toLocaleString()} characters · minimum {MIN_STATEMENT_LENGTH}, after trimming</p>
        <p id="statement-validation" className="mt-2 min-h-5 text-sm text-amber-800">{validationMessage}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={!statement || loading} onClick={() => onChange('')} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
          <button type="submit" disabled={!valid || loading} className="rounded-lg bg-teal-800 px-5 py-3 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40">{loading && !assessing ? 'Analyzing…' : 'Analyze Problem'}</button>
        </div>
        <button type="button" disabled={!valid || loading} onClick={onAssess} className="mt-3 w-full rounded-lg border border-teal-800 px-4 py-3 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40">{loading && assessing ? 'Assessing…' : 'Assess constraints only'}</button>
        <p className="mt-2 text-xs text-slate-500">Constraint-only assessment is offline and uses no AI quota.</p>
      </form>
    </section>
  )
}
