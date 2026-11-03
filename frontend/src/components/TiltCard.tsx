import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
  /** Maximum tilt in degrees. */
  max?: number
}

/** A card that leans toward the mouse pointer. Touch input and reduced-motion users get a flat card. */
export default function TiltCard({ children, className = '', max = 5 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const { clientX, clientY } = event
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const x = (clientX - box.left) / box.width
      const y = (clientY - box.top) / box.height
      el.style.setProperty('--tilt-y', `${((x - 0.5) * 2 * max).toFixed(2)}deg`)
      el.style.setProperty('--tilt-x', `${((0.5 - y) * 2 * max).toFixed(2)}deg`)
      el.style.setProperty('--glare-x', `${(x * 100).toFixed(0)}%`)
      el.style.setProperty('--glare-y', `${(y * 100).toFixed(0)}%`)
    })
  }

  function leave() {
    cancelAnimationFrame(frame.current)
    const el = ref.current
    if (!el) return
    for (const name of ['--tilt-x', '--tilt-y', '--glare-x', '--glare-y']) el.style.removeProperty(name)
  }

  return (
    <div ref={ref} className={`tilt-card ${className}`} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  )
}
