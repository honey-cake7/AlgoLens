import { useEffect, useRef, useState } from 'react'
import AnalysisResult from './components/AnalysisResult'
import AlgorithmicResult from './components/AlgorithmicResult'
import HealthIndicator from './components/HealthIndicator'
import ProblemInput from './components/ProblemInput'
import SimilarProblems from './components/SimilarProblems'
import { analyzeProblem, assessProblem, findSimilarProblems } from './services/api'
import type { SimilarResponse } from './types/retrieval'
import type { AnalyzeResponse } from './types/api'
import type { AlgorithmicAssessment } from './types/algorithmic'

export default function App() {
  const [statement, setStatement] = useState('')
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [assessment, setAssessment] = useState<AlgorithmicAssessment | null>(null)
  const [similar, setSimilar] = useState<SimilarResponse | null>(null)
  const [operation, setOperation] = useState<'analysis' | 'assessment' | 'similar' | null>(null)
  const loading = operation !== null
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  function changeStatement(value: string) {
    setStatement(value)
    setAnalysis(null)
    setAssessment(null)
    setSimilar(null)
    setError(null)
  }

  async function handleAnalyze(mode: 'analysis' | 'assessment' | 'similar' = 'analysis') {
    // A ref closes the gap before React renders the disabled submit button.
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setOperation(mode)
    setError(null)
    setAnalysis(null)
    setAssessment(null)
    setSimilar(null)
    try {
      if (mode === 'assessment') {
        const result = await assessProblem(statement, controller.signal)
        if (!controller.signal.aborted) setAssessment(result)
      } else if (mode === 'similar') {
        const result = await findSimilarProblems(statement, controller.signal)
        if (!controller.signal.aborted) setSimilar(result)
      } else {
        const result = await analyzeProblem(statement, controller.signal)
        if (!controller.signal.aborted) {
          setAnalysis(result)
          setAssessment(result.deterministic)
          setSimilar(result.similar_problems ?? null)
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'The request failed. Please try again.')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setOperation(null)
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
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{analysis ? analysis.analysis_type === 'ai' ? 'AI Analysis' : 'Demo Mode' : assessment ? 'Offline Assessment' : similar ? 'Local Practice Search' : 'Stage 4 · Learning workspace'}</span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">A workspace for learning</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">Understand the algorithm behind the story.</h1>
          <p className="mt-5 text-base leading-7 text-slate-600">Paste a competitive programming problem and AlgoLens will help identify its underlying structure, constraints, complexity requirements, and solution direction.</p>
          <p className="mt-3 text-sm leading-6 text-teal-900">Constraint and growth assessment works offline. AI Analysis uses Groq only when enabled on the backend; Demo Mode provides a fixed teaching example. Check all suggestions against the original statement.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ProblemInput statement={statement} loading={loading} assessing={operation === 'assessment'} searching={operation === 'similar'} onChange={changeStatement} onAnalyze={() => handleAnalyze()} onAssess={() => handleAnalyze('assessment')} onSimilar={() => handleAnalyze('similar')} />
          <section aria-labelledby="result-title" className="panel min-w-0">
            <div className="mb-6 flex items-center gap-3"><span className="step">02</span><h2 id="result-title" className="text-lg font-semibold">Explore the analysis</h2></div>
            {loading && <p role="status" className="rounded-xl bg-teal-50 p-6 text-sm text-teal-950">{operation === 'assessment' ? 'Assessing constraints offline…' : operation === 'similar' ? 'Searching local practice problems…' : 'Requesting analysis from the backend…'}</p>}
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-900"><p className="font-semibold">Analysis request failed</p><p className="mt-1">{error}</p><p className="mt-2">Your statement is preserved. Retry, or use Assess constraints only for an offline assessment without an AI request.</p></div>}
            {!loading && !error && !analysis && !assessment && !similar && <div className="rounded-xl border border-dashed border-teal-800/25 bg-teal-50/60 p-6"><p className="font-medium text-teal-950">Ready when you are</p><p className="mt-3 text-sm leading-6 text-slate-600">Describe what each variable counts and include its bounds. Assess constraints only performs local parsing and growth estimates. Analyze Problem also requests the configured provider's educational guidance and three progressively revealed hints.</p></div>}
            {assessment && <div className="mb-6"><AlgorithmicResult result={assessment} /></div>}
            {analysis && <AnalysisResult analysis={analysis} />}
            {analysis?.retrieval_warning && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{analysis.retrieval_warning}</p>}
            {similar && <SimilarProblems key={similar.query} result={similar} collapsed={Boolean(analysis)} />}
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
