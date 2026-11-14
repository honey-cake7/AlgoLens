import { useEffect, useRef } from 'react'
import { useReveal, useScrollDraw } from '../hooks/useScrollEffects'

const STEPS = [
  { title: 'Paste the text, not the link', body: 'Story, input, output and bounds. AlgoLens never opens websites, so a link alone gives it nothing to read.' },
  { title: 'Read the limits first', body: 'It pulls out n, q and their maxima, then estimates which running times fit. This part is offline and computed from your text.' },
  { title: 'Think, then reveal a hint', body: 'With a Groq key, the AI explains the task and gives three hints, one at a time. Without one, a fixed demo is shown.' },
  { title: 'Practise on a neighbour', body: 'Similar problems from the local catalog come last and start folded, so their technique tags do not spoil the answer.' },
]

/** Small decorative scenes, one per step; the active one is chosen by scroll position. */
function StepScenes() {
  return (
    <div className="scenes relative mt-8 hidden h-64 lg:block" aria-hidden="true">
      <div className="scene" data-scene="0">
        <div className="rounded-xl border border-rule bg-sunk p-4 font-mono text-[0.72rem]">
          <p className="scene-item flex items-center justify-between text-bad line-through decoration-2"><span>https://…/problems/4/A</span><span className="no-underline">✕</span></p>
          <div className="mt-3 space-y-2">{[92, 78, 85, 60].map((width, index) => <span key={index} className="scene-item block h-2 rounded-full bg-ink/25" style={{ width: `${width}%`, ['--i' as string]: index + 1 }} />)}</div>
          <p className="scene-item mt-3 text-ok" style={{ ['--i' as string]: 5 }}>✓ statement text</p>
        </div>
      </div>
      <div className="scene" data-scene="1">
        <div className="flex flex-wrap gap-2">{['1 ≤ n ≤ 2·10⁵', '1 ≤ q ≤ 2·10⁵', '|aᵢ| ≤ 10⁹'].map((chip, index) => <span key={chip} className="scene-item rounded-lg border border-ink bg-card px-2.5 py-1.5 font-mono text-[0.75rem]" style={{ ['--i' as string]: index }}>{chip}</span>)}</div>
        <div className="mt-5 space-y-2">{[['O(n log n)', 38, 'ok'], ['O(n²)', 88, 'bad']].map(([label, width, tone], index) => (
          <div key={label as string} className="scene-item flex items-center gap-3" style={{ ['--i' as string]: index + 3 }}>
            <span className="w-20 font-mono text-[0.72rem]">{label}</span>
            <span className="h-2 flex-1 rounded-full bg-sunk"><span className={`block h-full rounded-full ${tone === 'ok' ? 'bg-ok' : 'bg-bad'}`} style={{ width: `${width}%` }} /></span>
          </div>))}
        </div>
      </div>
      <div className="scene" data-scene="2">
        <div className="scene-item hint-card" style={{ ['--i' as string]: 0 }}><p className="font-mono text-[0.68rem] uppercase tracking-widest text-accent">Hint 1</p><span className="mt-2 block h-2 w-4/5 rounded-full bg-ink/25" /><span className="mt-2 block h-2 w-3/5 rounded-full bg-ink/25" /></div>
        {[2, 3].map(level => <div key={level} className="scene-item mt-3 rounded-xl border border-dashed border-rule p-3 font-mono text-[0.7rem] text-ink-3" style={{ ['--i' as string]: level }}>Hint {level} · folded</div>)}
      </div>
      <div className="scene" data-scene="3">
        {['Static ledger totals', 'Coldest stretch lookups', 'Scoreboard bonuses'].map((title, index) => (
          <div key={title} className="scene-item mb-2.5 flex items-center justify-between rounded-xl border border-rule bg-card p-3" style={{ ['--i' as string]: index }}>
            <span className="font-display text-sm font-semibold">{title}</span>
            <span className="h-1.5 w-16 rounded-full bg-sunk"><span className="block h-full rounded-full bg-ink" style={{ width: `${90 - index * 18}%` }} /></span>
          </div>))}
      </div>
    </div>
  )
}

export default function HowItWorks() {
  const rail = useScrollDraw<HTMLOListElement>()
  const heading = useReveal<HTMLDivElement>()
  const steps = useRef<(HTMLLIElement | null)[]>([])

  // Highlight the step nearest the reading line (45% down the viewport).
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.45
      let best = 0
      let distance = Infinity
      steps.current.forEach((el, index) => {
        if (!el) return
        const box = el.getBoundingClientRect()
        const d = Math.abs(box.top + box.height / 2 - line)
        if (d < distance) { distance = d; best = index }
      })
      steps.current.forEach((el, index) => { if (el) el.dataset.active = String(index === best) })
      heading.current?.setAttribute('data-step', String(best))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [heading])

  return (
    <section aria-labelledby="how-title" className="how mt-24 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div ref={heading} data-reveal="" data-step="0" className="lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="mt-3 font-display text-4xl font-semibold leading-[1.1] tracking-tight">A reading method, <span className="italic text-accent">not</span> an answer key.</h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-ink-2">AlgoLens doesn’t solve problems or promise a verdict. It slows you down at the right moments: the limits, the shape of the data, the next small idea.</p>
        <StepScenes />
      </div>
      <ol ref={rail} className="relative space-y-6 lg:py-[18vh]">
        <span aria-hidden="true" className="rail-line" />
        {STEPS.map((step, index) => (
          <li key={step.title} ref={el => { steps.current[index] = el }} data-active={index === 0} className="how-step relative pl-12 lg:min-h-[38vh]">
            <span className="how-dot absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full border font-mono text-[0.7rem] font-semibold">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="font-display text-2xl font-semibold leading-8">{step.title}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
