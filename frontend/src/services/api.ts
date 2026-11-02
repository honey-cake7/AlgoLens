import type { AnalyzeResponse, HealthResponse } from '../types/api'

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

// TypeScript interfaces are compile-time only. Reject malformed network data
// before React tries to render it, including missing/out-of-order hint levels.
function isAnalysis(value: unknown): value is AnalyzeResponse {
  return isRecord(value) && value.analysis_type === 'mock' &&
    isText(value.demo_notice) && isText(value.simplified_problem) &&
    Array.isArray(value.constraints) && value.constraints.every(item =>
      isRecord(item) && isText(item.variable) && isText(item.description)) &&
    Array.isArray(value.complexity_guidance) && value.complexity_guidance.every(item =>
      isRecord(item) && isText(item.complexity) && isText(item.assessment) && isText(item.explanation)) &&
    Array.isArray(value.possible_techniques) && value.possible_techniques.every(item =>
      isRecord(item) && isText(item.name) && isText(item.explanation)) &&
    Array.isArray(value.hints) && value.hints.length === 3 &&
    value.hints.every((item, index) => isRecord(item) && item.level === index + 1 && isText(item.text))
}

export async function analyzeProblem(statement: string, signal: AbortSignal): Promise<AnalyzeResponse> {
  const timeout = AbortSignal.timeout(15_000)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/v1/analyze`, {
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
    throw new Error(`The API could not complete the request (HTTP ${response.status}). Please try again.`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('The API returned unreadable JSON. Please try again.')
  }
  if (!isAnalysis(data)) throw new Error('The API returned an unexpected analysis format. Please try again.')
  return data
}
