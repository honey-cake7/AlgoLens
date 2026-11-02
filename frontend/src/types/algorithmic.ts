export type ConstraintScope = 'global' | 'per_test_case' | 'sum_over_test_cases' | 'unknown'
export type ParameterRole = 'array_length' | 'sequence_length' | 'size' | 'vertices' | 'edges' | 'queries' | 'test_cases' | 'element_value' | 'unknown'
export type Reliability = 'explicit' | 'contextual' | 'ambiguous' | 'conflicting'
export type Feasibility = 'promising' | 'possibly_feasible' | 'likely_infeasible' | 'insufficient_information'

export interface ParsedConstraint {
  variable: string
  lower_bound: number | null
  upper_bound: number | null
  source_text: string
  normalized_expression: string
  scope: ConstraintScope
  role: ParameterRole
  reliability: Reliability
  meaning_evidence: string | null
}

export interface SizeParameter {
  variable: string
  role: ParameterRole
  lower_bound: number | null
  upper_bound: number | null
  scope: ConstraintScope
  reliability: Reliability
  meaning_evidence: string
}

export interface TestCases {
  present: boolean
  variable: string | null
  lower_bound: number | null
  upper_bound: number | null
  reliability: Reliability
}

export interface ResourceLimit {
  kind: 'time' | 'memory'
  amount: number
  unit: 'seconds' | 'MB' | 'MiB' | 'GB' | 'GiB' | 'KB' | 'KiB'
  source_text: string
}

export interface ComplexityAssessment {
  complexity: string
  parameter: string | null
  scope: 'per_instance' | 'all_test_cases'
  assessment: Feasibility
  estimated_work: number | null
  log10_work: number | null
  work_display: string | null
  work_kind: 'growth_at_bound' | 'total_upper_bound' | 'unavailable'
  explanation: string
  caveats: string[]
}

export interface AlgorithmicAssessment {
  source: 'deterministic'
  extraction: {
    constraints: ParsedConstraint[]
    size_parameters: SizeParameter[]
    test_cases: TestCases
    resource_limits: ResourceLimit[]
    uncertainties: string[]
  }
  selected_parameter: string | null
  assessments: ComplexityAssessment[]
  uncertainties: string[]
  discrepancies: string[]
  caveats: string[]
}
