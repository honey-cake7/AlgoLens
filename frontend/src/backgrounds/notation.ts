import type { SceneFactory } from './useBackdrop'

// Faint competitive-programming notation drifting upward at different depths.
// The cursor works like a lens that brings nearby notation into focus, and
// now and then one token is "marked" in the accent colour.
const TOKENS = ['O(n log n)', 'O(n)', 'O(1)', 'O(n²)', 'O(log n)', 'n ≤ 2·10⁵', 'q ≤ 10⁵', '1 ≤ aᵢ ≤ 10⁹', 'dp[i][j]', 'Σ aᵢ', 'a[l..r]',
  '10⁹ + 7', '⌈n / 2⌉', '2ⁿ', '√n', 'gcd(a, b)', 'min(x, y)', 'i < j', 'prefix[r] − prefix[l−1]', 'dist[v]', 'adj[u]', 'lo + (hi − lo) / 2',
  'mid', 'k ≤ 20', 'O(n√n)', 'x ⊕ y', 'mod p', 'n, m ≤ 10⁵', '|s| ≤ 10⁶', 'while (lo < hi)', 'parent[v]', 'seen[x]']
const PARALLAX = 0.25
const LENS = 170

type Glyph = { text: string; x: number; y: number; z: number; mark: number }
type Sprite = { canvas: HTMLCanvasElement; width: number; height: number }

// Text is rasterised once per (token, size, colour) and then only copied each
// frame; drawing text from scratch every frame was the expensive part.
// Theme changes produce new colour keys, so stale sprites are simply unused.
const sprites = new Map<string, Sprite>()
function sprite(text: string, size: number, color: string): Sprite {
  const key = `${text}|${size}|${color}`
  const cached = sprites.get(key)
  if (cached) return cached
  if (sprites.size > 600) sprites.clear()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  const c = canvas.getContext('2d')!
  const font = `${size}px "JetBrains Mono Variable", ui-monospace, monospace`
  c.font = font
  const width = Math.ceil(c.measureText(text).width) + 4
  const height = Math.ceil(size * 1.4)
  canvas.width = width * ratio
  canvas.height = height * ratio
  c.scale(ratio, ratio)
  c.font = font
  c.textBaseline = 'middle'
  c.textAlign = 'center'
  c.fillStyle = color
  c.fillText(text, width / 2, height / 2)
  const made = { canvas, width, height }
  sprites.set(key, made)
  return made
}

export const notation: SceneFactory = env => {
  const { ctx } = env
  // Re-rasterise once the bundled code font arrives (sprites made earlier used a fallback).
  document.fonts?.ready.then(() => sprites.clear()).catch(() => {})
  let glyphs: Glyph[] = []
  let lastNow = 0
  let nextMark = performance.now() + 1500
  const make = (x?: number, y?: number): Glyph => ({
    text: TOKENS[Math.floor(Math.random() * TOKENS.length)],
    x: x ?? Math.random() * env.width,
    y: y ?? Math.random() * env.height,
    z: 0.35 + Math.random() * 0.65,
    mark: -1,
  })
  const resize = () => {
    const target = Math.max(14, Math.min(46, Math.round((env.width * env.height) / 36000)))
    glyphs = Array.from({ length: target }, () => make())
  }
  resize()
  return {
    frameMs: 33, // slow drift looks the same at 30 fps and costs half the work
    resize,
    click: (x, y) => {
      for (let k = 0; k < 3; k++) {
        const glyph = make(x + (k - 1) * 60, y + k * 18)
        glyph.mark = performance.now()
        glyphs.push(glyph)
      }
      if (glyphs.length > 60) glyphs.splice(0, glyphs.length - 60)
    },
    draw: now => {
      const { width, height, palette, pointer } = env
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0
      lastNow = now
      const scroll = env.scroll()
      if (!env.still && now >= nextMark && glyphs.length) {
        glyphs[Math.floor(Math.random() * glyphs.length)].mark = now
        nextMark = now + 1800 + Math.random() * 1600
      }
      ctx.clearRect(0, 0, width, height)
      for (const g of glyphs) {
        const span = height + 80
        if (!env.still) g.y = (((g.y - g.z * 9 * dt) % span) + span) % span
        const y = ((((g.y - scroll * PARALLAX * g.z + 40) % span) + span) % span) - 40
        const size = Math.round(10 + g.z * 9)
        let alpha = (palette.dark ? 0.055 : 0.075) * (0.5 + g.z)
        let color = palette.ink
        if (pointer.on) {
          const near = 1 - Math.hypot(g.x - pointer.x, y - pointer.y) / LENS
          if (near > 0) alpha += near * near * (palette.dark ? 0.55 : 0.5)
        }
        if (g.mark >= 0) {
          const age = (now - g.mark) / 2600
          if (age > 1) g.mark = -1
          else {
            const glow = Math.sin(age * Math.PI)
            alpha = Math.max(alpha, glow * 0.75)
            if (glow > 0.15) color = palette.accent
          }
        }
        const image = sprite(g.text, size, color)
        ctx.globalAlpha = Math.min(0.85, alpha)
        ctx.drawImage(image.canvas, g.x - image.width / 2, y - image.height / 2, image.width, image.height)
      }
      ctx.globalAlpha = 1
    },
  }
}
