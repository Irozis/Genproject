import { useState } from 'react'
import { ElementEditor } from './ElementEditor'
import type { BlockKind, Scene } from '../lib/types'

type Props = {
  kind: BlockKind
  label: string
  enabled: boolean
  forceOpen: boolean
  scene: Scene
  onToggle: (next: boolean) => void
  onPatchScene: (patch: (master: Scene) => Scene) => void
  activeLocale?: string
}

export function ElementRow({ kind, label, enabled, forceOpen, scene, onToggle, onPatchScene, activeLocale }: Props) {
  const [open, setOpen] = useState(false)
  const isOpen = open || forceOpen

  return (
    <div className={`el-row${isOpen ? ' is-open' : ''}${enabled ? '' : ' is-disabled'}`}>
      <div className="el-row__head">
        <label className="el-row__check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span>{label}</span>
        </label>
        <button
          type="button"
          className="el-row__toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={isOpen}
        >
          {isOpen ? '▴' : '▾'}
        </button>
      </div>
      {isOpen && enabled ? <ElementEditor kind={kind} scene={scene} onChange={onPatchScene} activeLocale={activeLocale} /> : null}
    </div>
  )
}
