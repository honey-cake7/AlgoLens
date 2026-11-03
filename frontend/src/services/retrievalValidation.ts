import type { SimilarResponse } from '../types/retrieval'

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function texts(value: unknown) { return Array.isArray(value) && value.every(text) }
function method(value: unknown) { return value === 'tfidf' || value === 'semantic' }

export function isSimilarResponse(value: unknown): value is SimilarResponse {
  return record(value) && typeof value.query === 'string' &&
    (value.query_source === 'raw_statement' || value.query_source === 'ai_simplification') &&
    method(value.requested_method) && method(value.retrieval_method) && text(value.catalog_revision) && texts(value.warnings) &&
    Array.isArray(value.matches) && value.matches.length <= 20 && value.matches.every(item =>
      record(item) && text(item.problem_id) && text(item.title) && text(item.short_description) &&
      ['easy', 'medium', 'hard'].includes(String(item.difficulty)) && texts(item.technique_tags) &&
      typeof item.similarity_score === 'number' && Number.isFinite(item.similarity_score) && Math.abs(item.similarity_score) <= 1 &&
      item.retrieval_method === value.retrieval_method && text(item.explanation) &&
      item.source_type === 'original_practice' && item.source_url === null)
}
