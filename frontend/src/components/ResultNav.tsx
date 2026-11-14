import { useActiveSection } from '../hooks/useScrollEffects'

/** Sticky "jump to" bar over the results; the section being read is highlighted. */
export default function ResultNav({ items }: { items: { id: string; label: string }[] }) {
  const active = useActiveSection(items.map(item => item.id))
  if (items.length < 2) return null
  return (
    <nav aria-label="Jump to result section" className="result-nav sticky top-16 z-10 -mx-1 mb-5 flex gap-2 overflow-x-auto bg-card/95 px-1 py-2 backdrop-blur">
      {items.map(item => (
        <a key={item.id} href={`#${item.id}`} data-active={active === item.id} aria-current={active === item.id ? 'location' : undefined}
          className="shrink-0 rounded-full border border-rule px-3 py-1 font-mono text-[0.72rem] text-ink-2 transition-colors hover:border-ink hover:text-ink data-[active=true]:border-ink data-[active=true]:bg-ink data-[active=true]:text-paper">{item.label}</a>
      ))}
    </nav>
  )
}
