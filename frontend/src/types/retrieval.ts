export interface SimilarMatch {
  problem_id: string
  title: string
  short_description: string
  difficulty: 'easy' | 'medium' | 'hard'
  technique_tags: string[]
  similarity_score: number
  retrieval_method: 'tfidf' | 'semantic'
  explanation: string
  source_type: 'original_practice' | 'external_curated'
  /** Only external curated records with checked provenance carry a link. */
  source_url: string | null
  source_name?: string | null
}

export interface SimilarResponse {
  query: string
  query_source: 'raw_statement' | 'ai_simplification'
  requested_method: 'tfidf' | 'semantic'
  retrieval_method: 'tfidf' | 'semantic'
  catalog_revision: string
  /** Absent from pre-Stage-5 servers; treated as 'none'. */
  reranking?: 'none' | 'task_cues'
  /** Query topics that no catalog record covers; absent from older servers. */
  uncovered_topics?: string[]
  matches: SimilarMatch[]
  warnings: string[]
}
