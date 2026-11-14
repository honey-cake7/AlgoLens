import { useState, type ReactNode } from 'react'
import type { AnalyzeResponse } from '../types/api'
import { formatAnalysisText } from '../utils/copyText'
import CopyButton from './CopyButton'

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="result-section" aria-labelledby={id}>
      <h3 id={id} className="result-title">{title}</h3>
      {note && <p className="-mt-2 mb-3 font-mono text-[0.68rem] text-ink-3">{note}</p>}
      {children}
    </section>
  )
}

export default function AnalysisResult({ analysis }: { analysis: AnalyzeResponse }) {
  const [revealed, setRevealed] = useState(0)
  const nextHint = analysis.hints[revealed]
  const isDemo = analysis.analysis_type === 'mock'
  const source = isDemo ? 'Demo example' : 'AI suggestion'

  return (
    <div id="r-analysis" className="stagger mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">{isDemo ? 'Fixed demo' : 'From the AI'}</p><p className="mt-1 font-display text-xl font-semibold">{isDemo ? 'Example walkthrough' : 'Reading the problem'}</p></div>
        <CopyButton label="analysis" getText={() => formatAnalysisText(analysis, revealed)} />
      </div>

      <aside className={`rounded-xl border p-4 text-sm leading-6 ${isDemo ? 'border-warn/50 bg-warn-soft text-ink' : 'border-rule bg-sunk text-ink'}`} aria-label={isDemo ? 'Mock analysis warning' : 'AI analysis notice'}>
        <p className="mb-1 font-semibold">{isDemo ? 'Demo Mode · AI is off · Same example for every problem' : 'AI Analysis'}</p>
        {isDemo ? <>
          <p className="text-ink-2">The sections and hints below are a fixed example, so they will look the same whatever you paste. Only <strong className="text-ink">Constraint &amp; Complexity Analysis</strong> and <strong className="text-ink">Similar Problems</strong> are computed from your text.</p>
          <p className="mt-2 text-ink-2">For real AI analysis, put a free Groq key in the <code>.env</code> file in the project folder and restart the backend.</p>
          <details className="mt-2 text-xs text-ink-3"><summary className="caret font-mono">Details</summary><p className="mt-1">{analysis.demo_notice}</p></details>
        </> : <>
          <p className="mb-2 font-mono text-[0.7rem] text-ink-3">Provider: {analysis.provider}{analysis.model ? ` · Model: ${analysis.model}` : ''}</p>
          <p className="text-ink-2">Model-generated guidance may contain mistakes. Technique suggestions are hypotheses; complexity guidance does not guarantee AC or TLE. Review uncertainties and the original statement.</p>
        </>}
      </aside>

      <section className="result-section" aria-labelledby="essence-title">
        <h3 id="essence-title" className="result-title">Problem Essence</h3>
        <p className="font-display text-[1.05rem] leading-7 text-ink">{analysis.simplified_problem}</p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section id="objective-title" title="Objective">
          <p className="result-copy">{analysis.objective ?? 'Not reliably determined from the statement.'}</p>
        </Section>
        <Section id="io-title" title="Input/Output">
          <p className="eyebrow mb-1">Input</p>
          <p className="result-copy">{analysis.input_summary ?? 'Input requirements were not reliably determined.'}</p>
          <p className="eyebrow mb-1 mt-3">Output</p>
          <p className="result-copy">{analysis.output_summary ?? 'Output requirements were not reliably determined.'}</p>
        </Section>
      </div>

      <Section id="constraints-title" title="Constraints" note={`Source: ${source}; compare with the extracted statement bounds above.`}>
        {analysis.constraints.length === 0 && <p className="result-copy">No constraints were reliably extracted. Check uncertainties.</p>}
        <ul className="space-y-2.5">{analysis.constraints.map((constraint, index) => (
          <li key={index} className="result-copy"><span className="mr-2 rounded-md border border-rule bg-sunk px-1.5 py-0.5 font-mono text-xs text-ink">{constraint.variable}</span>{constraint.expression && <span className="mr-2 font-mono text-xs text-ink">{constraint.expression}</span>}{constraint.description}</li>
        ))}</ul>
      </Section>

      <Section id="complexity-title" title="Complexity Guidance" note={`Source: ${source}. Preliminary guidance; the independent deterministic heuristic appears above.`}>
        {analysis.complexity_guidance.length === 0 && <p className="result-copy">Insufficient evidence for complexity guidance.</p>}
        <div className="space-y-4">{analysis.complexity_guidance.map((item, index) => (
          <div key={index} className="border-l-2 border-ink pl-3">
            <p className="font-mono text-sm font-semibold text-ink">{item.complexity}</p>
            <p className="text-sm font-medium">{item.assessment}</p>
            <p className="result-copy mt-1">{item.explanation}</p>
          </div>
        ))}</div>
      </Section>

      <Section id="techniques-title" title="Possible DSA Techniques" note={isDemo ? 'Demo concepts, not predictions for your statement.' : 'Plausible hypotheses, not verified solution techniques.'}>
        {analysis.possible_techniques.length === 0 && <p className="result-copy">No technique was reliably suggested.</p>}
        <ul className="space-y-3">{analysis.possible_techniques.map((technique, index) => (
          <li key={index}><p className="text-sm font-semibold">{technique.name}</p><p className="result-copy mt-0.5">{technique.explanation}</p></li>
        ))}</ul>
      </Section>

      <Section id="observations-title" title="Important Observations">
        {analysis.important_observations.length ? <ul className="list-disc space-y-2 pl-5 marker:text-accent">{analysis.important_observations.map((text, index) => <li key={index} className="result-copy">{text}</li>)}</ul> : <p className="result-copy">No additional observations were provided.</p>}
      </Section>

      <section id="r-hints" className="result-section" aria-labelledby="hints-title">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="hints-title" className="result-title">Progressive Hints</h3>
          <p className="font-mono text-[0.7rem] text-ink-3">{revealed}/{analysis.hints.length} open</p>
        </div>
        <p className="mb-4 text-sm text-ink-2">Reveal one {isDemo ? 'demo ' : ''}hint at a time. Try an observation before continuing.</p>
        <ol className="space-y-3" aria-live="polite">{analysis.hints.slice(0, revealed).map(hint => (
          <li key={hint.level} className="hint-in">
            <div className="hint-card">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-widest text-accent">Hint {hint.level}</p>
                <CopyButton label={`hint ${hint.level}`} getText={() => `Hint ${hint.level}: ${hint.text}`} />
              </div>
              <p className="text-sm leading-6 text-ink" style={{ overflowWrap: 'anywhere' }}>{hint.text}</p>
            </div>
          </li>
        ))}
        {nextHint && <li aria-hidden="true" className="rounded-xl border border-dashed border-rule p-4 text-sm text-ink-3">Hint {nextHint.level} is folded. Take a minute with what you have.</li>}
        </ol>
        {nextHint ? <button className="btn btn-line mt-4 py-2" onClick={() => setRevealed(value => value + 1)}>Reveal Hint {nextHint.level}</button> : <p className="mt-4 font-mono text-[0.7rem] text-ink-3">All three {isDemo ? 'demo ' : ''}hints are revealed.</p>}
      </section>

      <Section id="uncertainties-title" title="Uncertainties">
        {analysis.uncertainties.length ? <ul className="list-disc space-y-2 pl-5 marker:text-warn">{analysis.uncertainties.map((text, index) => <li key={index} className="result-copy">{text}</li>)}</ul> : <p className="result-copy">No uncertainties were reported. This does not establish that the analysis is correct.</p>}
      </Section>
    </div>
  )
}
