import { useRef, type KeyboardEvent } from 'react'

type Tab = 'content' | 'formats' | 'brand' | 'assets'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'content', label: 'Контент' },
  { id: 'formats', label: 'Форматы' },
  { id: 'brand', label: 'Бренд' },
  { id: 'assets', label: 'Медиа' },
]

export function SidebarTabs({ active, onChange }: Props) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const dir = e.key === 'ArrowRight' ? 1 : -1
      const next = (idx + dir + TABS.length) % TABS.length
      const tab = TABS[next]!
      onChange(tab.id)
      refs.current[next]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(TABS[0]!.id)
      refs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      const last = TABS.length - 1
      onChange(TABS[last]!.id)
      refs.current[last]?.focus()
    }
  }

  return (
    <div className="tabs" role="tablist" aria-label="Разделы боковой панели">
      {TABS.map((tab, idx) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[idx] = el }}
            role="tab"
            type="button"
            id={`sidebar-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`sidebar-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`tab${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export type { Tab as SidebarTab }
