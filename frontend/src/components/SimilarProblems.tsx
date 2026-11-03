import type { SimilarResponse } from '../types/retrieval'

export default function SimilarProblems({ result, collapsed = false }: { result: SimilarResponse; collapsed?: boolean }) {
  const method = result.retrieval_method === 'tfidf' ? 'TF-IDF' : 'Local semantic'
  return <section aria-label="Similar practice problems" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <h3 className="text-lg font-semibold">Similar Problems</h3>
    <p className="mt-2 text-xs leading-5 text-slate-600">{method} · {result.query_source === 'raw_statement' ? 'Your submitted statement' : 'Existing AI simplification · not independently verified'}</p>
    <p className="mt-2 text-xs leading-5 text-slate-600">Cosine scores rank textual similarity. They are not confidence probabilities or proof of the same algorithm.</p>
    {result.warnings.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-600">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    {result.matches.length === 0 ? <p className="mt-4 text-sm text-slate-600">No practice matches available. Try a concise task description with its important conditions.</p> : <details className="mt-4" open={!collapsed}>
      <summary className="cursor-pointer text-sm font-semibold text-teal-800">Show practice recommendations ({Math.min(5, result.matches.length)}) · includes technique tags</summary>
      <ol className="mt-4 space-y-4">{result.matches.slice(0, 5).map(item => <li key={item.problem_id} className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs text-teal-800">AlgoLens practice example · {item.difficulty}</p>
        <h4 className="mt-1 break-words text-sm font-semibold">{item.title}</h4>
        <p className="mt-2 break-words text-sm leading-6 text-slate-600">{item.short_description}</p>
        <ul aria-label="Catalog technique tags" className="mt-3 flex flex-wrap gap-2">{item.technique_tags.map(tag => <li key={tag} className="rounded-full bg-teal-50 px-2 py-1 text-xs text-teal-900">{tag.replaceAll('_', ' ')}</li>)}</ul>
        <p className="mt-3 text-xs font-medium text-slate-600">Cosine score: {item.similarity_score.toFixed(3)} · {method}</p>
        <p className="mt-2 break-words text-xs leading-5 text-slate-500">{item.explanation}</p>
      </li>)}</ol>
    </details>}
  </section>
}
