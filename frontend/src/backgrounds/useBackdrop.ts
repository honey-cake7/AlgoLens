import { useEffect, useRef } from 'react'

// Shared plumbing for the decorative canvas backgrounds: sizing for the
// device pixel ratio, theme colours (re-read when the theme toggles), a
// frame-rate cap, pausing in hidden tabs, mouse position, clicks on empty
// space, and one still frame under prefers-reduced-motion. Scenes only draw.

export type Palette = { ink: string; ink3: string; rule: string; accent: string; accentSoft: string; mark: string; paper: string; dark: boolean }
export type Env = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  palette: Palette
  still: boolean
  scroll: () => number
  pointer: { x: number; y: number; on: boolean }
}
export type Scene = { draw: (now: number) => void; resize?: () => void; click?: (x: number, y: number) => void; frameMs?: number }
export type SceneFactory = (env: Env) => Scene

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    ink: read('--color-ink', '#17171a'), ink3: read('--color-ink-3', '#86827a'), rule: read('--color-rule', '#d8d1c2'),
    accent: read('--color-accent', '#d9481f'), accentSoft: read('--color-accent-soft', '#f6dccf'), mark: read('--color-mark', '#ffd84d'),
    paper: read('--color-paper', '#f3efe6'), dark: document.documentElement.classList.contains('dark'),
  }
}

// Clicks on controls, cards and text never trigger background effects.
const INTERACTIVE = 'a, button, input, textarea, select, label, summary, details, .panel, [role="dialog"]'

export function useBackdrop(factory: SceneFactory) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const env: Env = { ctx, width: 0, height: 0, palette: readPalette(), still, scroll: () => (still ? 0 : window.scrollY), pointer: { x: 0, y: 0, on: false } }
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      env.width = window.innerWidth
      env.height = window.innerHeight
      el.width = Math.round(env.width * ratio)
      el.height = Math.round(env.height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const scene = factory(env)
    const frameMs = scene.frameMs ?? 16
    let frame = 0
    let last = 0
    const loop = (now: number) => {
      frame = 0
      if (document.hidden) return
      if (now - last >= frameMs - 1) { last = now; scene.draw(now) }
      frame = requestAnimationFrame(loop)
    }
    const start = () => { if (!frame && !still && !document.hidden) frame = requestAnimationFrame(loop) }
    const redrawStill = () => { if (still) scene.draw(0) }
    const onResize = () => { resize(); scene.resize?.(); redrawStill() }
    const onTheme = () => { env.palette = readPalette(); redrawStill() }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      env.pointer.x = event.clientX
      env.pointer.y = event.clientY
      env.pointer.on = true
    }
    const onLeave = () => { env.pointer.on = false }
    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest(INTERACTIVE)) return
      scene.click?.(event.clientX, event.clientY)
    }

    if (still) scene.draw(0)
    else start()
    const themeWatch = new MutationObserver(onTheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', start)
    if (!still) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
      window.addEventListener('pointerdown', onDown, { passive: true })
    }
    return () => {
      cancelAnimationFrame(frame)
      themeWatch.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', start)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [factory])
  return ref
}
