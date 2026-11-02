import type { AlgorithmicAssessment } from '../types/algorithmic'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function maybeText(value: unknown) { return value === null || text(value) }
function strings(value: unknown) { return Array.isArray(value) && value.every(text) }
function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) }
function maybeNumber(value: unknown) { return value === null || number(value) }
function bound(value: unknown) { return value === null || (typeof value === 'number' && Number.isSafeInteger(value)) }
function oneOf(value: unknown, values: readonly string[]) { return typeof value === 'string' && values.includes(value) }
const scopes = ['global', 'per_test_case', 'sum_over_test_cases', 'unknown']
const roles = ['array_length', 'sequence_length', 'size', 'vertices', 'edges', 'queries', 'test_cases', 'element_value', 'unknown']
const reliability = ['explicit', 'contextual', 'ambiguous', 'conflicting']

function parameter(value: unknown): value is Record<string, unknown> {
  return record(value) && text(value.variable) && bound(value.lower_bound) && bound(value.upper_bound) &&
    oneOf(value.scope, scopes) && oneOf(value.role, roles) && oneOf(value.reliability, reliability)
}

export function isAlgorithmicAssessment(value: unknown): value is AlgorithmicAssessment {
  if (!record(value) || value.source !== 'deterministic' || !record(value.extraction)) return false
  const extraction = value.extraction
  const cases = extraction.test_cases
  return Array.isArray(extraction.constraints) && extraction.constraints.every(item =>
    parameter(item) && text(item.source_text) && text(item.normalized_expression) && maybeText(item.meaning_evidence)) &&
    Array.isArray(extraction.size_parameters) && extraction.size_parameters.every(item => parameter(item) && text(item.meaning_evidence)) &&
    record(cases) && typeof cases.present === 'boolean' && maybeText(cases.variable) &&
    bound(cases.lower_bound) && bound(cases.upper_bound) && oneOf(cases.reliability, reliability) &&
    Array.isArray(extraction.resource_limits) && extraction.resource_limits.every(item =>
      record(item) && oneOf(item.kind, ['time', 'memory']) && number(item.amount) &&
      oneOf(item.unit, ['seconds', 'MB', 'MiB', 'GB', 'GiB', 'KB', 'KiB']) && text(item.source_text)) &&
    strings(extraction.uncertainties) && maybeText(value.selected_parameter) &&
    Array.isArray(value.assessments) && value.assessments.every(item =>
      record(item) && text(item.complexity) && maybeText(item.parameter) &&
      oneOf(item.scope, ['per_instance', 'all_test_cases']) &&
      oneOf(item.assessment, ['promising', 'possibly_feasible', 'likely_infeasible', 'insufficient_information']) &&
      maybeNumber(item.estimated_work) && maybeNumber(item.log10_work) && maybeText(item.work_display) &&
      oneOf(item.work_kind, ['growth_at_bound', 'total_upper_bound', 'unavailable']) &&
      text(item.explanation) && strings(item.caveats)) &&
    strings(value.uncertainties) && strings(value.discrepancies) && strings(value.caveats)
}
