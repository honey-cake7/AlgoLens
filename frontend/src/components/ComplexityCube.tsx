import { useEffect, useRef } from 'react'

// One growth class per face. Labels are drawn with CSS (data-label), so they are not page text.
const FACES = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)']

export default function ComplexityCube() {
  const scene = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scene.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0

    function onMove(event: PointerEvent) {
      if (!el || el.offsetParent === null) return // hidden on small screens
      const { clientX, clientY } = event
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = clientX / window.innerWidth - 0.5
        const y = clientY / window.innerHeight - 0.5
        el.style.setProperty('--px', `${(x * 36).toFixed(1)}deg`)
        el.style.setProperty('--py', `${(y * -24).toFixed(1)}deg`)
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div aria-hidden="true" className="hidden shrink-0 lg:block">
      <div ref={scene} className="cube-scene">
        <div className="cube-tilt">
          <span className="cube-ring" />
          <div className="cube">
            {FACES.map((label, index) => <span key={label} className={`cube-face face-${index + 1}`} data-label={label} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
