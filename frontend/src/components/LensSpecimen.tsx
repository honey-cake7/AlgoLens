import { Fragment, useEffect, useRef, useState } from 'react'

// A fixed, original illustration of how to read a statement. It never analyzes
// user input. Each term is followed by the note a careful reader would write.
const PARTS: (string | { term: string; note: string; tag: string })[] = [
  'A town has ',
  { term: 'n lamps in a row', tag: 'shape', note: 'A line of values: think array.' },
  ', where ',
  { term: '1 ≤ n ≤ 2·10⁵', tag: 'bound', note: 'About 200,000. n² steps is ~40 billion: too slow.' },
  '. Every night the mayor asks ',
  { term: 'q questions', tag: 'queries', note: 'Many questions: each answer must be quick.' },
  ': how bright are ',
  { term: 'lamps l through r', tag: 'range', note: 'A contiguous range, not any subset.' },
  ' together? The lamps ',
  { term: 'never change', tag: 'static', note: 'Fixed data: work it out once, reuse it.' },
  '.',
]
const TERMS = PARTS.filter(part => typeof part !== 'string')
const STEP_MS = 2600

export default function LensSpecimen() {
  const box = useRef<HTMLDivElement>(null)
  const terms = useRef<(HTMLSpanElement | null)[]>([])
  const [step, setStep] = useState(-1)
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const shown = still ? TERMS.length - 1 : step

  // Advance only while the illustration is on screen and the tab is visible.
  useEffect(() => {
    if (still || !box.current) return
    let onScreen = false
    let timer = 0
    const tick = () => {
      window.clearTimeout(timer)
      if (!onScreen || document.hidden) return
      timer = window.setTimeout(() => { setStep(value => (value + 1 > TERMS.length ? -1 : value + 1)); tick() }, STEP_MS)
    }
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; tick() }, { threshold: 0.3 })
    observer.observe(box.current)
    document.addEventListener('visibilitychange', tick)
    const first = window.setTimeout(() => setStep(0), 900)
    return () => { observer.disconnect(); window.clearTimeout(timer); window.clearTimeout(first); document.removeEventListener('visibilitychange', tick) }
  }, [still])

  // Move the lens over the active term (recomputed on resize).
  useEffect(() => {
    const container = box.current
    if (!container) return
    const place = () => {
      const target = terms.current[Math.min(Math.max(step, 0), TERMS.length - 1)]
      if (!target) return
      const outer = container.getBoundingClientRect()
      const rect = target.getClientRects()[0] ?? target.getBoundingClientRect()
      const size = Math.max(64, Math.min(140, rect.width + 26))
      container.style.setProperty('--lx', `${rect.left - outer.left + rect.width / 2}px`)
      container.style.setProperty('--ly', `${rect.top - outer.top + rect.height / 2}px`)
      container.style.setProperty('--lw', `${size}px`)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [step])

  let index = -1
  return (
    <figure aria-hidden="true" className="specimen panel relative select-none overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="eyebrow">Illustration · fixed example</span>
        <span className="font-mono text-[0.7rem] text-ink-3">{Math.max(0, Math.min(shown + 1, TERMS.length))}/{TERMS.length} marked</span>
      </div>
      <div ref={box} className="relative">
        <p className="specimen-text">
          {PARTS.map((part, key) => {
            if (typeof part === 'string') return <Fragment key={key}>{part}</Fragment>
            const i = ++index
            return <span key={key} ref={el => { terms.current[i] = el }} data-term="" data-seen={i <= shown} data-active={i === shown}>{part.term}</span>
          })}
        </p>
        {!still && step >= 0 && step < TERMS.length && <span className="lens" />}
      </div>
      {/* Every note slot and the closing line are always laid out and only fade
          in, so the card keeps one height and never pushes the page below it. */}
      <ol className="mt-5 grid content-start gap-2 sm:grid-cols-2">
        {TERMS.map((term, i) => (
          <li key={term.tag} data-shown={i <= shown} className="note-slot rounded-lg border border-rule bg-paper p-2.5" style={{ ['--r' as string]: `${i % 2 ? 0.6 : -0.6}deg` }}>
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent">{term.tag}</span>
            <span className="mt-0.5 block text-[0.8rem] leading-5 text-ink-2">{term.note}</span>
          </li>
        ))}
      </ol>
      <p data-shown={shown >= TERMS.length - 1} className="note-slot mt-3 border-t border-dashed border-rule pt-3 font-display text-[0.95rem] italic text-ink">Five clues, before writing any code. That is the habit AlgoLens trains.</p>
    </figure>
  )
}
