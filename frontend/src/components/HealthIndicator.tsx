import { useEffect, useState } from 'react'
import { getHealth } from '../services/api'

export default function HealthIndicator() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    setStatus('checking')
    getHealth(controller.signal)
      .then(() => { if (active) setStatus('online') })
      .catch(() => { if (active) setStatus('offline') })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span role="status" className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-emerald-600' : status === 'offline' ? 'bg-amber-500' : 'bg-slate-400'}`} />
        {status === 'checking' ? 'Checking backend…' : status === 'online' ? 'Backend connected' : 'Backend unavailable'}
      </span>
      <button className="underline underline-offset-4 hover:text-slate-900 disabled:opacity-50" disabled={status === 'checking'} onClick={() => setAttempt(value => value + 1)}>Recheck</button>
    </div>
  )
}
