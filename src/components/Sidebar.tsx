import { useState } from 'react'
import { BrandSystemPanel } from './BrandSystemPanel'
import { ElementRow } from './ElementRow'
import { FilePicker } from './FilePicker'
import { SidebarTabs, type SidebarTab } from './SidebarTabs'
import { BASE_FORMAT_KEYS, RU_MARKETPLACE_FORMAT_KEYS, getFormat } from '../lib/formats'
import type { DerivedBrandColors } from '../lib/paletteFromImage'
import type { BlockKind, BrandKit, BrandSnapshot, EnabledMap, FormatKey, Project, Scene } from '../lib/types'

const ELEMENT_ROWS: { kind: BlockKind; label: string }[] = [
  { kind: 'title', label: 'Title' },
  { kind: 'subtitle', label: 'Subtitle' },
  { kind: 'cta', label: 'Call to action' },
  { kind: 'badge', label: 'Badge' },
  { kind: 'logo', label: 'Logo' },
  { kind: 'image', label: 'Image' },
]

type Props = {
  project: Project
  selectedKind: BlockKind | null
  onPatchScene: (patch: (master: Scene) => Scene) => void
  onToggleEnabled: (kind: BlockKind, next: boolean) => void
  onBrandChange: (next: BrandKit) => void
  onSetImage: (dataUrl: string) => void
  onSetLogo: (dataUrl: string) => void
  onToggleFormat: (key: FormatKey) => void
  /** Per-format focal override. Pass null to clear (inherit master). */
  onSetFormatFocal: (key: FormatKey, focal: { x: number; y: number } | null) => void
  /** Palette variants derived from the analyzed image. Empty when no image. */
  paletteAlternatives?: DerivedBrandColors[]
  onApplyPaletteAlt?: (alt: DerivedBrandColors) => void
  onTogglePaletteLock: (next: boolean) => void
  snapshots: BrandSnapshot[]
  onSaveSnapshot: (name: string) => void
  onApplySnapshot: (id: string) => void
  onDeleteSnapshot: (id: string) => void
  onSetLocales: (locales: string[]) => void
  onAddCustomFormat: (input: { name: string; width: number; height: number; safePct: number; gutterPct: number }) => void
  onDeleteCustomFormat: (key: FormatKey) => void
}

export function Sidebar({
  project,
  selectedKind,
  onPatchScene,
  onToggleEnabled,
  onBrandChange,
  onSetImage,
  onSetLogo,
  onToggleFormat,
  onSetFormatFocal,
  paletteAlternatives,
  onApplyPaletteAlt,
  onTogglePaletteLock,
  snapshots,
  onSaveSnapshot,
  onApplySnapshot,
  onDeleteSnapshot,
  onSetLocales,
  onAddCustomFormat,
  onDeleteCustomFormat,
}: Props) {
  const [tab, setTab] = useState<SidebarTab>('setup')
  const [customName, setCustomName] = useState('')
  const [customWidth, setCustomWidth] = useState('300')
  const [customHeight, setCustomHeight] = useState('300')

  return (
    <aside className="sidebar">
      <SidebarTabs active={tab} onChange={setTab} />
      <div className="sidebar__scroll">
        {tab === 'setup' ? (
          <>
            <SectionHeader>Elements</SectionHeader>
            <div className="el-list">
              {ELEMENT_ROWS.map((row) => (
                <ElementRow
                  key={row.kind}
                  kind={row.kind}
                  label={row.label}
                  enabled={project.enabled[row.kind]}
                  forceOpen={selectedKind === row.kind}
                  scene={project.master}
                  onToggle={(n) => onToggleEnabled(row.kind, n)}
                  onPatchScene={onPatchScene}
                  activeLocale={project.activeLocale}
                />
              ))}
            </div>

            <SectionHeader>Formats</SectionHeader>
            <div className="format-list">
              {BASE_FORMAT_KEYS.map((k) => {
                const enabled = project.selectedFormats.includes(k)
                const f = getFormat(k)
                return (
                  <label key={k} className={`format-row${enabled ? ' is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => onToggleFormat(k)}
                    />
                    <span className="format-row__label">{f.label}</span>
                    <span className="format-row__dim">{f.width}×{f.height}</span>
                  </label>
                )
              })}
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8, marginBottom: 4 }}>Маркетплейсы РФ</div>
              {RU_MARKETPLACE_FORMAT_KEYS.map((k) => {
                const enabled = project.selectedFormats.includes(k)
                const f = getFormat(k)
                return (
                  <label key={k} className={`format-row${enabled ? ' is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => onToggleFormat(k)}
                    />
                    <span className="format-row__label">{f.label}</span>
                    <span className="format-row__dim">{f.width}×{f.height}</span>
                  </label>
                )
              })}
              {(project.customFormats ?? []).map((f) => {
                const enabled = project.selectedFormats.includes(f.key)
                return (
                  <div key={f.key} className={`format-row format-row--custom${enabled ? ' is-on' : ''}`}>
                    <label style={{ display: 'contents' }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => onToggleFormat(f.key)}
                      />
                      <span className="format-row__label">{f.label}</span>
                      <span className="format-row__dim">{f.width}×{f.height}</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-icon"
                      onClick={() => onDeleteCustomFormat(f.key)}
                      aria-label={`Delete ${f.label}`}
                      title={`Delete ${f.label}`}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
            <details className="custom-format">
              <summary className="custom-format__toggle">+ Add custom format</summary>
              <div className="custom-format__form">
                <input
                  type="text"
                  className="custom-format__name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Name"
                />
                <div className="custom-format__dims">
                  <input
                    type="number"
                    min={64}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="W"
                    aria-label="Width"
                  />
                  <span aria-hidden="true">×</span>
                  <input
                    type="number"
                    min={64}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="H"
                    aria-label="Height"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-icon"
                    aria-label="Add custom format"
                    title="Add custom format"
                    onClick={() => {
                      const width = Number(customWidth)
                      const height = Number(customHeight)
                      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
                      onAddCustomFormat({ name: customName || 'Custom', width, height, safePct: 8, gutterPct: 4 })
                      setCustomName('')
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </details>

            <SectionHeader>Locales</SectionHeader>
            <label className="field">
              <span>Available locales (comma separated)</span>
              <input
                type="text"
                value={(project.availableLocales ?? []).join(', ')}
                onChange={(e) =>
                  onSetLocales(
                    e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="en, ru"
              />
            </label>

            <BrandSystemPanel
              brandKit={project.brandKit}
              onChange={onBrandChange}
              alternatives={paletteAlternatives}
              onApplyAlternative={onApplyPaletteAlt}
              paletteLocked={project.paletteLocked}
              onTogglePaletteLock={onTogglePaletteLock}
              snapshots={snapshots}
              onSaveSnapshot={onSaveSnapshot}
              onApplySnapshot={onApplySnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
            />
          </>
        ) : (
          <>
            <SectionHeader>Images</SectionHeader>
            <div className="asset-block">
              <div className="asset-block__label">Main image</div>
              <FilePicker
                label={project.imageSrc ? 'Replace' : 'Upload'}
                hint={project.imageSrc ? 'Loaded' : 'PNG / JPG'}
                onFile={(dataUrl) => onSetImage(dataUrl)}
              />
              {project.imageSrc ? (
                <>
                  <img className="asset-thumb" src={project.imageSrc} alt="" />
                  <div className="focal-label">Master focal</div>
                  <FocalGrid
                    fx={project.master.image?.focalX ?? 0.5}
                    fy={project.master.image?.focalY ?? 0.5}
                    onPick={(fx, fy) =>
                      onPatchScene((s) => ({
                        ...s,
                        image: s.image ? { ...s.image, focalX: fx, focalY: fy } : s.image,
                      }))
                    }
                  />
                  <PerFormatFocals
                    selectedFormats={project.selectedFormats}
                    masterFocal={{
                      x: project.master.image?.focalX ?? 0.5,
                      y: project.master.image?.focalY ?? 0.5,
                    }}
                    focals={project.imageFocals ?? {}}
                    onSet={onSetFormatFocal}
                  />
                </>
              ) : null}
            </div>

            <div className="asset-block">
              <div className="asset-block__label">Logo</div>
              <FilePicker
                label={project.logoSrc ? 'Replace' : 'Upload'}
                hint={project.logoSrc ? 'Loaded' : 'SVG / PNG'}
                onFile={(dataUrl) => onSetLogo(dataUrl)}
              />
              {project.logoSrc ? (
                <img className="asset-thumb asset-thumb--logo" src={project.logoSrc} alt="" />
              ) : null}
            </div>

            <BrandSystemPanel
              brandKit={project.brandKit}
              onChange={onBrandChange}
              alternatives={paletteAlternatives}
              onApplyAlternative={onApplyPaletteAlt}
              paletteLocked={project.paletteLocked}
              onTogglePaletteLock={onTogglePaletteLock}
              snapshots={snapshots}
              onSaveSnapshot={onSaveSnapshot}
              onApplySnapshot={onApplySnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
            />
          </>
        )}
      </div>
    </aside>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="section-header">{children}</div>
}

// 3×3 focal-point picker. Nine deterministic anchors — enough to keep the
// subject (face, legs, logo) in frame when cover-cropping an off-centre photo,
// without pretending we can solve it automatically without ML.
function FocalGrid({
  fx,
  fy,
  onPick,
}: {
  fx: number
  fy: number
  onPick: (fx: number, fy: number) => void
}) {
  const cols = [0, 0.5, 1] as const
  const rows = [0, 0.5, 1] as const
  // A cell counts as "active" when both axes round to the same third as fx/fy.
  const activeCol = fx < 1 / 3 ? 0 : fx > 2 / 3 ? 2 : 1
  const activeRow = fy < 1 / 3 ? 0 : fy > 2 / 3 ? 2 : 1
  return (
    <div className="focal-grid" role="group" aria-label="Image focal point">
      {rows.map((ry, ri) =>
        cols.map((cx, ci) => {
          const isActive = ri === activeRow && ci === activeCol
          return (
            <button
              key={`${ri}-${ci}`}
              type="button"
              className={`focal-grid__cell${isActive ? ' is-on' : ''}`}
              onClick={() => onPick(cx, ry)}
              aria-label={`Focal ${ci === 0 ? 'left' : ci === 1 ? 'center' : 'right'} / ${ri === 0 ? 'top' : ri === 1 ? 'middle' : 'bottom'}`}
              aria-pressed={isActive}
            >
              <span className="focal-grid__dot" />
            </button>
          )
        }),
      )}
    </div>
  )
}

// Per-format focal overrides. Collapsed by default; each row shows a compact
// 3×3 grid + a reset-to-master affordance. The master focal is the fallback —
// users only reach for this when one specific format crops badly (e.g. the
// 1080×1350 highlight chopping feet while the others look fine).
function PerFormatFocals({
  selectedFormats,
  masterFocal,
  focals,
  onSet,
}: {
  selectedFormats: FormatKey[]
  masterFocal: { x: number; y: number }
  focals: Partial<Record<FormatKey, { x: number; y: number }>>
  onSet: (key: FormatKey, focal: { x: number; y: number } | null) => void
}) {
  const [open, setOpen] = useState(false)
  if (selectedFormats.length === 0) return null
  return (
    <div className="focal-perfmt">
      <button
        type="button"
        className="focal-perfmt__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Per-format focal</span>
        <span className="focal-perfmt__chev">{open ? '–' : '+'}</span>
      </button>
      {open ? (
        <div className="focal-perfmt__list">
          {selectedFormats.map((k) => {
            const override = focals[k]
            const active = override ?? masterFocal
            const f = getFormat(k)
            return (
              <div key={k} className="focal-perfmt__row">
                <div className="focal-perfmt__meta">
                  <div className="focal-perfmt__name">{f.label}</div>
                  <button
                    type="button"
                    className="focal-perfmt__reset"
                    disabled={!override}
                    onClick={() => onSet(k, null)}
                    title={override ? 'Reset to master' : 'Inheriting master'}
                  >
                    {override ? 'Reset' : 'Inherit'}
                  </button>
                </div>
                <FocalGrid
                  fx={active.x}
                  fy={active.y}
                  onPick={(fx, fy) => onSet(k, { x: fx, y: fy })}
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// Marker so `EnabledMap` is referenced (used by callers via project.enabled)
export type _SidebarEnabledMap = EnabledMap
