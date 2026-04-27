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
  const isInlineEditable = kind === 'title' || kind === 'subtitle' || kind === 'cta' || kind === 'badge'
  const inlineText = getInlineText(scene, kind, activeLocale)

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
        {isInlineEditable ? (
          <input
            type="text"
            className="el-row__inline-text"
            value={inlineText}
            onChange={(e) => setInlineText(onPatchScene, kind, activeLocale, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()} text`}
            aria-label={`${label} text`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
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

function getInlineText(scene: Scene, kind: BlockKind, activeLocale?: string) {
  if (kind !== 'title' && kind !== 'subtitle' && kind !== 'cta' && kind !== 'badge') return ''
  const block = scene[kind]
  if (!block) return ''
  if (activeLocale && block.textByLocale?.[activeLocale] != null) return block.textByLocale[activeLocale]
  return block.text
}

function setInlineText(
  onPatchScene: (patch: (master: Scene) => Scene) => void,
  kind: BlockKind,
  activeLocale: string | undefined,
  value: string,
) {
  if (kind !== 'title' && kind !== 'subtitle' && kind !== 'cta' && kind !== 'badge') return
  onPatchScene((s) => {
    const block = s[kind]
    if (!block) return s
    if (!activeLocale) {
      return { ...s, [kind]: { ...block, text: value } }
    }
    return {
      ...s,
      [kind]: {
        ...block,
        textByLocale: {
          ...(block.textByLocale ?? {}),
          [activeLocale]: value,
        },
      },
    }
  })
}
