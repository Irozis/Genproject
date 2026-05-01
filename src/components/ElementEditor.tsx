import type { BlockKind, Scene, TextAlign, TextFitMode } from '../lib/types'

type Props = {
  kind: BlockKind
  scene: Scene
  onPatchScene: (patch: (master: Scene) => Scene) => void
  activeLocale?: string
}

export function ElementEditor({ kind, scene, onPatchScene, activeLocale }: Props) {
  if (kind === 'title' || kind === 'subtitle' || kind === 'badge') {
    const block = scene[kind]
    if (!block) return null
    return (
      <div className="el-editor">
        <PositionPanel kind={kind} block={block} onPatchScene={onPatchScene} />
        <label className="field">
          <span>Text</span>
          <input
            type="text"
            value={block.text}
            onChange={(e) =>
              patchTextBlock(onPatchScene, kind, (current) => ({ ...current, text: e.target.value }))
            }
          />
        </label>
        {activeLocale ? (
          <label className="field">
            <span>Text ({activeLocale})</span>
            <input
              type="text"
              value={block.textByLocale?.[activeLocale] ?? ''}
              onChange={(e) =>
                patchTextBlock(onPatchScene, kind, (current) => ({
                  ...current,
                  textByLocale: {
                    ...(current.textByLocale ?? {}),
                    [activeLocale]: e.target.value,
                  },
                }))
              }
            />
          </label>
        ) : null}
        <label className="field">
          <span>Font size — {block.fontSize.toFixed(1)}%</span>
          <input
            type="range"
            min={2}
            max={14}
            step={0.5}
            value={block.fontSize}
            onChange={(e) => {
              const value = Number(e.target.value)
              console.log('fontSize changed', value)
              onPatchScene((s) => {
                const block = s[kind]
                if (!block || (kind !== 'title' && kind !== 'subtitle' && kind !== 'badge')) return s
                return { ...s, [kind]: { ...block, fontSize: value } }
              })
            }}
          />
        </label>
        <label className="field">
          <span>Max lines — {block.maxLines}</span>
          <input
            type="range"
            min={1}
            max={4}
            value={block.maxLines}
            onChange={(e) => {
              const value = Number(e.target.value)
              console.log('maxLines changed', value)
              onPatchScene((s) => {
                const block = s[kind]
                if (!block || (kind !== 'title' && kind !== 'subtitle' && kind !== 'badge')) return s
                return { ...s, [kind]: { ...block, maxLines: value } }
              })
            }}
          />
        </label>
        <FitModeField
          value={block.fitMode ?? 'auto'}
          onChange={(next) =>
            patchTextBlock(onPatchScene, kind, (current) => ({ ...current, fitMode: next }))
          }
        />
        <label className="field field--inline">
          <span>Color</span>
          <input
            type="color"
            value={block.fill}
            onChange={(e) => {
              const value = e.target.value
              console.log('color changed', value)
              onPatchScene((s) => {
                const block = s[kind]
                if (!block || (kind !== 'title' && kind !== 'subtitle' && kind !== 'badge')) return s
                return { ...s, [kind]: { ...block, fill: value } }
              })
            }}
          />
        </label>
        <AlignField
          value={block.align ?? 'left'}
          onChange={(next) => {
            console.log('align changed', next)
            onPatchScene((s) => {
              const block = s[kind]
              if (!block || (kind !== 'title' && kind !== 'subtitle' && kind !== 'badge')) return s
              return { ...s, [kind]: { ...block, align: next } }
            })
          }}
        />
        <CaseField
          value={block.transform ?? 'none'}
          onChange={(next) => {
            console.log('case changed', next)
            onPatchScene((s) => {
              const block = s[kind]
              if (!block || (kind !== 'title' && kind !== 'subtitle' && kind !== 'badge')) return s
              return { ...s, [kind]: { ...block, transform: next } }
            })
          }}
        />
      </div>
    )
  }

  if (kind === 'cta') {
    const block = scene.cta
    if (!block) return null
    return (
      <div className="el-editor">
        <PositionPanel kind="cta" block={block} onPatchScene={onPatchScene} />
        <label className="field">
          <span>Text</span>
          <input
            type="text"
            value={block.text}
            onChange={(e) =>
              patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, text: e.target.value }))
            }
          />
        </label>
        {activeLocale ? (
          <label className="field">
            <span>Text ({activeLocale})</span>
            <input
              type="text"
              value={block.textByLocale?.[activeLocale] ?? ''}
              onChange={(e) =>
                patchTextBlock(onPatchScene, 'cta', (current) => ({
                  ...current,
                  textByLocale: {
                    ...(current.textByLocale ?? {}),
                    [activeLocale]: e.target.value,
                  },
                }))
              }
            />
          </label>
        ) : null}
        <label className="field">
          <span>Font size — {block.fontSize.toFixed(1)}%</span>
          <input
            type="range"
            min={1.5}
            max={5}
            step={0.1}
            value={block.fontSize}
            onChange={(e) =>
              patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, fontSize: Number(e.target.value) }))
            }
          />
        </label>
        <FitModeField
          value={block.fitMode ?? 'auto'}
          onChange={(next) =>
            patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, fitMode: next }))
          }
        />
        <label className="field field--inline">
          <span>Background</span>
          <input
            type="color"
            value={block.bg}
            onChange={(e) =>
              patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, bg: e.target.value }))
            }
          />
        </label>
        <label className="field field--inline">
          <span>Text color</span>
          <input
            type="color"
            value={block.fill}
            onChange={(e) =>
              patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, fill: e.target.value }))
            }
          />
        </label>
        <CaseField
          value={block.transform ?? 'none'}
          onChange={(next) =>
            patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, transform: next }))
          }
        />
      </div>
    )
  }

  if (kind === 'image') {
    const block = scene.image
    if (!block) return null
    return (
      <div className="el-editor">
        <PositionPanel kind="image" block={block} onPatchScene={onPatchScene} />
        <label className="field field--inline">
          <span>Fit</span>
          <select
            value={block.fit}
            onChange={(e) =>
              onPatchScene((s) => ({
                ...s,
                image: { ...block, fit: e.target.value as 'cover' | 'contain' },
              }))
            }
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label className="field">
          <span>Corner radius — {block.rx}px</span>
          <input
            type="range"
            min={0}
            max={48}
            value={block.rx}
            onChange={(e) =>
              onPatchScene((s) => ({ ...s, image: s.image ? { ...s.image, rx: Number(e.target.value) } : s.image }))
            }
          />
        </label>
      </div>
    )
  }

  if (kind === 'logo') {
    const block = scene.logo
    if (!block) return null
    return (
      <div className="el-editor">
        <PositionPanel kind="logo" block={block} onPatchScene={onPatchScene} />
        <div className="el-editor--note">
          Upload a logo image in the Assets tab.
        </div>
      </div>
    )
  }

  return null
}

function patchTextBlock(
  onPatchScene: (patch: (master: Scene) => Scene) => void,
  kind: 'title' | 'subtitle' | 'badge' | 'cta',
  update: (current: NonNullable<Scene['title']> | NonNullable<Scene['cta']>) => NonNullable<Scene['title']> | NonNullable<Scene['cta']>,
) {
  onPatchScene((s) => {
    const current = s[kind]
    if (!current) return s
    return { ...s, [kind]: update(current as NonNullable<Scene['title']> | NonNullable<Scene['cta']>) }
  })
}

function patchBlock(
  onPatchScene: (patch: (master: Scene) => Scene) => void,
  kind: BlockKind,
  update: (current: NonNullable<Scene[BlockKind]>) => NonNullable<Scene[BlockKind]>,
) {
  onPatchScene((s) => {
    const current = s[kind]
    if (!current) return s
    return { ...s, [kind]: update(current) }
  })
}

function PositionPanel({
  kind,
  block,
  onPatchScene,
}: {
  kind: BlockKind
  block: NonNullable<Scene[BlockKind]>
  onPatchScene: (patch: (master: Scene) => Scene) => void
}) {
  const h = block.h ?? defaultBlockHeight(kind)
  const set = (patch: Partial<{ x: number; y: number; w: number; h: number }>) => {
    patchBlock(onPatchScene, kind, (current) => ({ ...current, ...patch }))
  }

  return (
    <div className="position-panel">
      <div className="position-panel__head">
        <span>Position</span>
        <QuickPositionControls block={{ ...block, h }} onChange={set} />
      </div>
      <div className="position-grid">
        <PositionField label="X" value={block.x} min={-20} max={120} onChange={(x) => set({ x })} />
        <PositionField label="Y" value={block.y} min={-20} max={120} onChange={(y) => set({ y })} />
        <PositionField label="W" value={block.w} min={2} max={120} onChange={(w) => set({ w })} />
        <PositionField label="H" value={h} min={2} max={120} onChange={(nextH) => set({ h: nextH })} />
      </div>
    </div>
  )
}

function PositionField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <label className="position-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={0.25}
        value={round(value)}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
      />
    </label>
  )
}

function QuickPositionControls({
  block,
  onChange,
}: {
  block: { x: number; y: number; w: number; h: number }
  onChange: (patch: Partial<{ x: number; y: number }>) => void
}) {
  return (
    <div className="position-quick" aria-label="Quick position">
      <button type="button" onClick={() => onChange({ x: 0 })} title="Align left" aria-label="Align left">L</button>
      <button type="button" onClick={() => onChange({ x: (100 - block.w) / 2 })} title="Align center" aria-label="Align center">C</button>
      <button type="button" onClick={() => onChange({ x: 100 - block.w })} title="Align right" aria-label="Align right">R</button>
      <button type="button" onClick={() => onChange({ y: 0 })} title="Align top" aria-label="Align top">T</button>
      <button type="button" onClick={() => onChange({ y: (100 - block.h) / 2 })} title="Align middle" aria-label="Align middle">M</button>
      <button type="button" onClick={() => onChange({ y: 100 - block.h })} title="Align bottom" aria-label="Align bottom">B</button>
    </div>
  )
}

function defaultBlockHeight(kind: BlockKind): number {
  if (kind === 'image') return 50
  if (kind === 'logo') return 6
  if (kind === 'cta') return 7
  return 12
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function CaseField({
  value,
  onChange,
}: {
  value: NonNullable<Scene['title']>['transform'] | 'none'
  onChange: (next: 'none' | 'uppercase' | 'title-case' | 'sentence-case') => void
}) {
  return (
    <label className="field field--inline">
      <span>Case</span>
      <select value={value} onChange={(e) => onChange(e.target.value as 'none' | 'uppercase' | 'title-case' | 'sentence-case')}>
        <option value="none">Aa</option>
        <option value="uppercase">AA</option>
        <option value="title-case">Title</option>
        <option value="sentence-case">sentence</option>
      </select>
    </label>
  )
}

function FitModeField({
  value,
  onChange,
}: {
  value: TextFitMode
  onChange: (next: TextFitMode) => void
}) {
  return (
    <label className="field field--inline">
      <span>Text fit</span>
      <select value={value} onChange={(e) => onChange(e.target.value as TextFitMode)}>
        <option value="auto">Auto shrink</option>
        <option value="clamp">Clamp lines</option>
        <option value="ellipsis">Ellipsis</option>
        <option value="overflow">Allow overflow</option>
      </select>
    </label>
  )
}

// Three-button segmented control for text alignment. Matches the familiar
// left / center / right paradigm from document editors so the control is
// self-explanatory without a label.
function AlignField({
  value,
  onChange,
}: {
  value: TextAlign
  onChange: (next: TextAlign) => void
}) {
  const options: { v: TextAlign; label: string; glyph: string }[] = [
    { v: 'left', label: 'Align left', glyph: '⇤' },
    { v: 'center', label: 'Align center', glyph: '↔' },
    { v: 'right', label: 'Align right', glyph: '⇥' },
  ]
  return (
    <div className="field field--inline">
      <span>Align</span>
      <div className="align-seg" role="group" aria-label="Text alignment">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={`align-seg__btn${value === o.v ? ' is-on' : ''}`}
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
            title={o.label}
            aria-label={o.label}
          >
            {o.glyph}
          </button>
        ))}
      </div>
    </div>
  )
}
