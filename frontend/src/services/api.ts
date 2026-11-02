import type { HealthResponse } from '../types/api'

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
