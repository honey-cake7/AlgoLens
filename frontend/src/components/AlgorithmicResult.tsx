import type { AlgorithmicAssessment, ComplexityAssessment, Feasibility } from '../types/algorithmic'

const labels: Record<Feasibility, string> = {
  promising: 'Promising', possibly_feasible: 'Possibly feasible',
  likely_infeasible: 'Likely infeasible', insufficient_information: 'Insufficient information',
}
const colors: Record<Feasibility, string> = {
  promising: 'text-teal-900', possibly_feasible: 'text-amber-900',
  likely_infeasible: 'text-rose-800', insufficient_information: 'text-slate-500',
}
const humanize = (value: string) => value.replaceAll('_', ' ')
const numeric = (value: number | null) => value === null ? 'unknown' : value.toLocaleString('en-US')

function GrowthTable({ rows, caption }: { rows: ComplexityAssessment[]; caption: string }) {
  if (rows.length === 0) return null
  if (rows.every(item => item.assessment === 'insufficient_information')) return <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{caption} unavailable: {rows[0].explanation}</p>
  return <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200" role="region" aria-label={caption} tabIndex={0}>
    <table className="w-full min-w-[34rem] text-left text-xs leading-5">
      <caption className="bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">{caption} · abstract work, not seconds</caption>
      <thead className="border-y border-slate-200 bg-slate-50"><tr><th scope="col" className="p-3">Complexity / work</th><th scope="col" className="p-3">Assessment</th><th scope="col" className="p-3">Explanation</th></tr></thead>
      <tbody>{rows.map((item, index) => <tr key={index} className="border-t border-slate-200 align-top">
        <td className="p-3"><p className="whitespace-nowrap font-mono font-medium">{item.complexity}</p><p className="mt-1 text-slate-500">{item.work_display === null ? 'Unavailable' : `≈ ${item.work_display}`}</p>{item.work_kind === 'total_upper_bound' && <p className="text-slate-500">Upper bound</p>}</td>
        <td className={`p-3 font-medium ${colors[item.assessment]}`}>{labels[item.assessment]}</td>
        <td className="p-3 text-slate-600"><p>{item.explanation}</p>{item.caveats.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-teal-800">Assumptions</summary><ul className="mt-1 list-disc space-y-1 pl-4">{item.caveats.map((text, key) => <li key={key}>{text}</li>)}</ul></details>}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

export default function AlgorithmicResult({ result }: { result: AlgorithmicAssessment }) {
  const { extraction } = result
  const cases = extraction.test_cases
  return <section aria-labelledby="algorithmic-title" className="rounded-xl border border-teal-200 bg-white p-4 sm:p-5">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-800">Extracted from statement · Deterministic heuristic</p>
    <h3 id="algorithmic-title" className="text-lg font-semibold">Constraint &amp; Complexity Analysis</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">Computed locally from your submitted text in every mode, including Demo Mode. Provider examples and AI suggestions are shown separately. This does not identify the correct algorithm or guarantee a verdict.</p>

    <h4 className="mb-3 mt-5 text-sm font-semibold">Extracted numeric constraints</h4>
    {extraction.constraints.length === 0 ? <p className="result-copy">No supported numeric constraints found. Describe each variable and include explicit bounds.</p> : <ul className="space-y-3">{extraction.constraints.map((item, index) => <li key={index} className="rounded-lg bg-slate-50 p-3 text-xs leading-5">
      <p className="break-words font-mono font-medium">{item.normalized_expression}</p>
      <p className="mt-1 text-slate-600">Lower: {numeric(item.lower_bound)} · Upper: {numeric(item.upper_bound)}</p>
      <p className="mt-1 text-slate-600">{humanize(item.role)} · {humanize(item.scope)} · {item.reliability}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-slate-500">Statement: {item.source_text}</p>
      {item.meaning_evidence && <details className="mt-1 text-slate-600"><summary className="cursor-pointer">Meaning evidence</summary><p className="mt-1 break-words">{item.meaning_evidence}</p></details>}
    </li>)}</ul>}

    <h4 className="mb-2 mt-5 text-sm font-semibold">Size parameters and test cases</h4>
    {extraction.size_parameters.length ? <ul className="space-y-2 text-xs leading-5 text-slate-600">{extraction.size_parameters.map((item, index) => <li key={index}><span className="font-mono font-semibold">{item.variable}</span> — {humanize(item.role)}, upper bound {numeric(item.upper_bound)} ({item.reliability})</li>)}</ul> : <p className="result-copy">No variable was reliably linked to an input-size meaning. Value bounds alone are not array lengths.</p>}
    <p className="mt-3 text-xs leading-5 text-slate-600">{cases.present ? `Multiple test cases mentioned. ${cases.variable ?? 'Count variable unknown'}: lower ${numeric(cases.lower_bound)}, upper ${numeric(cases.upper_bound)}.` : 'No multiple-test-case declaration was recognized; estimates describe one instance.'}</p>
    {extraction.constraints.some(item => item.scope === 'sum_over_test_cases') && <p className="mt-2 text-xs leading-5 text-teal-900">Aggregate caps are shown above. They constrain total sizes; they do not give the same bound for quadratic or other nonlinear total work.</p>}
    {extraction.resource_limits.length > 0 && <div className="mt-4"><h4 className="text-sm font-semibold">Resource limits · separate context</h4><ul className="mt-2 space-y-1 text-xs text-slate-600">{extraction.resource_limits.map((item, index) => <li key={index}>{item.kind}: {item.amount} {item.unit} — {item.source_text}</li>)}</ul></div>}

    <p className="mt-5 text-sm font-medium">{result.selected_parameter ? `Primary size profile: ${result.selected_parameter}` : 'Growth assessment unavailable'}</p>
    <p className="mt-1 text-xs leading-5 text-slate-500">Generic n in the standard rows denotes the selected size parameter. Scroll tables horizontally when needed. Estimates use stated maxima and explicit assumptions, not measured operations.</p>
    <GrowthTable rows={result.assessments.filter(item => item.scope === 'per_instance')} caption="Per-instance growth" />
    <GrowthTable rows={result.assessments.filter(item => item.scope === 'all_test_cases')} caption="All test cases: conservative bounds" />

    {result.discrepancies.length > 0 && <aside aria-label="Potential source discrepancies" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"><p className="font-semibold">Review a possible disagreement</p>{result.discrepancies.map((text, index) => <p key={index} className="mt-2">{text}</p>)}</aside>}
    {result.uncertainties.length > 0 && <div className="mt-5"><h4 className="text-sm font-semibold">Deterministic uncertainties</h4><ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-600">{result.uncertainties.map((text, index) => <li key={index}>{text}</li>)}</ul></div>}
    <details className="mt-5 text-xs leading-5 text-slate-600" open><summary className="cursor-pointer font-semibold">How to read these heuristics</summary><ul className="mt-2 list-disc space-y-2 pl-4">{result.caveats.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
  </section>
}
