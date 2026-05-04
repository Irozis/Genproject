import type { BlockKind, ImageBlock, Scene, TextAlign, TextFitMode } from '../lib/types'

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
          <span>Текст</span>
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
            <span>Текст ({activeLocale})</span>
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
          <span>Размер шрифта - {block.fontSize.toFixed(1)}%</span>
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
          <span>Макс. строк - {block.maxLines}</span>
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
          <span>Цвет</span>
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
          <span>Текст</span>
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
            <span>Текст ({activeLocale})</span>
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
          <span>Размер шрифта - {block.fontSize.toFixed(1)}%</span>
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
          <span>Фон</span>
          <input
            type="color"
            value={block.bg}
            onChange={(e) =>
              patchTextBlock(onPatchScene, 'cta', (current) => ({ ...current, bg: e.target.value }))
            }
          />
        </label>
        <label className="field field--inline">
          <span>Цвет текста</span>
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
          <span>Заполнение</span>
          <select
            value={block.fit}
            onChange={(e) =>
              onPatchScene((s) => ({
                ...s,
                image: { ...block, fit: e.target.value as 'cover' | 'contain' },
              }))
            }
          >
            <option value="cover">Обрезать</option>
            <option value="contain">Вместить</option>
          </select>
        </label>
        <ImageCropControls block={block} onPatchScene={onPatchScene} />
        <label className="field">
          <span>Скругление - {block.rx}px</span>
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
          Загрузите логотип во вкладке "Медиа".
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

function ImageCropControls({
  block,
  onPatchScene,
}: {
  block: ImageBlock
  onPatchScene: (patch: (master: Scene) => Scene) => void
}) {
  const update = (patch: Partial<ImageBlock>) => {
    onPatchScene((s) => ({ ...s, image: s.image ? { ...s.image, ...patch } : s.image }))
  }
  const fx = block.focalX ?? 0.5
  const fy = block.focalY ?? 0.5
  const zoom = block.cropZoom ?? 1
  const cropX = block.cropX ?? 0
  const cropY = block.cropY ?? 0

  return (
    <div className="crop-panel">
      <div className="crop-panel__head">Кадрирование</div>
      <label className="field">
        <span>Масштаб - {zoom.toFixed(2)}x</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => update({ cropZoom: Number(e.target.value) })}
        />
      </label>
      <div className="crop-grid">
        <label className="field">
          <span>Сдвиг X - {cropX.toFixed(0)}%</span>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={cropX}
            onChange={(e) => update({ cropX: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Сдвиг Y - {cropY.toFixed(0)}%</span>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={cropY}
            onChange={(e) => update({ cropY: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="crop-grid">
        <label className="field">
          <span>Фокус X - {Math.round(fx * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={fx}
            onChange={(e) => update({ focalX: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Фокус Y - {Math.round(fy * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={fy}
            onChange={(e) => update({ focalY: Number(e.target.value) })}
          />
        </label>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => update({ cropZoom: 1, cropX: 0, cropY: 0, focalX: 0.5, focalY: 0.5 })}
      >
        Сбросить кадр
      </button>
    </div>
  )
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
        <span>Положение и размер</span>
      </div>
      <div className="position-panel__body">
        <div className="position-fields">
          <PositionField
            label="Слева"
            unit="%"
            hint="Отступ от левого края холста"
            value={block.x}
            min={-20}
            max={120}
            onChange={(x) => set({ x })}
          />
          <PositionField
            label="Сверху"
            unit="%"
            hint="Отступ от верхнего края холста"
            value={block.y}
            min={-20}
            max={120}
            onChange={(y) => set({ y })}
          />
          <PositionField
            label="Ширина"
            unit="%"
            hint="Ширина блока в процентах от ширины холста"
            value={block.w}
            min={2}
            max={120}
            onChange={(w) => set({ w })}
          />
          <PositionField
            label="Высота"
            unit="%"
            hint="Высота блока в процентах от высоты холста"
            value={h}
            min={2}
            max={120}
            onChange={(nextH) => set({ h: nextH })}
          />
        </div>
        <AnchorPad block={{ ...block, h }} onChange={set} />
      </div>
    </div>
  )
}

function PositionField({
  label,
  unit,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit?: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <label className="position-field" title={hint}>
      <span className="position-field__label">{label}</span>
      <span className="position-field__input-wrap">
        <input
          type="number"
          min={min}
          max={max}
          step={0.25}
          value={round(value)}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        />
        {unit ? <span className="position-field__unit">{unit}</span> : null}
      </span>
    </label>
  )
}

// 3×3 grid of buttons that snap the block to the corresponding edge/corner of
// the canvas. Mirrors the alignment widget familiar from Figma/Sketch/PowerPoint
// — far more discoverable than single-letter shortcuts.
type AnchorH = 'left' | 'center' | 'right'
type AnchorV = 'top' | 'middle' | 'bottom'

function AnchorPad({
  block,
  onChange,
}: {
  block: { x: number; y: number; w: number; h: number }
  onChange: (patch: Partial<{ x: number; y: number }>) => void
}) {
  const xFor = (h: AnchorH): number => {
    if (h === 'left') return 0
    if (h === 'right') return 100 - block.w
    return (100 - block.w) / 2
  }
  const yFor = (v: AnchorV): number => {
    if (v === 'top') return 0
    if (v === 'bottom') return 100 - block.h
    return (100 - block.h) / 2
  }
  const labelFor = (h: AnchorH, v: AnchorV): string => {
    const hLabel = h === 'left' ? 'к левому краю' : h === 'right' ? 'к правому краю' : 'по горизонтали'
    const vLabel = v === 'top' ? 'к верхнему краю' : v === 'bottom' ? 'к нижнему краю' : 'по вертикали'
    if (h === 'center' && v === 'middle') return 'По центру холста'
    if (h === 'center') return `Прижать ${vLabel} и центрировать по горизонтали`
    if (v === 'middle') return `Прижать ${hLabel} и центрировать по вертикали`
    return `Прижать ${hLabel} и ${vLabel}`
  }
  const isActive = (h: AnchorH, v: AnchorV): boolean => {
    const dx = Math.abs(block.x - xFor(h))
    const dy = Math.abs(block.y - yFor(v))
    return dx < 0.5 && dy < 0.5
  }
  const order: Array<[AnchorV, AnchorH]> = [
    ['top', 'left'], ['top', 'center'], ['top', 'right'],
    ['middle', 'left'], ['middle', 'center'], ['middle', 'right'],
    ['bottom', 'left'], ['bottom', 'center'], ['bottom', 'right'],
  ]
  return (
    <div className="anchor-pad" role="group" aria-label="Привязка к холсту">
      <div className="anchor-pad__head">Привязать</div>
      <div className="anchor-pad__grid">
        {order.map(([v, h]) => {
          const active = isActive(h, v)
          return (
            <button
              key={`${v}-${h}`}
              type="button"
              className={`anchor-pad__cell${active ? ' is-on' : ''}`}
              title={labelFor(h, v)}
              aria-label={labelFor(h, v)}
              aria-pressed={active}
              onClick={() => onChange({ x: xFor(h), y: yFor(v) })}
            >
              <span className="anchor-pad__dot" aria-hidden="true" />
            </button>
          )
        })}
      </div>
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
      <span>Регистр</span>
      <select value={value} onChange={(e) => onChange(e.target.value as 'none' | 'uppercase' | 'title-case' | 'sentence-case')}>
        <option value="none">Как есть</option>
        <option value="uppercase">ВЕРХНИЙ</option>
        <option value="title-case">С Заглавных</option>
        <option value="sentence-case">Как предложение</option>
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
      <span>Подгонка текста</span>
      <select value={value} onChange={(e) => onChange(e.target.value as TextFitMode)}>
        <option value="auto">Автоуменьшение</option>
        <option value="clamp">Ограничить строки</option>
        <option value="ellipsis">Многоточие</option>
        <option value="overflow">Разрешить выход</option>
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
    { v: 'left', label: 'По левому краю', glyph: '⇤' },
    { v: 'center', label: 'По центру', glyph: '↔' },
    { v: 'right', label: 'По правому краю', glyph: '⇥' },
  ]
  return (
    <div className="field field--inline">
      <span>Выравнивание</span>
      <div className="align-seg" role="group" aria-label="Выравнивание текста">
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
