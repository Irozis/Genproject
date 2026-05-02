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
  { kind: 'title', label: 'Заголовок' },
  { kind: 'subtitle', label: 'Подзаголовок' },
  { kind: 'cta', label: 'Кнопка' },
  { kind: 'badge', label: 'Бейдж' },
  { kind: 'logo', label: 'Логотип' },
  { kind: 'image', label: 'Изображение' },
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
  const [tab, setTab] = useState<SidebarTab>('content')
  const [customName, setCustomName] = useState('')
  const [customWidth, setCustomWidth] = useState('300')
  const [customHeight, setCustomHeight] = useState('300')
  const [customSafe, setCustomSafe] = useState('8')
  const [customGutter, setCustomGutter] = useState('4')
  const selectedLabel = selectedKind ? labelForKind(selectedKind) : null
  const selectedFormatLabel = editingFormatKey ? getFormat(editingFormatKey, project.customFormats).label : null

  return (
    <aside className="sidebar">
      <SidebarTabs active={tab} onChange={setTab} />
      <div
        className="sidebar__scroll"
        role="tabpanel"
        id={`sidebar-panel-${tab}`}
        aria-labelledby={`sidebar-tab-${tab}`}
      >
        {tab === 'content' ? (
          <>
            <EditContextCard
              selectedLabel={selectedLabel}
              selectedFormatLabel={selectedFormatLabel}
              activeLocale={project.activeLocale}
            />
            <SectionHeader>Элементы</SectionHeader>
            <div className="el-list">
              {ELEMENT_ROWS.map((row) => (
                <ElementRow
                  key={row.kind}
                  kind={row.kind}
                  label={row.label}
                  enabled={project.enabled[row.kind]}
                  forceOpen={selectedKind === row.kind}
                  isSelected={selectedKind === row.kind}
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
            ) : null}
          </>
        ) : tab === 'formats' ? (
          <>
            <DensityPanel
              density={project.layoutDensity ?? 'balanced'}
              scopeLabel="Все форматы"
              onChange={(density) => onSetLayoutDensity(density, null)}
            />

            <SectionHeader>Форматы</SectionHeader>
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
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8, marginBottom: 4 }}>Маркетплейсы и баннеры</div>
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
                      aria-label={`Удалить ${f.label}`}
                      title={`Удалить ${f.label}`}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
            <details className="custom-format">
              <summary className="custom-format__toggle">+ Добавить свой формат</summary>
              <div className="custom-format__form">
                <input
                  type="text"
                  className="custom-format__name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Название"
                />
                <div className="custom-format__dims">
                  <input
                    type="number"
                    min={64}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="Ш"
                    aria-label="Ширина"
                  />
                  <span aria-hidden="true">×</span>
                  <input
                    type="number"
                    min={64}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="В"
                    aria-label="Высота"
                  />
                </div>
                <div className="custom-format__advanced">
                  <label className="custom-format__advanced-row">
                    <span>Безопасная зона</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={customSafe}
                      onChange={(e) => setCustomSafe(e.target.value)}
                      aria-label="Безопасная зона, %"
                    />
                    <small>%</small>
                  </label>
                  <label className="custom-format__advanced-row">
                    <span>Внутренний отступ</span>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      step={0.5}
                      value={customGutter}
                      onChange={(e) => setCustomGutter(e.target.value)}
                      aria-label="Внутренний отступ, %"
                    />
                    <small>%</small>
                  </label>
                  <p className="custom-format__hint">
                    Отступ от краёв и шаг между блоками. По умолчанию 8% и 4%
                    — подходит для большинства баннеров.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-xs custom-format__submit"
                  onClick={() => {
                    const width = Number(customWidth)
                    const height = Number(customHeight)
                    const safePct = clampNumber(Number(customSafe), 0, 20, 8)
                    const gutterPct = clampNumber(Number(customGutter), 0, 12, 4)
                    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
                    onAddCustomFormat({ name: customName || 'Свой формат', width, height, safePct, gutterPct })
                    setCustomName('')
                  }}
                >
                  Добавить формат
                </button>
              </div>
            </details>

          </>
        ) : tab === 'brand' ? (
          <>
            <SectionHeader>Локали</SectionHeader>
            <label className="field">
              <span>Доступные локали через запятую</span>
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
                placeholder="ru, en"
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
            <SectionHeader>Изображения</SectionHeader>
            <div className="asset-block">
              <div className="asset-block__label">Основное изображение</div>
              <FilePicker
                label={project.imageSrc ? 'Заменить' : 'Загрузить'}
                hint={project.imageSrc ? 'Загружено' : 'PNG / JPG'}
                onFile={(dataUrl) => onSetImage(dataUrl)}
              />
              {project.imageSrc ? (
                <>
                  <img className="asset-thumb" src={project.imageSrc} alt="" />
                  <div className="focal-label">Фокус master</div>
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
              <div className="asset-block__label">Логотип</div>
              <FilePicker
                label={project.logoSrc ? 'Заменить' : 'Загрузить'}
                hint={project.logoSrc ? 'Загружено' : 'SVG / PNG'}
                onFile={(dataUrl) => onSetLogo(dataUrl)}
              />
              {project.logoSrc ? (
                <img className="asset-thumb asset-thumb--logo" src={project.logoSrc} alt="" />
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="section-header">{children}</div>
}

function EditContextCard({
  selectedLabel,
  selectedFormatLabel,
  activeLocale,
}: {
  selectedLabel: string | null
  selectedFormatLabel: string | null
  activeLocale?: string
}) {
  return (
    <div className={`edit-context${selectedLabel ? ' is-active' : ''}`}>
      <div className="edit-context__eyebrow">
        {selectedLabel ? 'Редактируете' : 'Режим редактирования'}
      </div>
      <div className="edit-context__title">
        {selectedLabel ?? 'Выберите элемент на макете'}
      </div>
      <div className="edit-context__meta">
        {selectedFormatLabel
          ? `Только для формата: ${selectedFormatLabel}`
          : 'Изменения применяются ко всем форматам'}
      </div>
      {activeLocale ? <div className="edit-context__locale">Локаль: {activeLocale}</div> : null}
    </div>
  )
}

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
      <SectionHeader>Отдельная настройка</SectionHeader>
      <div className="override-panel">
        <div className="override-panel__head">
          <div>
            <div className="override-panel__title">{label}</div>
            <div className="override-panel__meta">Переопределено блоков: {kinds.length}</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onResetFormatCustom(formatKey)}
          >
            Сбросить все
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
                  Сбросить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="override-panel__empty">Все блоки наследуют master-настройки.</div>
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
      <SectionHeader>Плотность макета</SectionHeader>
      <div className="density-panel">
        <div className="density-panel__meta">{scopeLabel}</div>
        <div className="density-seg" role="group" aria-label="Плотность макета">
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

function clampNumber(value: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(lo, Math.min(hi, value))
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
      <SectionHeader>Отступы</SectionHeader>
      <div className="spacing-panel">
        {titleSubtitleGap !== null ? (
          <GapField
            label="Заголовок - подзаголовок"
            value={titleSubtitleGap}
            onChange={(next) => setGap(onPatchScene, 'title', 'subtitle', next, rules.aspectRatio, ['subtitle', 'cta'])}
          />
        ) : null}
        {subtitleCtaGap !== null ? (
          <GapField
            label="Подзаголовок - кнопка"
            value={subtitleCtaGap}
            onChange={(next) => setGap(onPatchScene, 'subtitle', 'cta', next, rules.aspectRatio, ['cta'])}
          />
        ) : null}
        {titleCtaGap !== null ? (
          <GapField
            label="Заголовок - кнопка"
            value={titleCtaGap}
            onChange={(next) => setGap(onPatchScene, 'title', 'cta', next, rules.aspectRatio, ['cta'])}
          />
        ) : null}
        {cta ? (
          <label className="field">
            <span>Высота кнопки - {(cta.h ?? 5).toFixed(1)}%</span>
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
      <span>{label}: {value.toFixed(1)}%</span>
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
  const activeCol = fx < 1 / 3 ? 0 : fx > 2 / 3 ? 2 : 1
  const activeRow = fy < 1 / 3 ? 0 : fy > 2 / 3 ? 2 : 1
  return (
    <div className="focal-grid" role="group" aria-label="Фокус изображения">
      {rows.map((ry, ri) =>
        cols.map((cx, ci) => {
          const isActive = ri === activeRow && ci === activeCol
          return (
            <button
              key={`${ri}-${ci}`}
              type="button"
              className={`focal-grid__cell${isActive ? ' is-on' : ''}`}
              onClick={() => onPick(cx, ry)}
              aria-label={`Фокус: ${ci === 0 ? 'слева' : ci === 1 ? 'по центру' : 'справа'} / ${ri === 0 ? 'сверху' : ri === 1 ? 'посередине' : 'снизу'}`}
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
        <span>Фокус по форматам</span>
        <span className="focal-perfmt__chev">{open ? '-' : '+'}</span>
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
                    title={override ? 'Сбросить к master' : 'Наследует master'}
                  >
                    {override ? 'Сбросить' : 'Наследует'}
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

export type _SidebarEnabledMap = EnabledMap
