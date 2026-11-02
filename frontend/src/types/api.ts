export interface HealthResponse {
  status: 'ok'
  service: 'algolens-api'
}

// Keep these limits in sync with backend/app/schemas/analysis.py.
export const MIN_STATEMENT_LENGTH = 20
export const MAX_STATEMENT_LENGTH = 20_000

export interface Constraint {
  variable: string
  expression: string | null
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
  analysis_type: 'ai' | 'mock'
  provider: 'groq' | 'fake'
  model: string | null
  demo_notice: string | null
  simplified_problem: string
  objective: string | null
  input_summary: string | null
  output_summary: string | null
  constraints: Constraint[]
  complexity_guidance: ComplexityGuidance[]
  possible_techniques: TechniquePrediction[]
  hints: Hint[]
  important_observations: string[]
  uncertainties: string[]
}
