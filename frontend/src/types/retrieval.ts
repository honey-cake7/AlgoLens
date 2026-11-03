export interface SimilarMatch {
  problem_id: string
  title: string
  short_description: string
  difficulty: 'easy' | 'medium' | 'hard'
  technique_tags: string[]
  similarity_score: number
  retrieval_method: 'tfidf' | 'semantic'
  explanation: string
  source_type: 'original_practice'
  source_url: null
}

export interface SimilarResponse {
  query: string
  query_source: 'raw_statement' | 'ai_simplification'
  requested_method: 'tfidf' | 'semantic'
  retrieval_method: 'tfidf' | 'semantic'
  catalog_revision: string
  matches: SimilarMatch[]
  warnings: string[]
}
