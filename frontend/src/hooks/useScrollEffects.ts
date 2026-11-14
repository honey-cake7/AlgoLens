import { useEffect, useRef, useState, type RefObject } from 'react'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Fade an element in the first time it scrolls into view (CSS: [data-reveal]). */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion() || !('IntersectionObserver' in window)) { el.dataset.shown = 'true'; return }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { el.dataset.shown = 'true'; observer.disconnect() }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

/** Page scroll as 0–1, and whether the user has left the top. One passive, rAF-throttled listener. */
export function usePageScroll() {
  const [scrolled, setScrolled] = useState(false)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0
      bar.current?.style.setProperty('--progress', progress.toFixed(4))
      setScrolled(window.scrollY > 12)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return { scrolled, bar }
}

/** How far an element has been scrolled through the viewport, 0–1, written to a CSS variable. */
export function useScrollDraw<T extends HTMLElement>(variable = '--draw'): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion()) { el.style.setProperty(variable, '1'); return }
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const start = window.innerHeight * 0.85
      const progress = (start - box.top) / (box.height + start - window.innerHeight * 0.35)
      el.style.setProperty(variable, Math.max(0, Math.min(1, progress)).toFixed(3))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [variable])
  return ref
}

/**
 * Scroll-scrubbed progress for an element, 0–1, written to `--p` every frame
 * (no React re-render). `exit`: 0 while its top is at the viewport top, 1 once
 * it has scrolled fully out. `pin`: progress through a tall section whose child
 * is `position: sticky`. `onFrame` receives the same value for DOM updates.
 * Under reduced motion it reports `still` once and never listens.
 */
export function useScrollProgress<T extends HTMLElement>(mode: 'exit' | 'pin', onFrame?: (progress: number) => void, still = 1): RefObject<T | null> {
  const ref = useRef<T>(null)
  const callback = useRef(onFrame)
  callback.current = onFrame
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const write = (value: number) => { el.style.setProperty('--p', value.toFixed(4)); callback.current?.(value) }
    if (reducedMotion()) { write(still); return }
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const span = mode === 'pin' ? box.height - window.innerHeight : box.height
      write(span > 0 ? Math.max(0, Math.min(1, -box.top / span)) : 0)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [mode, still])
  return ref
}

/** Which of the given element ids is currently being read (for the results jump bar). */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join('|')
  useEffect(() => {
    const elements = key.split('|').map(id => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
    if (!elements.length || !('IntersectionObserver' in window)) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity)
      let best: string | null = null
      let bestTop = Infinity
      for (const [id, top] of visible) if (top !== Infinity && Math.abs(top) < Math.abs(bestTop)) { best = id; bestTop = top }
      if (best) setActive(best)
    }, { rootMargin: '-15% 0px -55% 0px' })
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [key])
  return active
}
