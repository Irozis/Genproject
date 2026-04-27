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
        <span>Brand system</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="panel__body">
          {alternatives && alternatives.length > 1 && onApplyAlternative ? (
            <div className="field">
              <span>Palette suggestions</span>
              <div className="palette-alts">
                {alternatives.map((alt, i) => {
                  const active = alt.palette.accent.toLowerCase() === brandKit.palette.accent.toLowerCase()
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`palette-alts__item${active ? ' is-on' : ''}`}
                      onClick={() => onApplyAlternative(alt)}
                      title={`Accent ${alt.palette.accent}`}
                      aria-label={`Apply palette variant ${i + 1}`}
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
            <span>Brand name</span>
            <input
              type="text"
              value={brandKit.brandName}
              onChange={(e) => onChange({ ...brandKit, brandName: e.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span>Ink (primary text)</span>
            <input
              type="color"
              value={brandKit.palette.ink}
              onChange={(e) => updatePalette({ ink: e.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span>Accent</span>
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
                title={paletteLocked ? 'Unlock palette updates from image' : 'Lock palette against image updates'}
                aria-pressed={!!paletteLocked}
              >
                {paletteLocked ? '🔒' : '🔓'}
              </button>
            </div>
          </label>
          <label className="field field--inline">
            <span>Surface (CTA text)</span>
            <input
              type="color"
              value={brandKit.palette.surface}
              onChange={(e) => updatePalette({ surface: e.target.value })}
            />
          </label>
          <fieldset className="field">
            <legend>Gradient</legend>
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
            <span>Font pair</span>
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
            <span>Display font</span>
            <input
              type="text"
              value={brandKit.displayFont}
              onChange={(e) => onChange({ ...brandKit, displayFont: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Text font</span>
            <input
              type="text"
              value={brandKit.textFont}
              onChange={(e) => onChange({ ...brandKit, textFont: e.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span>CTA style</span>
            <select
              value={brandKit.ctaStyle}
              onChange={(e) => onChange({ ...brandKit, ctaStyle: e.target.value as CtaStyle })}
            >
              <option value="pill">Pill</option>
              <option value="rounded">Rounded</option>
              <option value="sharp">Sharp</option>
            </select>
          </label>
          <label className="field">
            <span>Tone of voice</span>
            <select
              value={brandKit.toneOfVoice}
              onChange={(e) => onChange({ ...brandKit, toneOfVoice: e.target.value as Tone })}
            >
              <option value="neutral">neutral</option>
              <option value="bold">bold</option>
              <option value="friendly">friendly</option>
              <option value="minimal">minimal</option>
              <option value="editorial">editorial</option>
            </select>
          </label>
          <div className="field">
            <span>Brand kits</span>
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
                      Apply
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onDeleteSnapshot?.(snap.id)}
                      aria-label={`Delete ${snap.name}`}
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
                  placeholder="Snapshot name"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    onSaveSnapshot?.(snapshotName)
                    setSnapshotName('')
                  }}
                >
                  Save current as...
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
