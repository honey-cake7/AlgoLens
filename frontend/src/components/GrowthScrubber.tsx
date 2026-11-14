import { useRef } from 'react'
import { useScrollProgress } from '../hooks/useScrollEffects'

// Scroll scrubs n from 10 to 10⁶; each row shows log10 of its operation count.
// Pure arithmetic on n, drawn against the common "~10⁸ simple operations per
// second" rule of thumb. It never looks at the user's statement.
const MIN_EXP = 1
const MAX_EXP = 6
const SCALE = 12 // bars span 10⁰ … 10¹²
const BUDGET = 8 // ~10⁸ operations
const ROWS: { label: string; log10: (n: number) => number }[] = [
  { label: 'O(log n)', log10: n => Math.log10(Math.max(1, Math.log2(n))) },
  { label: 'O(n)', log10: n => Math.log10(n) },
  { label: 'O(n log n)', log10: n => Math.log10(n * Math.log2(n)) },
  { label: 'O(n√n)', log10: n => 1.5 * Math.log10(n) },
  { label: 'O(n²)', log10: n => 2 * Math.log10(n) },
  { label: 'O(n³)', log10: n => 3 * Math.log10(n) },
  { label: 'O(2ⁿ)', log10: n => n * Math.log10(2) },
]
// Upper log10(n) limit for each caption; each one agrees with the bars at that n.
const CAPTIONS: [number, string][] = [
  [1.45, 'Tiny n. Even trying every subset (2ⁿ) can work.'],
  [2.67, 'Dozens to hundreds. n³ fits; trying every subset no longer does.'],
  [3.7, 'Thousands. n³ is out; n² is comfortable.'],
  [4.5, 'Around 10⁴. n² reaches the budget here.'],
  [5.7, 'Around 10⁵, a very common limit. Aim for n log n or better.'],
  [Infinity, 'Towards a million. Linear or n log n, with small constants.'],
]
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (value: number) => String(value).split('').map(digit => SUP[Number(digit)] ?? digit).join('')
const STILL = (Math.log10(2e5) - MIN_EXP) / (MAX_EXP - MIN_EXP) // reduced motion: show n = 2·10⁵

function formatOps(log: number) {
  if (log > 18) return '> 10¹⁸'
  if (log < 4) return Math.round(10 ** log).toLocaleString('en-US')
  const exp = Math.floor(log)
  return `${(10 ** (log - exp)).toFixed(1)}·10${sup(exp)}`
}

export default function GrowthScrubber() {
  const counter = useRef<HTMLSpanElement>(null)
  const caption = useRef<HTMLParagraphElement>(null)
  const bars = useRef<(HTMLDivElement | null)[]>([])
  const last = useRef({ n: -1, caption: '' })

  const section = useScrollProgress<HTMLElement>('pin', progress => {
    const n = Math.round(10 ** (MIN_EXP + progress * (MAX_EXP - MIN_EXP)))
    if (n === last.current.n) return
    last.current.n = n
    if (counter.current) counter.current.textContent = n.toLocaleString('en-US')
    const text = CAPTIONS.find(([limit]) => Math.log10(n) < limit)![1]
    if (caption.current && text !== last.current.caption) { last.current.caption = text; caption.current.textContent = text }
    ROWS.forEach((row, index) => {
      const el = bars.current[index]
      if (!el) return
      const log = row.log10(n)
      el.style.setProperty('--w', `${Math.max(1.5, Math.min(100, (log / SCALE) * 100))}%`)
      el.dataset.state = log <= BUDGET ? 'fits' : log <= BUDGET + 1 ? 'tight' : 'slow'
      const value = el.querySelector('[data-value]')
      if (value) value.textContent = formatOps(log)
      const verdict = el.querySelector('[data-verdict]')
      if (verdict) verdict.textContent = log <= BUDGET ? 'fits' : log <= BUDGET + 1 ? 'tight' : 'too slow'
    })
  }, STILL)

  return (
    <section ref={section} aria-labelledby="growth-title" className="growth relative mt-24 h-[300vh] motion-reduce:h-auto">
      <div className="sticky top-0 flex min-h-screen items-center py-20 motion-reduce:static">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <p className="eyebrow">Feel the limit</p>
            <h2 id="growth-title" className="mt-3 font-display text-4xl font-semibold leading-[1.1] tracking-tight">Why the <span className="italic text-accent">bounds</span> come first.</h2>
            <p className="mt-6 font-mono text-sm text-ink-3">n =</p>
            <p className="font-display text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl" aria-hidden="true"><span ref={counter}>10</span></p>
            <p ref={caption} aria-live="off" className="mt-4 min-h-[3.5rem] max-w-sm text-sm leading-6 text-ink-2">{CAPTIONS[0][1]}</p>
            <div className="growth-track mt-2 h-1 w-40 overflow-hidden rounded-full bg-sunk" aria-hidden="true"><span className="block h-full bg-accent" /></div>
            <p className="sr-only">As n grows from 10 to one million, n log n stays under about 10⁸ operations, while n squared passes it near n = 10⁴ and 2 to the n passes it before n = 30.</p>
          </div>
          <div className="panel" aria-hidden="true">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <p className="eyebrow">Operations at this n</p>
              <p className="font-mono text-[0.68rem] text-ink-3">log scale</p>
            </div>
            <div className="relative grid grid-cols-[5.4rem_minmax(0,1fr)_auto] items-center gap-y-3 pt-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
              {ROWS.map((row, index) => (
                <div key={row.label} ref={el => { bars.current[index] = el }} className="growth-row contents" data-state="fits">
                  <span className="font-mono text-[0.78rem] font-semibold text-ink">{row.label}</span>
                  <span className="growth-bar h-2.5 rounded-full bg-sunk"><span className="growth-fill block h-full rounded-full" />{index === 0 && <span className="growth-budget-label">≈10⁸ ≈ 1 s</span>}</span>
                  <span className="flex items-center justify-end gap-2 whitespace-nowrap pl-2 font-mono text-[0.68rem]">
                    <span data-value className="tabular-nums text-ink-2">1</span>
                    <span data-verdict className="growth-verdict rounded-full px-1.5 py-0.5">fits</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-ink-3">Rule of thumb only: real limits depend on the judge, the language and constant factors. AlgoLens’s constraint check uses your problem’s actual bounds.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
