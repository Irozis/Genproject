import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SceneRenderer } from '../renderers/SceneRenderer'
import { getFormat } from '../lib/formats'
import { TEMPLATES, type Template } from '../lib/templates'
import { buildScene } from '../lib/buildScene'
import { DEFAULT_ENABLED } from '../lib/defaults'
import { Icon } from './Icon'
import type { FormatKey, FormatRuleSet, Tone } from '../lib/types'

type Props = {
  onPick: (template: Template) => void
  onBack: () => void
}

const PREVIEW_FORMATS = [
  { key: 'vk-square', label: '1:1', slot: 'square' as const },
  { key: 'instagram-story', label: 'Story', slot: 'story' as const },
  { key: 'yandex-rsy-728x90', label: '728×90', slot: 'banner' as const },
] satisfies Array<{ key: FormatKey; label: string; slot: 'square' | 'story' | 'banner' }>

const TONE_FILTERS: Array<{ id: Tone | 'all'; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'bold', label: 'Bold' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'neutral', label: 'Neutral' },
]

export function TemplatePicker({ onPick, onBack }: Props) {
  const [tone, setTone] = useState<Tone | 'all'>('all')

  const filtered = useMemo(
    () => (tone === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.brandKit.toneOfVoice === tone)),
    [tone],
  )

  return (
    <div className="template-picker">
      <header className="template-picker__head">
        <button className="btn btn-ghost btn-sm btn-with-icon" onClick={onBack}>
          <Icon name="arrow-left" />
          <span>Назад</span>
        </button>
        <h1>Выберите бренд-шаблон</h1>
        <span />
      </header>

      <div className="template-picker__filters" role="toolbar" aria-label="Фильтр по тону">
        {TONE_FILTERS.map((f) => {
          const isActive = tone === f.id
          return (
            <button
              key={f.id}
              type="button"
              className={`tone-chip${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => setTone(f.id)}
            >
              {f.label}
            </button>
          )
        })}
        <span className="template-picker__count">{filtered.length} из {TEMPLATES.length}</span>
      </div>

      <div className="template-grid">
        {filtered.map((t) => {
          const enabled = { ...DEFAULT_ENABLED, ...t.enabled }
          return (
            <button
              key={t.id}
              type="button"
              className="template-card"
              onClick={() => onPick(t)}
            >
              <div className="template-card__preview">
                {PREVIEW_FORMATS.map(({ key, label, slot }) => (
                  <TemplateMiniPreview
                    key={key}
                    template={t}
                    formatKey={key}
                    label={label}
                    slot={slot}
                    enabled={enabled}
                  />
                ))}
              </div>
              <div className="template-card__meta">
                <div className="template-card__name">{t.name}</div>
                <div className="template-card__desc">{t.description}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TemplateMiniPreview({
  template,
  formatKey,
  label,
  slot,
  enabled,
}: {
  template: Template
  formatKey: FormatKey
  label: string
  slot: 'square' | 'story' | 'banner'
  enabled: typeof DEFAULT_ENABLED
}) {
  const rules: FormatRuleSet = getFormat(formatKey)
  const ref = useRef<HTMLDivElement>(null)
  // visible flips true on first intersection. Once seen, we keep the SVG
  // around so re-scrolling doesn't tear down already-rendered scenes.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect()
            return
          }
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  const scene = useMemo(() => {
    if (!visible) return null
    const override = template.preferredModels?.[formatKey]
    return buildScene(template.master, formatKey, template.brandKit, enabled, {
      ...(override ? { override } : {}),
      blockOverrides: template.blockOverrides?.[formatKey],
      density: template.formatDensities?.[formatKey],
    })
  }, [visible, template, formatKey, enabled])

  const style = { aspectRatio: `${rules.width} / ${rules.height}` } as CSSProperties

  return (
    <div ref={ref} className={`template-card__mini template-card__mini--${slot}`} style={style}>
      {scene ? (
        <SceneRenderer
          scene={scene}
          rules={rules}
          displayFont={template.brandKit.displayFont}
          textFont={template.brandKit.textFont}
          brandInitials={template.brandKit.brandName}
          brandColor={template.brandKit.palette.accent}
          className="template-card__svg"
        />
      ) : (
        <div className="template-card__mini-skeleton" aria-hidden="true" />
      )}
      <span className="template-card__mini-label">{label}</span>
    </div>
  )
}
