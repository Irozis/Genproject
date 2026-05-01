import { useState } from 'react'
import { FONT_PAIRS, findMatchingPair } from '../lib/fontPairs'
import type { DerivedBrandColors } from '../lib/paletteFromImage'
import type { BrandKit, BrandSnapshot, CtaStyle, Palette, Tone } from '../lib/types'

type Props = {
  brandKit: BrandKit
  onChange: (next: BrandKit) => void
  /** Optional palette suggestions derived from an analyzed image. When provided,
   *  shown as a swatch row at the top of the panel for quick one-click apply. */
  alternatives?: DerivedBrandColors[]
  onApplyAlternative?: (alt: DerivedBrandColors) => void
  paletteLocked?: boolean
  onTogglePaletteLock?: (next: boolean) => void
  snapshots?: BrandSnapshot[]
  onSaveSnapshot?: (name: string) => void
  onApplySnapshot?: (id: string) => void
  onDeleteSnapshot?: (id: string) => void
}

export function BrandSystemPanel({
  brandKit,
  onChange,
  alternatives,
  onApplyAlternative,
  paletteLocked,
  onTogglePaletteLock,
  snapshots,
  onSaveSnapshot,
  onApplySnapshot,
  onDeleteSnapshot,
}: Props) {
  const [open, setOpen] = useState(true)
  const [snapshotName, setSnapshotName] = useState('')

  const updatePalette = (patch: Partial<Palette>) =>
    onChange({ ...brandKit, palette: { ...brandKit.palette, ...patch } })

  return (
    <section className={`panel${open ? ' is-open' : ''}`}>
      <button className="panel__head" onClick={() => setOpen((o) => !o)}>
        <span>Бренд-система</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="panel__body">
          {alternatives && alternatives.length > 1 && onApplyAlternative ? (
            <div className="field">
              <span>Варианты палитры</span>
              <div className="palette-alts">
                {alternatives.map((alt, i) => {
                  const active = alt.palette.accent.toLowerCase() === brandKit.palette.accent.toLowerCase()
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`palette-alts__item${active ? ' is-on' : ''}`}
                      onClick={() => onApplyAlternative(alt)}
                      title={`Акцент ${alt.palette.accent}`}
                      aria-label={`Применить вариант палитры ${i + 1}`}
                      aria-pressed={active}
                    >
                      <span
                        className="palette-alts__swatch"
                        style={{ background: alt.palette.accent }}
                      />
                      <span
                        className="palette-alts__swatch"
                        style={{ background: alt.palette.ink }}
                      />
                      <span
                        className="palette-alts__swatch"
                        style={{ background: alt.palette.surface }}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          <label className="field">
            <span>Название бренда</span>
            <input
              type="text"
              value={brandKit.brandName}
              onChange={(e) => onChange({ ...brandKit, brandName: e.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span>Основной текст</span>
            <input
              type="color"
              value={brandKit.palette.ink}
              onChange={(e) => updatePalette({ ink: e.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span>Акцент</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={brandKit.palette.accent}
                onChange={(e) => updatePalette({ accent: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onTogglePaletteLock?.(!paletteLocked)}
                title={paletteLocked ? 'Разрешить обновление палитры по изображению' : 'Зафиксировать палитру'}
                aria-pressed={!!paletteLocked}
              >
                {paletteLocked ? '🔒' : '🔓'}
              </button>
            </div>
          </label>
          <label className="field field--inline">
            <span>Светлая поверхность</span>
            <input
              type="color"
              value={brandKit.palette.surface}
              onChange={(e) => updatePalette({ surface: e.target.value })}
            />
          </label>
          <fieldset className="field">
            <legend>Градиент</legend>
            <div className="gradient-row">
              {brandKit.gradient.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const next = [...brandKit.gradient] as [string, string, string]
                    next[i] = e.target.value
                    onChange({ ...brandKit, gradient: next })
                  }}
                />
              ))}
            </div>
          </fieldset>
          <div className="field">
            <span>Пара шрифтов</span>
            <div className="font-pair-grid">
              {FONT_PAIRS.map((p) => {
                const active = findMatchingPair(brandKit.displayFont, brandKit.textFont)?.id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`font-pair-grid__item${active ? ' is-on' : ''}`}
                    onClick={() =>
                      onChange({
                        ...brandKit,
                        displayFont: p.displayFont,
                        textFont: p.textFont,
                      })
                    }
                    aria-pressed={active}
                  >
                    <span
                      className="font-pair-grid__display"
                      style={{ fontFamily: p.displayFont }}
                    >
                      Aa
                    </span>
                    <span className="font-pair-grid__meta">
                      <span className="font-pair-grid__label">{p.label}</span>
                      <span className="font-pair-grid__note">{p.note}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <label className="field">
            <span>Шрифт заголовков</span>
            <input
              type="text"
              value={brandKit.displayFont}
              onChange={(e) => onChange({ ...brandKit, displayFont: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Шрифт текста</span>
            <input
              type="text"
              value={brandKit.textFont}
              onChange={(e) => onChange({ ...brandKit, textFont: e.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span>Стиль кнопки</span>
            <select
              value={brandKit.ctaStyle}
              onChange={(e) => onChange({ ...brandKit, ctaStyle: e.target.value as CtaStyle })}
            >
              <option value="pill">Капсула</option>
              <option value="rounded">Скругленный</option>
              <option value="sharp">Строгий</option>
            </select>
          </label>
          <label className="field">
            <span>Тон коммуникации</span>
            <select
              value={brandKit.toneOfVoice}
              onChange={(e) => onChange({ ...brandKit, toneOfVoice: e.target.value as Tone })}
            >
              <option value="neutral">нейтральный</option>
              <option value="bold">смелый</option>
              <option value="friendly">дружелюбный</option>
              <option value="minimal">минималистичный</option>
              <option value="editorial">редакционный</option>
            </select>
          </label>
          <div className="field">
            <span>Наборы бренда</span>
            <div style={{ display: 'grid', gap: 6 }}>
              {(snapshots ?? []).map((snap) => (
                <div key={snap.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span>{snap.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onApplySnapshot?.(snap.id)}
                    >
                      Применить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onDeleteSnapshot?.(snap.id)}
                      aria-label={`Удалить ${snap.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="Название набора"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    onSaveSnapshot?.(snapshotName)
                    setSnapshotName('')
                  }}
                >
                  Сохранить текущий
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
