import { useState, type FormEvent } from 'react'
import HealthIndicator from './components/HealthIndicator'

export default function App() {
  const [statement, setStatement] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (statement.trim()) setSubmitted(true)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <a href="#main" className="flex items-center gap-3 font-semibold tracking-tight text-slate-900">
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-teal-800 font-mono text-sm text-white">aL</span>
            <span>AlgoLens <span className="font-normal text-teal-700">AI</span></span>
          </a>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Stage 0 · Foundation preview</span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">Understand first. Solve with confidence.</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">Find the problem<br />behind the story.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">A learning workspace for competitive programming. Our goal is to help you unpack statements, understand constraints, and discover your own approach.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section aria-labelledby="input-title" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3"><span className="step">01</span><h2 id="input-title" className="text-lg font-semibold">Start with a problem</h2></div>
            <form onSubmit={handleAnalyze}>
              <label htmlFor="statement" className="mb-2 block text-sm font-medium">Problem statement</label>
              <p id="statement-help" className="mb-3 text-sm leading-6 text-slate-500">Paste the statement, constraints, and examples. In this preview, your text stays in this page and is not sent for analysis.</p>
              <textarea id="statement" aria-describedby="statement-help" value={statement} onChange={event => { setStatement(event.target.value); setSubmitted(false) }} placeholder="Paste a competitive programming problem here…" className="min-h-72 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm leading-6 placeholder:text-slate-400" />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{statement.length.toLocaleString()} characters</span>
                <button type="submit" disabled={!statement.trim()} className="rounded-lg bg-teal-800 px-5 py-3 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40">Analyze <span aria-hidden="true">↗</span></button>
              </div>
            </form>
          </section>

          <section aria-labelledby="result-title" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3"><span className="step">02</span><h2 id="result-title" className="text-lg font-semibold">Make sense of it</h2></div>
            <div role="status" className="rounded-xl border border-dashed border-teal-800/25 bg-teal-50/60 p-6">
              <p className="font-medium text-teal-950">{submitted ? 'Analysis integration coming in the next stage' : 'Your learning journey starts here'}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{submitted ? 'This button currently demonstrates the interaction only. No analysis was generated. Stage 1 will introduce clearly labeled mock responses; LLM integration is planned for Stage 2.' : 'This is a foundation preview. AI analysis is not connected yet. Add a statement to try the placeholder interaction.'}</p>
            </div>
            <p className="mb-3 mt-7 text-xs font-semibold uppercase tracking-wider text-slate-500">Planned learning tools</p>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex justify-between gap-3"><span>Story-free problem representation</span><span className="text-slate-400">Planned</span></li>
              <li className="flex justify-between gap-3"><span>Constraint & complexity guidance</span><span className="text-slate-400">Planned</span></li>
              <li className="flex justify-between gap-3"><span>Progressive Socratic hints</span><span className="text-slate-400">Planned</span></li>
            </ul>
          </section>
        </div>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>Built for learning, one observation at a time.</p>
          <HealthIndicator />
        </footer>
      </main>
    </div>
  )
}
