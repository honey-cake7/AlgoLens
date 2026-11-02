export interface HealthResponse {
  status: 'ok'
  service: 'algolens-api'
}

// Keep these limits in sync with backend/app/schemas/analysis.py.
export const MIN_STATEMENT_LENGTH = 20
export const MAX_STATEMENT_LENGTH = 20_000

export interface Constraint {
  variable: string
  description: string
}

export interface ComplexityGuidance {
  complexity: string
  assessment: string
  explanation: string
}

export interface TechniquePrediction {
  name: string
  explanation: string
  // Confidence is deliberately absent from the mock contract.
}

export interface Hint {
  level: 1 | 2 | 3
  text: string
}

export interface AnalyzeResponse {
  analysis_type: 'mock'
  demo_notice: string
  simplified_problem: string
  constraints: Constraint[]
  complexity_guidance: ComplexityGuidance[]
  possible_techniques: TechniquePrediction[]
  hints: Hint[]
}
