import { useEffect, useRef, useState } from 'react'
import AnalysisResult from './components/AnalysisResult'
import HealthIndicator from './components/HealthIndicator'
import ProblemInput from './components/ProblemInput'
import { analyzeProblem } from './services/api'
import type { AnalyzeResponse } from './types/api'

export default function App() {
  const [statement, setStatement] = useState('')
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  function changeStatement(value: string) {
    setStatement(value)
    setAnalysis(null)
    setError(null)
  }

  async function handleAnalyze() {
    // A ref closes the gap before React renders the disabled submit button.
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const result = await analyzeProblem(statement, controller.signal)
      if (!controller.signal.aborted) setAnalysis(result)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'The request failed. Please try again.')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <a href="#main" className="flex items-center gap-3 font-semibold tracking-tight text-slate-900">
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-teal-800 font-mono text-sm text-white">aL</span>
            <span>AlgoLens <span className="font-normal text-teal-700">AI</span></span>
          </a>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{analysis ? analysis.analysis_type === 'ai' ? 'AI Analysis' : 'Demo Mode' : 'Stage 2 · Learning workspace'}</span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">A workspace for learning</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">Understand the algorithm behind the story.</h1>
          <p className="mt-5 text-base leading-7 text-slate-600">Paste a competitive programming problem and AlgoLens will help identify its underlying structure, constraints, complexity requirements, and solution direction.</p>
          <p className="mt-3 text-sm leading-6 text-teal-900">Demo Mode works offline by default. AI Analysis uses Groq only when enabled on the backend. Model suggestions should be checked against the original statement.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ProblemInput statement={statement} loading={loading} onChange={changeStatement} onAnalyze={handleAnalyze} />
          <section aria-labelledby="result-title" className="panel min-w-0">
            <div className="mb-6 flex items-center gap-3"><span className="step">02</span><h2 id="result-title" className="text-lg font-semibold">Explore the analysis</h2></div>
            {loading && <p role="status" className="rounded-xl bg-teal-50 p-6 text-sm text-teal-950">Requesting analysis from the backend…</p>}
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-900"><p className="font-semibold">Analysis request failed</p><p className="mt-1">{error}</p><p className="mt-2">Your statement is preserved. You can retry with Analyze Problem.</p></div>}
            {!loading && !error && !analysis && <div className="rounded-xl border border-dashed border-teal-800/25 bg-teal-50/60 p-6"><p className="font-medium text-teal-950">Ready when you are</p><p className="mt-3 text-sm leading-6 text-slate-600">Submit a statement to explore its structure, objective, input/output, constraints, technique hypotheses, observations, and uncertainties. Three hints stay hidden until you reveal them. The result identifies whether it came from Demo Mode or AI Analysis.</p></div>}
            {analysis && <AnalysisResult analysis={analysis} />}
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
