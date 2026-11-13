import type { AnalyzeResponse, HealthResponse } from '../types/api'
import type { AlgorithmicAssessment } from '../types/algorithmic'
import { isAlgorithmicAssessment } from './algorithmicValidation'
import type { SimilarResponse } from '../types/retrieval'
import { isSimilarResponse } from './retrievalValidation'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/api/v1/health`, { signal })
  if (!response.ok) throw new Error(`Health check returned ${response.status}`)
  // TypeScript types disappear at runtime, so validate data from the network.
  const data: unknown = await response.json()
  if (typeof data !== 'object' || data === null ||
      !('status' in data) || data.status !== 'ok' ||
      !('service' in data) || data.service !== 'algolens-api') {
    throw new Error('Unexpected health response')
  }
  return { status: data.status, service: data.service }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableText(value: unknown): value is string | null {
  return value === null || isText(value)
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText)
}

// TypeScript interfaces are compile-time only. Reject malformed network data
// before React tries to render it, including missing/out-of-order hint levels.
function isAnalysis(value: unknown): value is AnalyzeResponse {
  if (!isRecord(value)) return false
  const honestMetadata = (value.analysis_type === 'mock' && value.provider === 'fake' && value.model === null && isText(value.demo_notice)) ||
    (value.analysis_type === 'ai' && value.provider === 'groq' && isText(value.model) && value.demo_notice === null)
  return honestMetadata && (value.similar_problems == null || isSimilarResponse(value.similar_problems)) &&
    (value.retrieval_warning == null || isText(value.retrieval_warning)) &&
    isAlgorithmicAssessment(value.deterministic) && isText(value.simplified_problem) &&
    isNullableText(value.objective) && isNullableText(value.input_summary) && isNullableText(value.output_summary) &&
    isTextList(value.important_observations) && isTextList(value.uncertainties) &&
    Array.isArray(value.constraints) && value.constraints.every(item =>
      isRecord(item) && isText(item.variable) && isNullableText(item.expression) && isText(item.description)) &&
    Array.isArray(value.complexity_guidance) && value.complexity_guidance.every(item =>
      isRecord(item) && isText(item.complexity) && isText(item.assessment) && isText(item.explanation)) &&
    Array.isArray(value.possible_techniques) && value.possible_techniques.every(item =>
      isRecord(item) && isText(item.name) && isText(item.explanation)) &&
    Array.isArray(value.hints) && value.hints.length === 3 &&
    value.hints.every((item, index) => isRecord(item) && item.level === index + 1 && isText(item.text))
}

async function postStatement(statement: string, signal: AbortSignal, endpoint: 'analyze' | 'assess' | 'similar'): Promise<unknown> {
  // Longer than the backend's bounded 30s default (40s configurable maximum).
  const timeout = AbortSignal.timeout(45_000)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ statement: statement.trim() }),
      signal: AbortSignal.any([signal, timeout]),
    })
  } catch (error) {
    if (signal.aborted) throw error
    if (timeout.aborted) throw new Error('The analysis request timed out. Please try again.')
    throw new Error('Cannot reach the API. Check that the backend is running and the API URL and CORS settings are correct, then try again.')
  }

  if (!response.ok) {
    if (response.status === 422) {
      throw new Error('The backend rejected the statement. Use 20–20,000 characters after trimming surrounding whitespace.')
    }
    // Show controlled provider messages only; never render raw SDK error bodies.
    const providerMessages: Record<string, string> = {
      configuration_error: 'Groq is not configured correctly. Check the backend credentials, model and free-tier access, or switch to Demo Mode.',
      rate_limit: 'Groq free-tier capacity has been reached. Try again later or switch to Demo Mode. No automatic retry was made.',
      provider_timeout: 'Groq did not respond in time. Try again later or use Demo Mode.',
      provider_unavailable: 'Groq is currently unavailable. Try again later or use Demo Mode.',
      invalid_response: 'The model response could not be validated. No analysis was displayed. Try again later or use Demo Mode.',
      internal_error: 'Analysis could not be completed because of an internal error.',
      retrieval_unavailable: 'Local practice search is unavailable. Check the backend retrieval settings and catalog.',
      local_rate_limit: 'Too many live analyses this minute. Wait a minute, use Assess constraints only, or switch to Demo Mode. Nothing was sent to Groq.',
      request_too_large: 'The request was too large. Statements are limited to 20,000 characters.',
    }
    let body: unknown
    try { body = await response.json() } catch { body = null }
    if (isRecord(body) && isRecord(body.detail) && typeof body.detail.code === 'string' &&
        Object.hasOwn(providerMessages, body.detail.code)) {
      throw new Error(providerMessages[body.detail.code])
    }
    throw new Error(`The API could not complete the request (HTTP ${response.status}). Please try again.`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    if (signal.aborted) throw error
    if (timeout.aborted) throw new Error('The analysis request timed out. Please try again.')
    throw new Error('The API returned unreadable JSON. Please try again.')
  }
  return data
}

export async function analyzeProblem(statement: string, signal: AbortSignal): Promise<AnalyzeResponse> {
  const data = await postStatement(statement, signal, 'analyze')
  if (isRecord(data) && data.similar_problems != null && !isSimilarResponse(data.similar_problems)) {
    data.similar_problems = null
    data.retrieval_warning = 'Practice recommendations could not be validated; your analysis and hints remain available.'
  }
  if (!isAnalysis(data)) throw new Error('The API returned an unexpected analysis format. Please try again.')
  return data
}

export async function assessProblem(statement: string, signal: AbortSignal): Promise<AlgorithmicAssessment> {
  const data = await postStatement(statement, signal, 'assess')
  if (!isAlgorithmicAssessment(data)) throw new Error('The API returned an unexpected deterministic assessment format. Please try again.')
  return data
}

export async function findSimilarProblems(statement: string, signal: AbortSignal): Promise<SimilarResponse> {
  const data = await postStatement(statement, signal, 'similar')
  if (!isSimilarResponse(data)) throw new Error('The API returned an unexpected practice search format. Please try again.')
  return data
}
