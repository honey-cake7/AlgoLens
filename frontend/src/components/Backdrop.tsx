import { notation } from '../backgrounds/notation'
import { useBackdrop } from '../backgrounds/useBackdrop'

/** Decorative page background: drifting algorithm notation (see backgrounds/notation.ts). */
export default function Backdrop() {
  const ref = useBackdrop(notation)
  return <canvas ref={ref} aria-hidden="true" className="backdrop-canvas" />
}
