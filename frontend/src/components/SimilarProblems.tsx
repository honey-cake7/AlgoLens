import type { SimilarResponse } from '../types/retrieval'

const difficultyDots: Record<string, number> = { easy: 1, medium: 2, hard: 3 }

export default function SimilarProblems({ result, collapsed = false }: { result: SimilarResponse; collapsed?: boolean }) {
  const method = (result.retrieval_method === 'tfidf' ? 'TF-IDF' : 'Local semantic') + (result.reranking === 'task_cues' ? ' + task cues' : '')
  const top = Math.max(...result.matches.map(item => item.similarity_score), 0.0001)
  return <section id="r-similar" aria-label="Similar practice problems" className="rise mt-8 border-t border-rule pt-6">
    <p className="eyebrow">From your text · Local catalog</p>
    <h3 className="mt-1 font-display text-xl font-semibold">Similar Problems</h3>
    <p className="mt-2 text-sm leading-6 text-ink-2">Practice problems whose task reads most like {result.query_source === 'raw_statement' ? 'your text' : 'the AI simplification (not independently verified)'}.</p>
    {(result.uncovered_topics?.length ?? 0) > 0 && <p role="note" className="mt-3 rounded-xl border border-warn/50 bg-warn-soft p-3 text-sm leading-6 text-ink"><strong>No close match in this catalog.</strong> Your statement mentions {result.uncovered_topics!.join(', ')}, which no practice problem here covers yet. The results below are probably a different kind of task.</p>}
    <details className="mt-3 text-xs leading-5 text-ink-2"><summary className="caret font-mono text-ink-3">About these scores · {method}</summary>
      <p className="mt-2">{result.reranking === 'task_cues' ? 'Scores blend textual similarity with keyword-based task cues.' : 'Cosine scores rank textual similarity.'} They are not confidence probabilities or proof of the same algorithm.</p>
      {result.warnings.length > 0 && <ul className="mt-2 list-disc space-y-2 pl-4">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    </details>
    {result.matches.length === 0 ? <p className="mt-4 text-sm text-ink-2">No practice matches available. Try a concise task description with its important conditions.</p> : <details className="group mt-4" open={!collapsed}>
      <summary className="caret rounded-xl border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper">Show practice recommendations ({Math.min(5, result.matches.length)}) · includes technique tags</summary>
      <ol className="mt-4 space-y-3">{result.matches.slice(0, 5).map((item, index) => <li key={item.problem_id} className="rise rounded-xl border border-rule bg-paper p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ink" style={{ animationDelay: `${index * 60}ms` }}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[0.68rem] text-ink-3">{item.source_type === 'external_curated' ? `External source · ${item.source_name}` : 'AlgoLens practice example'} · {item.difficulty}</p>
          <span aria-hidden="true" className="flex gap-0.5 pt-1">{[1, 2, 3].map(dot => <span key={dot} className={`h-1.5 w-1.5 rounded-full ${dot <= (difficultyDots[item.difficulty] ?? 0) ? 'bg-ink' : 'bg-rule'}`} />)}</span>
        </div>
        <h4 className="mt-1 break-words font-display text-base font-semibold">{item.title}</h4>
        <p className="mt-1.5 break-words text-sm leading-6 text-ink-2">{item.short_description}</p>
        <ul aria-label="Catalog technique tags" className="mt-3 flex flex-wrap gap-1.5">{item.technique_tags.map(tag => <li key={tag} className="rounded-md border border-rule px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-2">{tag.replaceAll('_', ' ')}</li>)}</ul>
        <div className="mt-3 flex items-center gap-3">
          <div className="score-bar flex-1" aria-hidden="true"><span style={{ ['--w' as string]: `${Math.max(4, (item.similarity_score / top) * 100)}%` }} /></div>
          <p className="shrink-0 font-mono text-[0.68rem] text-ink-2">{result.reranking === 'task_cues' ? 'Blended score' : 'Cosine score'}: {item.similarity_score.toFixed(3)} · {method}</p>
        </div>
        <p className="mt-2 break-words text-xs leading-5 text-ink-3">{item.explanation}</p>
        {item.source_type === 'external_curated' && item.source_url && <a className="mt-2 inline-block break-all font-mono text-xs font-medium text-accent underline underline-offset-4" href={item.source_url} target="_blank" rel="noopener noreferrer">Open original problem (external site)</a>}
      </li>)}</ol>
    </details>}
  </section>
}
