import { useMemo, type ReactNode } from 'react'
import { validateObjectEdit } from '../../lib/objectEditValidation'
import type { FormatRuleSet, SceneObject, TextAlign } from '../../lib/types'

type Props = {
  object: SceneObject | null
  objects: SceneObject[]
  format: FormatRuleSet
  onChange: (objectId: string, patch: Partial<SceneObject>) => void
}

const TEXT_TYPES = new Set<SceneObject['type']>(['title', 'subtitle', 'cta', 'badge', 'text'])
const STYLE_TYPES = new Set<SceneObject['type']>(['shape', 'image', 'cta', 'badge', 'custom-image'])
const IMAGE_TYPES = new Set<SceneObject['type']>(['image', 'logo', 'custom-image'])

export function ObjectPropertiesPanel({ object, objects, format, onChange }: Props) {
  const issues = useMemo(
    () => (object ? validateObjectEdit(object, format, objects) : []),
    [format, object, objects],
  )

  if (!object) {
    return <div className="layout-editor__empty">Выберите объект для редактирования</div>
  }

  const disabled = !!object.locked
  const patch = (next: Partial<SceneObject>) => {
    if (disabled) return
    onChange(object.id, next)
  }

  return (
    <div className="layout-editor__props object-properties-panel">
      <div className="layout-editor__props-head">
        <span>{object.name}</span>
        <span className="layers-panel__type">{object.type}</span>
      </div>

      {disabled ? <p className="layout-editor__locked-note">Объект заблокирован</p> : null}

      <PropsSection title="Положение и размер">
        <div className="layout-editor__props-grid">
          <NumberField label="X" value={object.x} disabled={disabled} onChange={(x) => patch({ x })} />
          <NumberField label="Y" value={object.y} disabled={disabled} onChange={(y) => patch({ y })} />
          <NumberField label="Ширина" value={object.width} disabled={disabled} min={1} onChange={(width) => patch({ width })} />
          <NumberField label="Высота" value={object.height} disabled={disabled} min={1} onChange={(height) => patch({ height })} />
          <NumberField label="Поворот" value={object.rotation ?? 0} disabled={disabled} onChange={(rotation) => patch({ rotation })} />
          <NumberField label="Z-index" value={object.zIndex ?? 0} disabled={disabled} onChange={(zIndex) => patch({ zIndex })} />
        </div>
      </PropsSection>

      {TEXT_TYPES.has(object.type) ? (
        <PropsSection title="Текст">
          <label className="layout-editor__row">
            <span>Содержимое</span>
            <textarea value={object.text ?? ''} disabled={disabled} onChange={(event) => patch({ text: event.target.value })} />
          </label>
          <label className="layout-editor__row">
            <span>Шрифт</span>
            <input
              type="text"
              value={object.fontFamily ?? ''}
              disabled={disabled}
              onChange={(event) => patch({ fontFamily: emptyToUndefined(event.target.value) })}
            />
          </label>
          <div className="layout-editor__props-grid">
            <NumberField label="Размер" value={object.fontSize ?? 4} disabled={disabled} min={0} onChange={(fontSize) => patch({ fontSize })} />
            <NumberField label="Насыщенность" value={object.fontWeight ?? 600} disabled={disabled} min={1} onChange={(fontWeight) => patch({ fontWeight })} />
            <NumberField label="Line height" value={object.lineHeight ?? 1.2} disabled={disabled} min={0} step={0.05} onChange={(lineHeight) => patch({ lineHeight })} />
            <NumberField label="Tracking" value={object.letterSpacing ?? 0} disabled={disabled} step={0.01} onChange={(letterSpacing) => patch({ letterSpacing })} />
          </div>
          <label className="layout-editor__row layout-editor__row--inline">
            <span>Выравнивание</span>
            <select
              value={object.textAlign ?? 'left'}
              disabled={disabled}
              onChange={(event) => patch({ textAlign: event.target.value as TextAlign })}
            >
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
            </select>
          </label>
          <ColorField label="Цвет" value={object.fill ?? '#111827'} disabled={disabled} onChange={(fill) => patch({ fill })} />
        </PropsSection>
      ) : null}

      {STYLE_TYPES.has(object.type) ? (
        <PropsSection title="Стиль">
          <ColorField label="Заливка" value={object.fill ?? '#111827'} disabled={disabled} onChange={(fill) => patch({ fill })} />
          <ColorField label="Обводка" value={object.stroke ?? '#000000'} disabled={disabled} onChange={(stroke) => patch({ stroke })} />
          <div className="layout-editor__props-grid">
            <NumberField label="Прозрачность" value={object.opacity ?? 1} disabled={disabled} min={0} step={0.05} onChange={(opacity) => patch({ opacity })} />
            <NumberField label="Радиус" value={object.borderRadius ?? 0} disabled={disabled} min={0} onChange={(borderRadius) => patch({ borderRadius })} />
          </div>
        </PropsSection>
      ) : null}

      {IMAGE_TYPES.has(object.type) ? (
        <PropsSection title="Изображение">
          {object.type !== 'logo' ? (
            <label className="layout-editor__row layout-editor__row--inline">
              <span>Fit</span>
              <select
                value={object.fit ?? 'cover'}
                disabled={disabled}
                onChange={(event) => patch({ fit: event.target.value as SceneObject['fit'] })}
              >
                <option value="cover">cover</option>
                <option value="contain">contain</option>
                <option value="fill">fill</option>
              </select>
            </label>
          ) : null}
          <div className="layout-editor__props-grid">
            <NumberField label="Радиус" value={object.borderRadius ?? 0} disabled={disabled} min={0} onChange={(borderRadius) => patch({ borderRadius })} />
            <NumberField label="Прозрачность" value={object.opacity ?? 1} disabled={disabled} min={0} step={0.05} onChange={(opacity) => patch({ opacity })} />
          </div>
        </PropsSection>
      ) : null}

      {issues.length > 0 ? (
        <PropsSection title="Предупреждения">
          <ul className="layout-editor__warnings">
            {issues.map((issue) => <li key={issue.code}>{issue.message}</li>)}
          </ul>
        </PropsSection>
      ) : null}
    </div>
  )
}

function PropsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="layout-editor__section">
      <header className="layout-editor__section-head">{title}</header>
      <div className="layout-editor__section-body">{children}</div>
    </section>
  )
}

function NumberField({
  label,
  value,
  disabled,
  min,
  step = 0.25,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  min?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="layout-editor__field">
      <span>{label}</span>
      <span className="layout-editor__field-input">
        <input
          type="number"
          step={step}
          value={cleanNumber(value)}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (!Number.isFinite(next)) return
            onChange(typeof min === 'number' ? Math.max(min, next) : next)
          }}
        />
      </span>
    </label>
  )
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="layout-editor__row layout-editor__row--inline">
      <span>{label}</span>
      <span className="layout-editor__color">
        <input type="color" value={safeColor(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
        <input type="text" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
      </span>
    </label>
  )
}

function cleanNumber(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value
}

function safeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
}
