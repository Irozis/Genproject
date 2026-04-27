type Tab = 'setup' | 'assets'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

export function SidebarTabs({ active, onChange }: Props) {
  return (
    <div className="tabs">
      <button
        className={`tab${active === 'setup' ? ' is-active' : ''}`}
        onClick={() => onChange('setup')}
      >
        Setup
      </button>
      <button
        className={`tab${active === 'assets' ? ' is-active' : ''}`}
        onClick={() => onChange('assets')}
      >
        Assets
      </button>
    </div>
  )
}

export type { Tab as SidebarTab }
