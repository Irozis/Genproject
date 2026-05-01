import { useState } from 'react'
import { BrandSystemPanel } from './BrandSystemPanel'
import { ElementRow } from './ElementRow'
import { FilePicker } from './FilePicker'
import { SidebarTabs, type SidebarTab } from './SidebarTabs'
import { BASE_FORMAT_KEYS, RU_MARKETPLACE_FORMAT_KEYS, getFormat } from '../lib/formats'
import { densityLabel } from '../lib/layoutDensity'
import type { DerivedBrandColors } from '../lib/paletteFromImage'
import type { BlockKind, BrandKit, BrandSnapshot, EnabledMap, FormatKey, FormatRuleSet, LayoutDensity, Project, Scene } from '../lib/types'

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
  editingFormatKey?: FormatKey | null
  onPatchScene: (patch: (master: Scene) => Scene) => void
  onResetFormatCustom: (key: FormatKey) => void
  onResetFormatBlock: (key: FormatKey, kind: BlockKind) => void
  onSetLayoutDensity: (density: LayoutDensity, formatKey?: FormatKey | null) => void
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
  editingFormatKey,
  onPatchScene,
  onResetFormatCustom,
  onResetFormatBlock,
  onSetLayoutDensity,
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

            {editingFormatKey ? (
              <>
                <OverridePanel
                  formatKey={editingFormatKey}
                  project={project}
                  onResetFormatCustom={onResetFormatCustom}
                  onResetFormatBlock={onResetFormatBlock}
                />
                <DensityPanel
                  density={project.formatDensities?.[editingFormatKey] ?? project.layoutDensity ?? 'balanced'}
                  scopeLabel={getFormat(editingFormatKey, project.customFormats).label}
                  onChange={(density) => onSetLayoutDensity(density, editingFormatKey)}
                />
                <SpacingPanel
                  scene={project.master}
                  formatKey={editingFormatKey}
                  customFormats={project.customFormats}
                  onPatchScene={onPatchScene}
                />
              </>
            ) : (
              <DensityPanel
                density={project.layoutDensity ?? 'balanced'}
                scopeLabel="All formats"
                onChange={(density) => onSetLayoutDensity(density, null)}
              />
            )}

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
function OverridePanel({
  formatKey,
  project,
  onResetFormatCustom,
  onResetFormatBlock,
}: {
  formatKey: FormatKey
  project: Project
  onResetFormatCustom: (key: FormatKey) => void
  onResetFormatBlock: (key: FormatKey, kind: BlockKind) => void
}) {
  const overrides = project.blockOverrides?.[formatKey] ?? {}
  const kinds = ELEMENT_ROWS.map((row) => row.kind).filter((kind) => !!overrides[kind])
  const label = getFormat(formatKey, project.customFormats).label

  return (
    <>
      <SectionHeader>Custom format</SectionHeader>
      <div className="override-panel">
        <div className="override-panel__head">
          <div>
            <div className="override-panel__title">{label}</div>
            <div className="override-panel__meta">{kinds.length} block{kinds.length === 1 ? '' : 's'} overridden</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onResetFormatCustom(formatKey)}
          >
            Reset all
          </button>
        </div>
        {kinds.length > 0 ? (
          <div className="override-panel__rows">
            {kinds.map((kind) => (
              <div key={kind} className="override-panel__row">
                <span>{labelForKind(kind)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onResetFormatBlock(formatKey, kind)}
                >
                  Reset
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="override-panel__empty">This format is inheriting all blocks.</div>
        )}
      </div>
    </>
  )
}

function labelForKind(kind: BlockKind): string {
  return ELEMENT_ROWS.find((row) => row.kind === kind)?.label ?? kind
}

function DensityPanel({
  density,
  scopeLabel,
  onChange,
}: {
  density: LayoutDensity
  scopeLabel: string
  onChange: (density: LayoutDensity) => void
}) {
  const options: LayoutDensity[] = ['compact', 'balanced', 'spacious']
  return (
    <>
      <SectionHeader>Layout density</SectionHeader>
      <div className="density-panel">
        <div className="density-panel__meta">{scopeLabel}</div>
        <div className="density-seg" role="group" aria-label="Layout density">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`density-seg__btn${density === option ? ' is-on' : ''}`}
              onClick={() => onChange(option)}
              aria-pressed={density === option}
            >
              {densityLabel(option)}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function SpacingPanel({
  scene,
  formatKey,
  customFormats,
  onPatchScene,
}: {
  scene: Scene
  formatKey: FormatKey
  customFormats?: FormatRuleSet[]
  onPatchScene: (patch: (master: Scene) => Scene) => void
}) {
  const rules = getFormat(formatKey, customFormats)
  const titleSubtitleGap = blockGap(scene, 'title', 'subtitle', rules.aspectRatio)
  const subtitleCtaGap = blockGap(scene, 'subtitle', 'cta', rules.aspectRatio)
  const titleCtaGap = !scene.subtitle ? blockGap(scene, 'title', 'cta', rules.aspectRatio) : null
  const cta = scene.cta

  if (titleSubtitleGap === null && subtitleCtaGap === null && titleCtaGap === null && !cta) return null

  return (
    <>
      <SectionHeader>Spacing</SectionHeader>
      <div className="spacing-panel">
        {titleSubtitleGap !== null ? (
          <GapField
            label="Title to subtitle"
            value={titleSubtitleGap}
            onChange={(next) => setGap(onPatchScene, 'title', 'subtitle', next, rules.aspectRatio, ['subtitle', 'cta'])}
          />
        ) : null}
        {subtitleCtaGap !== null ? (
          <GapField
            label="Subtitle to CTA"
            value={subtitleCtaGap}
            onChange={(next) => setGap(onPatchScene, 'subtitle', 'cta', next, rules.aspectRatio, ['cta'])}
          />
        ) : null}
        {titleCtaGap !== null ? (
          <GapField
            label="Title to CTA"
            value={titleCtaGap}
            onChange={(next) => setGap(onPatchScene, 'title', 'cta', next, rules.aspectRatio, ['cta'])}
          />
        ) : null}
        {cta ? (
          <label className="field">
            <span>CTA height - {(cta.h ?? 5).toFixed(1)}%</span>
            <input
              type="range"
              min={2}
              max={18}
              step={0.25}
              value={cta.h ?? 5}
              onChange={(e) => {
                const h = Number(e.target.value)
                onPatchScene((s) => ({ ...s, cta: s.cta ? { ...s.cta, h } : s.cta }))
              }}
            />
          </label>
        ) : null}
      </div>
    </>
  )
}

function GapField({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return (
    <label className="field">
      <span>{label} - {value.toFixed(1)}%</span>
      <input
        type="range"
        min={0}
        max={22}
        step={0.25}
        value={clamp(value, 0, 22)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function setGap(
  onPatchScene: (patch: (master: Scene) => Scene) => void,
  from: BlockKind,
  to: BlockKind,
  nextGap: number,
  aspectRatio: number,
  moveKinds: BlockKind[],
) {
  onPatchScene((s) => {
    const current = blockGap(s, from, to, aspectRatio)
    if (current === null) return s
    const dy = nextGap - current
    if (Math.abs(dy) < 0.001) return s
    const out: Scene = { ...s }
    for (const kind of moveKinds) {
      const block = out[kind]
      if (!block) continue
      ;(out as Record<string, unknown>)[kind] = { ...block, y: clamp(block.y + dy, -20, 120) }
    }
    return out
  })
}

function blockGap(scene: Scene, from: BlockKind, to: BlockKind, aspectRatio: number): number | null {
  const a = scene[from]
  const b = scene[to]
  if (!a || !b) return null
  return b.y - (a.y + blockVisualHeight(a, aspectRatio))
}

function blockVisualHeight(block: NonNullable<Scene[BlockKind]>, aspectRatio: number): number {
  if (typeof block.h === 'number') return block.h
  if ('fontSize' in block) {
    const lines = block.maxLines ?? 1
    const lineHeight = block.lineHeight ?? 1.2
    return block.fontSize * lineHeight * lines * aspectRatio
  }
  return 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

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
