import { useState } from 'react'
import type { AnalyzeResponse } from '../types/api'

export default function AnalysisResult({ analysis }: { analysis: AnalyzeResponse }) {
  const [revealed, setRevealed] = useState(0)
  const nextHint = analysis.hints[revealed]
  const isDemo = analysis.analysis_type === 'mock'

  return (
    <div className="space-y-5">
      <aside className={`rounded-xl border p-5 text-sm leading-6 ${isDemo ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-teal-200 bg-teal-50 text-teal-950'}`} aria-label={isDemo ? 'Mock analysis warning' : 'AI analysis notice'}>
        <p className="mb-1 font-semibold">{isDemo ? 'Demo Mode · Fixed example' : 'AI Analysis'}</p>
        <p className="mb-2 text-xs">Provider: {analysis.provider}{analysis.model ? ` · Model: ${analysis.model}` : ''}</p>
        <p>{analysis.demo_notice}</p>
        <p className="mt-2">{isDemo ? 'All sections and hints below describe the example, regardless of what you submitted. Confidence scores are unavailable.' : 'Model-generated guidance may contain mistakes. Technique suggestions are hypotheses; complexity guidance does not guarantee AC or TLE. Review uncertainties and the original statement.'}</p>
      </aside>

      <section className="result-section" aria-labelledby="essence-title">
        <h3 id="essence-title" className="result-title">Problem Essence</h3>
        <p className="result-copy">{analysis.simplified_problem}</p>
      </section>

      <section className="result-section" aria-labelledby="objective-title">
        <h3 id="objective-title" className="result-title">Objective</h3>
        <p className="result-copy">{analysis.objective ?? 'Not reliably determined from the statement.'}</p>
      </section>

      <section className="result-section" aria-labelledby="io-title">
        <h3 id="io-title" className="result-title">Input/Output</h3>
        <p className="mb-1 text-sm font-medium">Input</p>
        <p className="result-copy">{analysis.input_summary ?? 'Input requirements were not reliably determined.'}</p>
        <p className="mb-1 mt-3 text-sm font-medium">Output</p>
        <p className="result-copy">{analysis.output_summary ?? 'Output requirements were not reliably determined.'}</p>
      </section>

      <section className="result-section" aria-labelledby="constraints-title">
        <h3 id="constraints-title" className="result-title">Constraints</h3>
        {analysis.constraints.length === 0 && <p className="result-copy">No constraints were reliably extracted. Check uncertainties.</p>}
        <ul className="space-y-3">{analysis.constraints.map((constraint, index) => (
          <li key={index} className="result-copy"><span className="mr-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">{constraint.variable}</span>{constraint.expression && <span className="mr-2 font-mono text-xs">{constraint.expression}</span>}{constraint.description}</li>
        ))}</ul>
      </section>

      <section className="result-section" aria-labelledby="complexity-title">
        <h3 id="complexity-title" className="result-title">Complexity Guidance</h3>
        <p className="mb-4 text-xs text-slate-500">Preliminary guidance, not a deterministic feasibility estimate or verdict.</p>
        {analysis.complexity_guidance.length === 0 && <p className="result-copy">Insufficient evidence for complexity guidance.</p>}
        <div className="space-y-4">{analysis.complexity_guidance.map((item, index) => (
          <div key={index}>
            <p className="mb-1 font-mono text-sm font-semibold text-teal-900">{item.complexity}</p>
            <p className="text-sm font-medium">{item.assessment}</p>
            <p className="result-copy mt-1">{item.explanation}</p>
          </div>
        ))}</div>
      </section>

      <section className="result-section" aria-labelledby="techniques-title">
        <h3 id="techniques-title" className="result-title">Possible DSA Techniques</h3>
        <p className="mb-4 text-xs text-slate-500">{isDemo ? 'Demo concepts, not predictions for your statement.' : 'Plausible hypotheses, not verified solution techniques.'}</p>
        {analysis.possible_techniques.length === 0 && <p className="result-copy">No technique was reliably suggested.</p>}
        <ul className="space-y-4">{analysis.possible_techniques.map((technique, index) => (
          <li key={index}><p className="text-sm font-medium">{technique.name}</p><p className="result-copy mt-1">{technique.explanation}</p></li>
        ))}</ul>
      </section>

      <section className="result-section" aria-labelledby="observations-title">
        <h3 id="observations-title" className="result-title">Important Observations</h3>
        {analysis.important_observations.length ? <ul className="list-disc space-y-2 pl-5">{analysis.important_observations.map((text, index) => <li key={index} className="result-copy">{text}</li>)}</ul> : <p className="result-copy">No additional observations were provided.</p>}
      </section>

      <section className="result-section" aria-labelledby="hints-title">
        <h3 id="hints-title" className="result-title">Progressive Hints</h3>
        <p className="mb-4 text-sm text-slate-500">Reveal one {isDemo ? 'demo ' : ''}hint at a time. Try an observation before continuing.</p>
        <ol className="space-y-3" aria-live="polite">{analysis.hints.slice(0, revealed).map(hint => (
          <li key={hint.level} className="rounded-lg bg-teal-50 p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Hint {hint.level}</p><p className="result-copy">{hint.text}</p></li>
        ))}</ol>
        {nextHint ? <button className="mt-4 rounded-lg border border-teal-800 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50" onClick={() => setRevealed(value => value + 1)}>Reveal Hint {nextHint.level}</button> : <p className="mt-4 text-xs text-slate-500">All three {isDemo ? 'demo ' : ''}hints are revealed.</p>}
      </section>

      <section className="result-section" aria-labelledby="uncertainties-title">
        <h3 id="uncertainties-title" className="result-title">Uncertainties</h3>
        {analysis.uncertainties.length ? <ul className="list-disc space-y-2 pl-5">{analysis.uncertainties.map((text, index) => <li key={index} className="result-copy">{text}</li>)}</ul> : <p className="result-copy">No uncertainties were reported. This does not establish that the analysis is correct.</p>}
      </section>
    </div>
  )
}
