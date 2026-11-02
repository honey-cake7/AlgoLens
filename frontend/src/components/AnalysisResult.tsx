import { useState } from 'react'
import type { AnalyzeResponse } from '../types/api'

export default function AnalysisResult({ analysis }: { analysis: AnalyzeResponse }) {
  const [revealed, setRevealed] = useState(0)
  const nextHint = analysis.hints[revealed]

  return (
    <div className="space-y-5">
      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950" aria-label="Mock analysis warning">
        <p className="mb-1 font-semibold">Demo analysis · Fixed example</p>
        <p>{analysis.demo_notice}</p>
        <p className="mt-2">All sections and hints below describe the example, regardless of what you submitted. Confidence scores are unavailable.</p>
      </aside>

      <section className="result-section" aria-labelledby="essence-title">
        <h3 id="essence-title" className="result-title">Problem Essence</h3>
        <p className="result-copy">{analysis.simplified_problem}</p>
      </section>

      <section className="result-section" aria-labelledby="constraints-title">
        <h3 id="constraints-title" className="result-title">Constraints</h3>
        <ul className="space-y-3">{analysis.constraints.map((constraint, index) => (
          <li key={index} className="result-copy"><span className="mr-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">{constraint.variable}</span>{constraint.description}</li>
        ))}</ul>
      </section>

      <section className="result-section" aria-labelledby="complexity-title">
        <h3 id="complexity-title" className="result-title">Complexity Guidance</h3>
        <div className="space-y-4">{analysis.complexity_guidance.map((item, index) => (
          <div key={index}>
            <p className="mb-1 font-mono text-sm font-semibold text-teal-900">{item.complexity}</p>
            <p className="text-sm font-medium">{item.assessment}</p>
            <p className="result-copy mt-1">{item.explanation}</p>
          </div>
        ))}</div>
      </section>

      <section className="result-section" aria-labelledby="techniques-title">
        <h3 id="techniques-title" className="result-title">Possible Techniques</h3>
        <p className="mb-4 text-xs text-slate-500">Demo concepts, not predictions for your statement.</p>
        <ul className="space-y-4">{analysis.possible_techniques.map((technique, index) => (
          <li key={index}><p className="text-sm font-medium">{technique.name}</p><p className="result-copy mt-1">{technique.explanation}</p></li>
        ))}</ul>
      </section>

      <section className="result-section" aria-labelledby="hints-title">
        <h3 id="hints-title" className="result-title">Progressive Hints</h3>
        <p className="mb-4 text-sm text-slate-500">Reveal one demo hint at a time. Try an observation before continuing.</p>
        <ol className="space-y-3" aria-live="polite">{analysis.hints.slice(0, revealed).map(hint => (
          <li key={hint.level} className="rounded-lg bg-teal-50 p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Hint {hint.level}</p><p className="result-copy">{hint.text}</p></li>
        ))}</ol>
        {nextHint ? <button className="mt-4 rounded-lg border border-teal-800 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50" onClick={() => setRevealed(value => value + 1)}>Reveal Hint {nextHint.level}</button> : <p className="mt-4 text-xs text-slate-500">All three demo hints are revealed.</p>}
      </section>
    </div>
  )
}
