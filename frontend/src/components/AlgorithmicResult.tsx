import type { AlgorithmicAssessment, ComplexityAssessment, Feasibility } from '../types/algorithmic'
import { formatAssessmentText } from '../utils/copyText'
import CopyButton from './CopyButton'

const labels: Record<Feasibility, string> = {
  promising: 'Promising', possibly_feasible: 'Possibly feasible',
  likely_infeasible: 'Likely infeasible', insufficient_information: 'Insufficient information',
}
const pills: Record<Feasibility, string> = {
  promising: 'bg-ok-soft text-ok', possibly_feasible: 'bg-warn-soft text-warn',
  likely_infeasible: 'bg-bad-soft text-bad', insufficient_information: 'bg-sunk text-ink-3',
}
const humanize = (value: string) => value.replaceAll('_', ' ')
const numeric = (value: number | null) => value === null ? 'unknown' : value.toLocaleString('en-US')

function GrowthTable({ rows, caption }: { rows: ComplexityAssessment[]; caption: string }) {
  if (rows.length === 0) return null
  if (rows.every(item => item.assessment === 'insufficient_information')) return <p className="mt-4 rounded-lg bg-sunk p-3 text-xs leading-5 text-ink-2">{caption} unavailable: {rows[0].explanation}</p>
  return <div className="mt-5 overflow-x-auto rounded-xl border border-rule" role="region" aria-label={caption} tabIndex={0}>
    <table className="w-full min-w-[34rem] text-left text-xs leading-5">
      <caption className="border-b border-rule bg-sunk px-3 py-2 text-left font-mono text-[0.7rem] font-semibold text-ink-2">{caption} · abstract work, not seconds</caption>
      <thead className="border-b border-rule"><tr className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-3"><th scope="col" className="p-3 font-medium">Complexity / work</th><th scope="col" className="p-3 font-medium">Assessment</th><th scope="col" className="p-3 font-medium">Explanation</th></tr></thead>
      <tbody>{rows.map((item, index) => <tr key={index} className="border-t border-rule align-top transition-colors hover:bg-sunk/60">
        <td className="p-3"><p className="whitespace-nowrap font-mono font-semibold text-ink">{item.complexity}</p><p className="mt-1 font-mono text-ink-3">{item.work_display === null ? 'Unavailable' : `≈ ${item.work_display}`}</p>{item.work_kind === 'total_upper_bound' && <p className="text-ink-3">Upper bound</p>}</td>
        <td className="p-3"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-medium ${pills[item.assessment]}`}>{labels[item.assessment]}</span></td>
        <td className="p-3 text-ink-2"><p>{item.explanation}</p>{item.caveats.length > 0 && <details className="mt-2"><summary className="caret text-ink">Assumptions</summary><ul className="mt-1 list-disc space-y-1 pl-4">{item.caveats.map((text, key) => <li key={key}>{text}</li>)}</ul></details>}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

export default function AlgorithmicResult({ result }: { result: AlgorithmicAssessment }) {
  const { extraction } = result
  const cases = extraction.test_cases
  return <section id="r-constraints" aria-labelledby="algorithmic-title" className="rise">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="eyebrow">From your text · Deterministic heuristic</p>
        <h3 id="algorithmic-title" className="mt-1 font-display text-xl font-semibold">Constraint &amp; Complexity Analysis</h3>
      </div>
      <CopyButton label="constraint analysis" getText={() => formatAssessmentText(result)} />
    </div>
    <p className="mt-2 text-sm leading-6 text-ink-2">Computed from <strong className="text-ink">your text</strong>, in every mode. It estimates what fits the limits; it does not pick the algorithm.</p>

    <h4 className="eyebrow mb-3 mt-6">Extracted numeric constraints</h4>
    {extraction.constraints.length === 0 ? <p className="result-copy">No supported numeric constraints found. Describe each variable and include explicit bounds.</p> : <ul className="grid gap-2.5 sm:grid-cols-2">{extraction.constraints.map((item, index) => <li key={index} className="rounded-xl border border-rule bg-paper p-3 text-xs leading-5">
      <p className="break-words font-mono text-[0.8rem] font-semibold text-ink">{item.normalized_expression}</p>
      <p className="mt-1 font-mono text-ink-2">{numeric(item.lower_bound)} … {numeric(item.upper_bound)}</p>
      <p className="sr-only">Lower: {numeric(item.lower_bound)} · Upper: {numeric(item.upper_bound)}</p>
      <p className="mt-1 text-ink-3">{humanize(item.role)} · {humanize(item.scope)} · {item.reliability}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-ink-3">Statement: {item.source_text}</p>
      {item.meaning_evidence && <details className="mt-1 text-ink-2"><summary className="caret">Meaning evidence</summary><p className="mt-1 break-words">{item.meaning_evidence}</p></details>}
    </li>)}</ul>}

    <h4 className="eyebrow mb-2 mt-6">Size parameters and test cases</h4>
    {extraction.size_parameters.length ? <ul className="space-y-1.5 text-xs leading-5 text-ink-2">{extraction.size_parameters.map((item, index) => <li key={index}><span className="font-mono font-semibold text-ink">{item.variable}</span> — {humanize(item.role)}, upper bound {numeric(item.upper_bound)} ({item.reliability})</li>)}</ul> : <p className="result-copy">No variable was reliably linked to an input-size meaning. Value bounds alone are not array lengths.</p>}
    <p className="mt-3 text-xs leading-5 text-ink-2">{cases.present ? `Multiple test cases mentioned. ${cases.variable ?? 'Count variable unknown'}: lower ${numeric(cases.lower_bound)}, upper ${numeric(cases.upper_bound)}.` : 'No multiple-test-case declaration was recognized; estimates describe one instance.'}</p>
    {extraction.constraints.some(item => item.scope === 'sum_over_test_cases') && <p className="mt-2 text-xs leading-5 text-ink">Aggregate caps are shown above. They constrain total sizes; they do not give the same bound for quadratic or other nonlinear total work.</p>}
    {extraction.resource_limits.length > 0 && <div className="mt-4"><h4 className="eyebrow">Resource limits · separate context</h4><ul className="mt-2 space-y-1 text-xs text-ink-2">{extraction.resource_limits.map((item, index) => <li key={index}>{item.kind}: {item.amount} {item.unit} — {item.source_text}</li>)}</ul></div>}

    <p className="mt-6 text-sm font-semibold">{result.selected_parameter ? `Primary size profile: ${result.selected_parameter}` : 'Growth assessment unavailable'}</p>
    <p className="mt-1 text-xs leading-5 text-ink-3">n means this size parameter. Estimates use the stated maxima, not measured run times.</p>
    <GrowthTable rows={result.assessments.filter(item => item.scope === 'per_instance')} caption="Per-instance growth" />
    <GrowthTable rows={result.assessments.filter(item => item.scope === 'all_test_cases')} caption="All test cases: conservative bounds" />

    {result.discrepancies.length > 0 && <aside aria-label="Potential source discrepancies" className="mt-5 rounded-xl border border-warn/50 bg-warn-soft p-3 text-sm leading-6 text-ink"><p className="font-semibold">Review a possible disagreement</p>{result.discrepancies.map((text, index) => <p key={index} className="mt-2 text-ink-2">{text}</p>)}</aside>}
    {result.uncertainties.length > 0 && <div className="mt-5"><h4 className="text-sm font-semibold">Deterministic uncertainties</h4><ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-ink-2 marker:text-warn">{result.uncertainties.map((text, index) => <li key={index}>{text}</li>)}</ul></div>}
    <details className="mt-5 text-xs leading-5 text-ink-2"><summary className="caret font-semibold text-ink">How to read these heuristics</summary><ul className="mt-2 list-disc space-y-2 pl-4">{result.caveats.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
  </section>
}
