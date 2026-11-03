import type { AnalyzeResponse } from '../types/api'
import type { AlgorithmicAssessment, Feasibility } from '../types/algorithmic'

const feasibilityLabels: Record<Feasibility, string> = {
  promising: 'Promising',
  possibly_feasible: 'Possibly feasible',
  likely_infeasible: 'Likely infeasible',
  insufficient_information: 'Insufficient information',
}
const humanize = (value: string) => value.replaceAll('_', ' ')
const numeric = (value: number | null) => (value === null ? 'unknown' : value.toLocaleString('en-US'))
const bullets = (items: string[]) => items.map(item => `- ${item}`).join('\n')

/** Plain-text version of the AI/Demo analysis. Only hints the user has revealed are included. */
export function formatAnalysisText(analysis: AnalyzeResponse, revealedHints: number): string {
  const isDemo = analysis.analysis_type === 'mock'
  const hints = analysis.hints.slice(0, revealedHints)
  const parts: string[] = [
    `AlgoLens AI — ${isDemo ? 'Demo Mode (fixed example, not about your statement)' : 'AI Analysis'}\nProvider: ${analysis.provider}${analysis.model ? ` · Model: ${analysis.model}` : ''}`,
    `PROBLEM ESSENCE\n${analysis.simplified_problem}`,
    `OBJECTIVE\n${analysis.objective ?? 'Not reliably determined from the statement.'}`,
    `INPUT\n${analysis.input_summary ?? 'Input requirements were not reliably determined.'}\n\nOUTPUT\n${analysis.output_summary ?? 'Output requirements were not reliably determined.'}`,
    `CONSTRAINTS\n${analysis.constraints.length ? bullets(analysis.constraints.map(item => `${item.variable}${item.expression ? ` (${item.expression})` : ''}: ${item.description}`)) : 'None reliably extracted.'}`,
    `COMPLEXITY GUIDANCE\n${analysis.complexity_guidance.length ? bullets(analysis.complexity_guidance.map(item => `${item.complexity} — ${item.assessment}: ${item.explanation}`)) : 'Insufficient evidence.'}`,
    `POSSIBLE DSA TECHNIQUES\n${analysis.possible_techniques.length ? bullets(analysis.possible_techniques.map(item => `${item.name}: ${item.explanation}`)) : 'None reliably suggested.'}`,
    `IMPORTANT OBSERVATIONS\n${analysis.important_observations.length ? bullets(analysis.important_observations) : 'None provided.'}`,
    `HINTS REVEALED (${hints.length} of ${analysis.hints.length})\n${hints.length ? hints.map(hint => `Hint ${hint.level}: ${hint.text}`).join('\n') : 'No hints revealed yet.'}`,
    `UNCERTAINTIES\n${analysis.uncertainties.length ? bullets(analysis.uncertainties) : 'None reported.'}`,
  ]
  if (analysis.demo_notice) parts.splice(1, 0, `NOTE\n${analysis.demo_notice}`)
  return parts.join('\n\n')
}

/** Plain-text version of the deterministic constraint & complexity assessment. */
export function formatAssessmentText(result: AlgorithmicAssessment): string {
  const { extraction } = result
  const cases = extraction.test_cases
  const rows = (scope: string) =>
    result.assessments
      .filter(item => item.scope === scope)
      .map(item => {
        const work = item.work_display === null ? 'work unavailable' : `≈ ${item.work_display}${item.work_kind === 'total_upper_bound' ? ' (upper bound)' : ''}`
        const caveats = item.caveats.map(text => `\n    Assumption: ${text}`).join('')
        return `- ${item.complexity} [${work}] — ${feasibilityLabels[item.assessment]}: ${item.explanation}${caveats}`
      })
      .join('\n')

  const parts: string[] = [
    'AlgoLens AI — Constraint & Complexity Analysis (deterministic heuristic, computed locally; not a verdict prediction)',
    `EXTRACTED NUMERIC CONSTRAINTS\n${extraction.constraints.length
      ? extraction.constraints.map(item => `- ${item.normalized_expression} | lower ${numeric(item.lower_bound)}, upper ${numeric(item.upper_bound)} | ${humanize(item.role)}, ${humanize(item.scope)}, ${item.reliability}\n  Statement: ${item.source_text}`).join('\n')
      : 'No supported numeric constraints found.'}`,
    `SIZE PARAMETERS\n${extraction.size_parameters.length
      ? bullets(extraction.size_parameters.map(item => `${item.variable} — ${humanize(item.role)}, upper bound ${numeric(item.upper_bound)} (${item.reliability})`))
      : 'No variable was reliably linked to an input-size meaning.'}`,
    `TEST CASES\n${cases.present ? `Multiple test cases. ${cases.variable ?? 'Count variable unknown'}: lower ${numeric(cases.lower_bound)}, upper ${numeric(cases.upper_bound)}.` : 'No multiple-test-case declaration recognized; estimates describe one instance.'}`,
  ]
  if (extraction.resource_limits.length) {
    parts.push(`RESOURCE LIMITS\n${bullets(extraction.resource_limits.map(item => `${item.kind}: ${item.amount} ${item.unit}`))}`)
  }
  parts.push(result.selected_parameter ? `PRIMARY SIZE PROFILE: ${result.selected_parameter}` : 'GROWTH ASSESSMENT: unavailable')
  const perInstance = rows('per_instance')
  if (perInstance) parts.push(`PER-INSTANCE GROWTH (abstract work, not seconds)\n${perInstance}`)
  const allCases = rows('all_test_cases')
  if (allCases) parts.push(`ALL TEST CASES: CONSERVATIVE BOUNDS (abstract work, not seconds)\n${allCases}`)
  if (result.discrepancies.length) parts.push(`POSSIBLE DISAGREEMENTS\n${bullets(result.discrepancies)}`)
  if (result.uncertainties.length) parts.push(`UNCERTAINTIES\n${bullets(result.uncertainties)}`)
  if (result.caveats.length) parts.push(`HOW TO READ THESE HEURISTICS\n${bullets(result.caveats)}`)
  return parts.join('\n\n')
}
