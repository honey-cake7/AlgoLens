import { useEffect, useRef, useState } from 'react'
import AnalysisResult from './components/AnalysisResult'
import AlgorithmicResult from './components/AlgorithmicResult'
import HealthIndicator from './components/HealthIndicator'
import GrowthScrubber from './components/GrowthScrubber'
import HowItWorks from './components/HowItWorks'
import LensSpecimen from './components/LensSpecimen'
import ProblemInput from './components/ProblemInput'
import ResultNav from './components/ResultNav'
import SimilarProblems from './components/SimilarProblems'
import ThemeToggle from './components/ThemeToggle'
import { usePageScroll, useScrollProgress } from './hooks/useScrollEffects'
import { analyzeProblem, assessProblem, findSimilarProblems } from './services/api'
import type { SimilarResponse } from './types/retrieval'
import type { AnalyzeResponse } from './types/api'
import type { AlgorithmicAssessment } from './types/algorithmic'

type Operation = 'analysis' | 'assessment' | 'similar'
const LOADING_TEXT: Record<Operation, string> = {
  assessment: 'Assessing constraints offline…',
  similar: 'Searching local practice problems…',
  analysis: 'Requesting analysis from the backend…',
}

export default function App() {
  const [statement, setStatement] = useState('')
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [assessment, setAssessment] = useState<AlgorithmicAssessment | null>(null)
  const [similar, setSimilar] = useState<SimilarResponse | null>(null)
  const [operation, setOperation] = useState<Operation | null>(null)
  const loading = operation !== null
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const results = useRef<HTMLElement>(null)
  const { scrolled, bar } = usePageScroll()
  const hero = useScrollProgress<HTMLElement>('exit', undefined, 0)

  useEffect(() => () => request.current?.abort(), [])

  function changeStatement(value: string) {
    setStatement(value)
    setAnalysis(null)
    setAssessment(null)
    setSimilar(null)
    setError(null)
  }

  async function handleAnalyze(mode: Operation = 'analysis') {
    // A ref closes the gap before React renders the disabled submit button.
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setOperation(mode)
    setError(null)
    setAnalysis(null)
    setAssessment(null)
    setSimilar(null)
    // On narrow screens the results sit below the input; bring them into view.
    if (window.matchMedia('(max-width: 1023px)').matches) results.current?.scrollIntoView({ block: 'start' })
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

  const mode = analysis ? analysis.analysis_type === 'ai' ? 'AI Analysis' : 'Demo Mode' : assessment ? 'Offline Assessment' : similar ? 'Local Practice Search' : 'Learning workspace'
  const navItems = [
    ...(assessment ? [{ id: 'r-constraints', label: 'Constraints' }] : []),
    ...(analysis ? [{ id: 'r-analysis', label: analysis.analysis_type === 'ai' ? 'AI analysis' : 'Demo' }, { id: 'r-hints', label: 'Hints' }] : []),
    ...(similar ? [{ id: 'r-similar', label: 'Similar' }] : []),
  ]
  const empty = !loading && !error && !analysis && !assessment && !similar

  return (
    <div className="min-h-screen">
      <div ref={bar} aria-hidden="true" className="scroll-progress" />
      <header data-scrolled={scrolled} className="site-header sticky top-0 z-50">
        <div className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 ${scrolled ? 'py-2.5' : 'py-4'}`} style={{ transition: 'padding 0.3s' }}>
          <a href="#main" className="wordmark flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-ink">
            <svg aria-hidden="true" className="wordmark-lens" width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2.2" /><path d="M17 17l6 6" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" /><path d="M7.5 11h7" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" /></svg>
            <span>AlgoLens</span>
          </a>
          <div className="flex items-center gap-2.5">
            <span className="chip"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${analysis?.analysis_type === 'ai' ? 'bg-ok' : analysis ? 'bg-warn' : 'bg-accent'}`} />{mode}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section ref={hero} className="hero-scroll grid items-center gap-10 pb-14 pt-10 sm:pt-16 lg:min-h-[calc(100svh-3rem)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14 lg:pb-16 lg:pt-6">
          <div className="hero-copy">
            <p className="eyebrow fade-up">For competitive programmers who want to understand, not just pass</p>
            <h1 className="hero-title mt-5 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl">
              <span className="line"><span>Read the problem.</span></span>
              <span className="line"><span>Find the <span className="ital">algorithm</span></span></span>
              <span className="line"><span>hiding in the story.</span></span>
            </h1>
            <p className="fade-up mt-6 max-w-lg text-base leading-7 text-ink-2" style={{ ['--d' as string]: '0.3s' }}>Paste a statement. AlgoLens reads the limits, says which running times fit, finds practice problems like it, and gives hints one at a time.</p>
            <div className="fade-up mt-8 flex flex-wrap items-center gap-4" style={{ ['--d' as string]: '0.42s' }}>
              <a href="#workspace" className="btn btn-primary px-6">Paste a problem <span aria-hidden="true">↓</span></a>
              <span className="font-mono text-[0.72rem] text-ink-3">Constraints &amp; search run offline · AI hints need a free Groq key</span>
            </div>
          </div>
          <div className="hero-art"><div className="fade-up" style={{ ['--d' as string]: '0.2s' }}><LensSpecimen /></div></div>
        </section>

        <div id="workspace" className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ProblemInput statement={statement} loading={loading} assessing={operation === 'assessment'} searching={operation === 'similar'} onChange={changeStatement} onAnalyze={() => handleAnalyze()} onAssess={() => handleAnalyze('assessment')} onSimilar={() => handleAnalyze('similar')} />
          <section ref={results} aria-labelledby="result-title" className="panel min-w-0 scroll-mt-20">
            <div className="mb-5 flex items-center gap-3"><span className="step">02</span><h2 id="result-title" className="font-display text-xl font-semibold">Explore the analysis</h2></div>
            <ResultNav items={navItems} />
            {loading && operation && <div role="status" className="scan rise flex items-center gap-4 rounded-xl border border-rule bg-sunk p-5 text-sm text-ink"><span aria-hidden="true" className="dots"><span /><span /><span /></span>{LOADING_TEXT[operation]}</div>}
            {error && <div role="alert" className="rise rounded-xl border border-bad/40 bg-bad-soft p-5 text-sm leading-6 text-ink"><p className="font-semibold text-bad">Analysis request failed</p><p className="mt-1">{error}</p><p className="mt-2 text-ink-2">Your statement is preserved. Retry, or use Assess constraints only for an offline assessment without an AI request.</p></div>}
            {empty && <div className="rounded-xl border border-dashed border-rule p-6">
              <p className="font-display text-lg font-semibold">Ready when you are</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-ink-2">
                <li className="flex gap-3"><span className="font-mono text-accent">→</span><span><strong className="text-ink">Analyze Problem</strong>: everything below, plus AI hints (needs a Groq key on the backend; otherwise a fixed demo).</span></li>
                <li className="flex gap-3"><span className="font-mono text-accent">→</span><span><strong className="text-ink">Assess constraints only</strong>: reads the bounds and estimates which complexities fit.</span></li>
                <li className="flex gap-3"><span className="font-mono text-accent">→</span><span><strong className="text-ink">Find similar problems</strong>: practice problems from the local catalog.</span></li>
              </ul>
            </div>}
            {assessment && <AlgorithmicResult result={assessment} />}
            {analysis && <AnalysisResult analysis={analysis} />}
            {analysis?.retrieval_warning && <p role="status" className="mt-4 rounded-xl bg-warn-soft p-3 text-sm text-ink">{analysis.retrieval_warning}</p>}
            {similar && <SimilarProblems key={similar.query} result={similar} collapsed={Boolean(analysis)} />}
          </section>
        </div>

        <GrowthScrubber />

        <HowItWorks />

        <footer className="mt-24 flex flex-wrap items-end justify-between gap-6 border-t border-rule pt-6">
          <div>
            <p className="font-display text-lg font-semibold">AlgoLens</p>
            <p className="mt-1 text-xs text-ink-3">Built for learning, one observation at a time.</p>
          </div>
          <HealthIndicator />
        </footer>
      </main>
    </div>
  )
}
