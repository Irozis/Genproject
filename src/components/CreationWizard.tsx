import { BrandSystemPanel } from './BrandSystemPanel'
import { FilePicker } from './FilePicker'
import { AD_FORMAT_CATALOG, aspectRatioText } from '../data/adFormats'
import { BASE_FORMAT_KEYS, RU_MARKETPLACE_FORMAT_KEYS, getFormat } from '../lib/formats'
import { formatGroupTitle, formatGroupUsageLabel, groupFormatsByResolution } from '../lib/formatPlacements'
import { useMemo, useState, type ReactNode } from 'react'
import type { DerivedBrandColors } from '../lib/paletteFromImage'
import { buildScene } from '../lib/buildScene'
import { applyLayoutDensity } from '../lib/layoutDensity'
import {
  COMPOSITION_PRESETS,
  TYPOGRAPHY_PRESETS,
  generatePaletteVariants,
  layoutTypeFromProject,
  normalizeCompositionSettings,
  normalizeTypographySettings,
  validateStyleScene,
} from '../lib/styleSettings'
import type { BlockKind, BrandKit, CompositionSettings, CreationStep, FormatKey, ImageFitPreference, PaletteVariant, Project, Scene, TypographySettings } from '../lib/types'

type ExportKind = 'png' | 'svg' | 'pdf' | 'json'

type Props = {
  project: Project
  step: CreationStep
  onStepChange: (step: CreationStep) => void
  onFinish: () => void
  onPatchScene: (patch: (scene: Scene) => Scene) => void
  onToggleEnabled: (kind: BlockKind, next: boolean) => void
  onSetImage: (dataUrl: string) => void
  onClearImage: () => void
  onSetLogo: (dataUrl: string) => void
  onSetImageFitPreference: (next: ImageFitPreference) => void
  onBrandChange: (next: BrandKit) => void
  onApplyPaletteVariant: (variant: PaletteVariant) => void
  onRegeneratePaletteVariants: () => void
  onTogglePinnedPalette: (id: string) => void
  onResetToBrandPalette: () => void
  onTypographySettingsChange: (next: TypographySettings) => void
  onCompositionSettingsChange: (next: CompositionSettings) => void
  paletteAlternatives: DerivedBrandColors[]
  onApplyPaletteAlt: (alt: DerivedBrandColors) => void
  onTogglePaletteLock: (next: boolean) => void
  onToggleFormat: (key: FormatKey) => void
  onSetFormats: (keys: FormatKey[]) => void
  onExport: (kind: ExportKind) => void
}

const STEPS: { id: CreationStep; label: string }[] = [
  { id: 'image', label: 'Изображение' },
  { id: 'elements', label: 'Элементы' },
  { id: 'content', label: 'Тексты' },
  { id: 'colors', label: 'Цвета' },
  { id: 'formats', label: 'Форматы' },
  { id: 'preview', label: 'Просмотр' },
]

const ELEMENTS: { kind: BlockKind; label: string; description: string }[] = [
  { kind: 'title', label: 'Заголовок', description: 'главный текст макета' },
  { kind: 'subtitle', label: 'Описание', description: 'дополнительная информация' },
  { kind: 'cta', label: 'Кнопка', description: 'призыв к действию' },
  { kind: 'logo', label: 'Логотип', description: 'знак или инициалы' },
  { kind: 'badge', label: 'Бейдж', description: 'акция, статус или метка' },
  { kind: 'image', label: 'Изображение', description: 'основное фото или иллюстрация' },
]

const COLOR_PRESETS = [
  {
    name: 'Светлая',
    palette: { ink: '#0E1014', inkMuted: '#4E5155', surface: '#FFFFFF', accent: '#2563EB', accentSoft: '#DBEAFE' },
    gradient: ['#F8FAFC', '#E0F2FE', '#DBEAFE'] as [string, string, string],
  },
  {
    name: 'Контрастная',
    palette: { ink: '#0B1020', inkMuted: '#475569', surface: '#FFFFFF', accent: '#E11D48', accentSoft: '#FFE4E6' },
    gradient: ['#FFFFFF', '#FFE4E6', '#FECACA'] as [string, string, string],
  },
  {
    name: 'Теплая',
    palette: { ink: '#1F1308', inkMuted: '#6B4E35', surface: '#FFF7ED', accent: '#EA580C', accentSoft: '#FED7AA' },
    gradient: ['#FFF7ED', '#FFEDD5', '#FDBA74'] as [string, string, string],
  },
  {
    name: 'Холодная',
    palette: { ink: '#0F172A', inkMuted: '#475569', surface: '#F8FAFC', accent: '#0D9488', accentSoft: '#CCFBF1' },
    gradient: ['#F8FAFC', '#CCFBF1', '#BAE6FD'] as [string, string, string],
  },
  {
    name: 'Темная',
    palette: { ink: '#F8FAFC', inkMuted: '#CBD5E1', surface: '#111827', accent: '#F59E0B', accentSoft: '#78350F' },
    gradient: ['#111827', '#1F2937', '#0F172A'] as [string, string, string],
  },
]

export function CreationWizard({
  project,
  step,
  onStepChange,
  onFinish,
  onPatchScene,
  onToggleEnabled,
  onSetImage,
  onClearImage,
  onSetLogo,
  onSetImageFitPreference,
  onBrandChange,
  onApplyPaletteVariant,
  onRegeneratePaletteVariants,
  onTogglePinnedPalette,
  onResetToBrandPalette,
  onTypographySettingsChange,
  onCompositionSettingsChange,
  paletteAlternatives,
  onApplyPaletteAlt,
  onTogglePaletteLock,
  onToggleFormat,
  onSetFormats,
  onExport,
}: Props) {
  const [formatFilters, setFormatFilters] = useState<FormatFiltersState>(EMPTY_FORMAT_FILTERS)
  const currentIndex = STEPS.findIndex((item) => item.id === step)
  const selectedElements = ELEMENTS.filter((item) => project.enabled[item.kind])
  const canGoNext = step !== 'formats' || project.selectedFormats.length > 0
  const activeStyleFormat = project.activeFormatKey ?? project.selectedFormats[0] ?? 'vk-square'
  const typographySettings = normalizeTypographySettings(project.typographySettings, project.brandKit)
  const compositionSettings = normalizeCompositionSettings(project.compositionSettings)
  const paletteVariants = useMemo(
    () => generatePaletteVariants(project.brandKit, layoutTypeFromProject(project), {
      seed: project.paletteSeed ?? 1,
      assetHint: project.assetHint,
    }),
    [project],
  )
  const styleWarnings = useMemo(() => {
    if (!activeStyleFormat) return []
    const format = applyLayoutDensity(getFormat(activeStyleFormat, project.customFormats), project.formatDensities?.[activeStyleFormat] ?? project.layoutDensity)
    const scene = buildScene(project.master, activeStyleFormat, project.brandKit, project.enabled, {
      assetHint: project.assetHint,
      customFormats: project.customFormats,
      density: project.formatDensities?.[activeStyleFormat] ?? project.layoutDensity,
      typographySettings,
      compositionSettings,
    })
    return validateStyleScene(scene, format, project.brandKit)
  }, [activeStyleFormat, compositionSettings, project, typographySettings])
  const catalogFormatKeys = useMemo(
    () => filterFormatKeys([...BASE_FORMAT_KEYS, ...RU_MARKETPLACE_FORMAT_KEYS], formatFilters, project.customFormats),
    [formatFilters, project.customFormats],
  )

  return (
    <aside className="sidebar creation-wizard" aria-label="Создание проекта">
      <div className="sidebar__scroll">
        <div className="wizard-progress" aria-label="Шаги создания">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`wizard-progress__item${item.id === step ? ' is-active' : ''}${index < currentIndex ? ' is-done' : ''}`}
              onClick={() => onStepChange(item.id)}
            >
              <span>{index + 1}</span>
              {item.id === 'colors' ? 'Стиль макета' : item.label}
            </button>
          ))}
        </div>

        {step === 'image' ? (
          <WizardSection title="1. Изображение" note="Можно создать материалы только на основе текста, цветов и графических блоков.">
            <FilePicker
              label={project.imageSrc ? 'Заменить изображение' : 'Загрузить изображение'}
              hint={project.imageSrc ? 'Изображение добавлено' : 'PNG / JPG или перетащите файл сюда'}
              onFile={(dataUrl) => onSetImage(dataUrl)}
            />
            {project.imageSrc ? (
              <>
                <img className="asset-thumb" src={project.imageSrc} alt="" />
                <label className="field">
                  <span>Режим размещения</span>
                  <select
                    value={project.imageFitPreference ?? 'auto'}
                    onChange={(e) => onSetImageFitPreference(e.target.value as ImageFitPreference)}
                  >
                    <option value="auto">Авто</option>
                    <option value="cover">Заполнять область</option>
                    <option value="contain">Вместить целиком</option>
                  </select>
                </label>
              </>
            ) : null}
            <button className="btn btn-ghost" type="button" onClick={onClearImage}>
              Без изображения
            </button>
          </WizardSection>
        ) : null}

        {step === 'elements' ? (
          <WizardSection title="2. Элементы" note="Выберите, какие элементы будут использоваться. Тексты и файлы настроим на следующем шаге.">
            <div className="wizard-element-list">
              {ELEMENTS.map((item) => {
                const disabled = item.kind === 'image' && !project.imageSrc
                return (
                  <label key={item.kind} className={`wizard-element${project.enabled[item.kind] ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={project.enabled[item.kind] && !disabled}
                      disabled={disabled}
                      onChange={(e) => onToggleEnabled(item.kind, e.target.checked)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </WizardSection>
        ) : null}

        {step === 'content' ? (
          <WizardSection title="3. Настройка элементов" note="Заполните только выбранные элементы. Все это можно изменить позже в редакторе.">
            {selectedElements.length === 0 ? (
              <div className="sidebar-card">
                <div className="sidebar-card__title">Элементы не выбраны</div>
                <div className="sidebar-card__meta">Вернитесь на предыдущий шаг и включите хотя бы один элемент.</div>
              </div>
            ) : null}
            {project.enabled.title ? (
              <TextField
                label="Заголовок"
                value={getText(project.master, 'title')}
                placeholder="Введите основной заголовок"
                helper="Короткий заголовок лучше адаптируется под разные форматы."
                onChange={(value) => setText(onPatchScene, 'title', value)}
              />
            ) : null}
            {project.enabled.subtitle ? (
              <TextField
                label="Описание"
                value={getText(project.master, 'subtitle')}
                placeholder="Добавьте описание предложения"
                helper="Описание можно отключить для компактных форматов."
                multiline
                onChange={(value) => setText(onPatchScene, 'subtitle', value)}
              />
            ) : null}
            {project.enabled.cta ? (
              <TextField
                label="Кнопка"
                value={getText(project.master, 'cta')}
                placeholder="Текст кнопки"
                helper="Короткий текст кнопки лучше читается в маленьких форматах."
                onChange={(value) => setText(onPatchScene, 'cta', value)}
              />
            ) : null}
            {project.enabled.badge ? (
              <TextField
                label="Бейдж"
                value={getText(project.master, 'badge')}
                placeholder="Например: Новинка"
                helper="Используйте бейдж для акции, статуса или краткой метки."
                onChange={(value) => setText(onPatchScene, 'badge', value)}
              />
            ) : null}
            {project.enabled.logo ? (
              <div className="wizard-card">
                <strong>Логотип</strong>
                <FilePicker
                  label={project.logoSrc ? 'Заменить логотип' : 'Загрузить логотип'}
                  hint={project.logoSrc ? 'Логотип добавлен' : 'SVG / PNG или используйте инициалы из названия проекта'}
                  onFile={(dataUrl) => onSetLogo(dataUrl)}
                />
                {project.logoSrc ? <img className="asset-thumb asset-thumb--logo" src={project.logoSrc} alt="" /> : null}
                <small>Логотип можно заменить позже.</small>
              </div>
            ) : null}
            {project.enabled.image && project.imageSrc ? (
              <div className="wizard-card">
                <strong>Изображение</strong>
                <img className="asset-thumb" src={project.imageSrc} alt="" />
                <label className="field">
                  <span>Режим размещения</span>
                  <select
                    value={project.imageFitPreference ?? 'auto'}
                    onChange={(e) => onSetImageFitPreference(e.target.value as ImageFitPreference)}
                  >
                    <option value="auto">Авто</option>
                    <option value="cover">Заполнять область</option>
                    <option value="contain">Вместить целиком</option>
                  </select>
                </label>
              </div>
            ) : null}
          </WizardSection>
        ) : null}

        {step === 'colors' ? (
          <WizardSection title="4. Цвета, текст и композиция" note="Настройте визуальную систему: палитры вычисляются из бренда, изображения и типа макета, а типографика и расстояния сразу влияют на генерацию.">
            <StylePanel
              project={project}
              paletteVariants={paletteVariants}
              typographySettings={typographySettings}
              compositionSettings={compositionSettings}
              warnings={styleWarnings}
              onApplyPalette={onApplyPaletteVariant}
              onRegeneratePalettes={onRegeneratePaletteVariants}
              onTogglePinnedPalette={onTogglePinnedPalette}
              onResetToBrandPalette={onResetToBrandPalette}
              onTypographyChange={onTypographySettingsChange}
              onCompositionChange={onCompositionSettingsChange}
              onBrandChange={onBrandChange}
              paletteAlternatives={paletteAlternatives}
              onApplyPaletteAlt={onApplyPaletteAlt}
              onTogglePaletteLock={onTogglePaletteLock}
            />
          </WizardSection>
        ) : null}

        {false && step === 'colors' ? (
          <WizardSection title="4. Цветовая схема" note={project.imageSrc ? 'Можно принять палитру на основе изображения или настроить цвета вручную.' : 'Выберите один из нейтральных вариантов или настройте цвета вручную.'}>
            {paletteAlternatives && paletteAlternatives.length > 0 && onApplyPaletteAlt ? (
              <button className="btn btn-primary btn-xs" type="button" onClick={() => onApplyPaletteAlt(paletteAlternatives[0]!)}>
                Принять предложенную палитру
              </button>
            ) : null}
            <div className="wizard-preset-grid" aria-label="Простые цветовые схемы">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="wizard-preset"
                  onClick={() => onBrandChange({ ...project.brandKit, palette: preset.palette, gradient: preset.gradient })}
                >
                  <span className="wizard-preset__swatches">
                    <i style={{ background: preset.palette.ink }} />
                    <i style={{ background: preset.palette.accent }} />
                    <i style={{ background: preset.palette.surface }} />
                  </span>
                  {preset.name}
                </button>
              ))}
            </div>
            <BrandSystemPanel
              brandKit={project.brandKit}
              onChange={onBrandChange}
              alternatives={paletteAlternatives}
              onApplyAlternative={onApplyPaletteAlt}
              paletteLocked={project.paletteLocked}
              onTogglePaletteLock={onTogglePaletteLock}
            />
          </WizardSection>
        ) : null}

        {step === 'formats' ? (
          <WizardSection title="5. Форматы" note="Выберите площадки и размеры, которые нужно подготовить.">
            <FormatGroup
              title="Площадки и размеры"
              keys={catalogFormatKeys}
              selected={project.selectedFormats}
              onToggle={onToggleFormat}
              onSetFormats={onSetFormats}
              filters={formatFilters}
              onFiltersChange={setFormatFilters}
            />
            {(project.customFormats ?? []).length > 0 ? (
              <FormatGroup
                title="Свои форматы"
                keys={(project.customFormats ?? []).map((format) => format.key)}
                selected={project.selectedFormats}
                customFormats={project.customFormats}
                onToggle={onToggleFormat}
                onSetFormats={onSetFormats}
              />
            ) : null}
          </WizardSection>
        ) : null}

        {step === 'preview' ? (
          <WizardSection title="6. Просмотр материалов" note="Проверьте карточки форматов в области предпросмотра. Отдельные форматы можно доработать вручную.">
            <div className="wizard-summary">
              <div><strong>{project.selectedFormats.length}</strong><span>размещений выбрано</span></div>
              <div><strong>{selectedElements.length}</strong><span>элементов включено</span></div>
              <div><strong>{project.imageSrc ? 'Да' : 'Нет'}</strong><span>изображение</span></div>
            </div>
            <button className="btn btn-primary" type="button" onClick={onFinish}>
              Перейти к редактированию
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => onExport('png')}>
              Экспортировать PNG ZIP
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => onExport('json')}>
              Сохранить JSON проекта
            </button>
          </WizardSection>
        ) : null}

        <div className="wizard-nav">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onStepChange(STEPS[Math.max(0, currentIndex - 1)]!.id)}
          >
            Назад
          </button>
          {step === 'preview' ? (
            <button className="btn btn-primary" type="button" onClick={onFinish}>
              Завершить
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={!canGoNext}
              onClick={() => onStepChange(STEPS[Math.min(STEPS.length - 1, currentIndex + 1)]!.id)}
            >
              Далее
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function WizardSection({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="wizard-section">
      <h2>{title}</h2>
      <p>{note}</p>
      <div className="wizard-section__body">{children}</div>
    </section>
  )
}

function TextField({
  label,
  value,
  placeholder,
  helper,
  multiline,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  helper: string
  multiline?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="field wizard-card">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      <small>{helper}</small>
    </label>
  )
}

function StylePanel({
  project,
  paletteVariants,
  typographySettings,
  compositionSettings,
  warnings,
  onApplyPalette,
  onRegeneratePalettes,
  onTogglePinnedPalette,
  onResetToBrandPalette,
  onTypographyChange,
  onCompositionChange,
  onBrandChange,
  paletteAlternatives,
  onApplyPaletteAlt,
  onTogglePaletteLock,
}: {
  project: Project
  paletteVariants: PaletteVariant[]
  typographySettings: TypographySettings
  compositionSettings: CompositionSettings
  warnings: ReturnType<typeof validateStyleScene>
  onApplyPalette: (variant: PaletteVariant) => void
  onRegeneratePalettes: () => void
  onTogglePinnedPalette: (id: string) => void
  onResetToBrandPalette: () => void
  onTypographyChange: (next: TypographySettings) => void
  onCompositionChange: (next: CompositionSettings) => void
  onBrandChange: (next: BrandKit) => void
  paletteAlternatives?: DerivedBrandColors[]
  onApplyPaletteAlt?: (alt: DerivedBrandColors) => void
  onTogglePaletteLock: (next: boolean) => void
}) {
  const pinned = new Set(project.pinnedPaletteIds ?? [])
  const typePatch = (patch: Partial<TypographySettings>) => onTypographyChange({ ...typographySettings, ...patch })
  const compPatch = (patch: Partial<CompositionSettings>) => onCompositionChange({ ...compositionSettings, ...patch })

  return (
    <div className="style-panel">
      <section className="style-group">
        <div className="style-group__head">
          <strong>Палитры</strong>
          <button className="btn btn-ghost btn-xs" type="button" onClick={onRegeneratePalettes}>Сгенерировать ещё</button>
        </div>
        <div className="style-preset-row">
          {(['Auto', 'Brand', 'Contrast', 'Dark', 'Light', 'Accent'] as const).map((name) => (
            <button
              key={name}
              className="btn btn-ghost btn-xs"
              type="button"
              onClick={() => {
                const id = name === 'Brand' ? 'brand-core' : name === 'Contrast' ? 'high-contrast' : name === 'Dark' ? 'premium-dark' : name === 'Light' ? 'soft-calm' : name === 'Accent' ? 'mono-accent' : 'fresh-bright'
                const variant = paletteVariants.find((item) => item.id === id) ?? paletteVariants[0]
                if (variant) onApplyPalette(variant)
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="style-palette-list">
          {paletteVariants.map((variant) => (
            <button
              key={variant.id}
              className={`style-palette-card${project.selectedPaletteId === variant.id ? ' is-on' : ''}`}
              type="button"
              onClick={() => onApplyPalette(variant)}
            >
              <span className="style-palette-card__preview" style={{ background: variant.background, color: variant.primaryText, borderColor: variant.border }}>
                <b style={{ color: variant.primaryText }}>Sale headline</b>
                <small style={{ color: variant.secondaryText }}>Описание предложения</small>
                <i style={{ background: variant.accent }} />
                <em style={{ background: variant.ctaBackground, color: variant.ctaText }}>CTA</em>
              </span>
              <span className="style-palette-card__meta">
                <strong>{variant.name}</strong>
                <small>{variant.description}</small>
                <small>Контраст {variant.contrastScore.toFixed(1)}</small>
              </span>
              <span
                className={`style-pin${pinned.has(variant.id) ? ' is-on' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onTogglePinnedPalette(variant.id)
                }}
              >
                {pinned.has(variant.id) ? 'Закреплена' : 'Закрепить'}
              </span>
            </button>
          ))}
        </div>
        <div className="style-actions">
          <button className="btn btn-ghost btn-xs" type="button" onClick={onResetToBrandPalette}>Вернуться к цветам бренда</button>
          {paletteAlternatives && paletteAlternatives.length > 0 && onApplyPaletteAlt ? (
            <button className="btn btn-ghost btn-xs" type="button" onClick={() => onApplyPaletteAlt(paletteAlternatives[0]!)}>Из изображения</button>
          ) : null}
        </div>
        <BrandSystemPanel
          brandKit={project.brandKit}
          onChange={onBrandChange}
          alternatives={paletteAlternatives}
          onApplyAlternative={onApplyPaletteAlt}
          paletteLocked={project.paletteLocked}
          onTogglePaletteLock={onTogglePaletteLock}
        />
      </section>

      <section className="style-group">
        <div className="style-group__head"><strong>Текст</strong></div>
        <div className="style-preset-row">
          {Object.keys(TYPOGRAPHY_PRESETS).map((name) => (
            <button key={name} className="btn btn-ghost btn-xs" type="button" onClick={() => typePatch(TYPOGRAPHY_PRESETS[name]!)}>{name}</button>
          ))}
        </div>
        <label className="field"><span>Шрифт заголовка</span><input value={typographySettings.headingFontFamily} onChange={(e) => typePatch({ headingFontFamily: e.target.value })} /></label>
        <label className="field"><span>Шрифт текста</span><input value={typographySettings.bodyFontFamily} onChange={(e) => typePatch({ bodyFontFamily: e.target.value })} /></label>
        <label className="field"><span>Шрифт CTA</span><input value={typographySettings.ctaFontFamily} onChange={(e) => typePatch({ ctaFontFamily: e.target.value })} /></label>
        <Range label="Размер заголовка" min={0.65} max={1.45} step={0.01} value={typographySettings.headingSizeScale} onChange={(v) => typePatch({ headingSizeScale: v })} />
        <Range label="Размер описания" min={0.7} max={1.3} step={0.01} value={typographySettings.bodySizeScale} onChange={(v) => typePatch({ bodySizeScale: v })} />
        <Range label="Размер CTA" min={0.7} max={1.35} step={0.01} value={typographySettings.ctaSizeScale} onChange={(v) => typePatch({ ctaSizeScale: v })} />
        <div className="style-grid-2">
          <Select label="Начертание заголовка" value={String(typographySettings.headingWeight)} values={['400', '500', '600', '700', '800', '900']} onChange={(v) => typePatch({ headingWeight: Number(v) })} />
          <Select label="Начертание текста" value={String(typographySettings.bodyWeight)} values={['400', '500', '600', '700']} onChange={(v) => typePatch({ bodyWeight: Number(v) })} />
          <Select label="Начертание CTA" value={String(typographySettings.ctaWeight)} values={['400', '500', '600', '700', '800']} onChange={(v) => typePatch({ ctaWeight: Number(v) })} />
          <Select label="Регистр" value={typographySettings.textTransform} values={['none', 'uppercase', 'lowercase', 'title-case']} onChange={(v) => typePatch({ textTransform: v as TypographySettings['textTransform'] })} />
          <Select label="Выравнивание" value={typographySettings.textAlign} values={['left', 'center', 'right']} onChange={(v) => typePatch({ textAlign: v as TypographySettings['textAlign'] })} />
          <Select label="Перенос" value={typographySettings.textWrap} values={['auto', 'manual', 'no-wrap']} onChange={(v) => typePatch({ textWrap: v as TypographySettings['textWrap'] })} />
          <Select label="Плотность текста" value={typographySettings.textDensity} values={['compact', 'normal', 'spacious']} onChange={(v) => typePatch({ textDensity: v as TypographySettings['textDensity'] })} />
        </div>
        <Range label="Межбуквенный интервал" min={-0.05} max={0.08} step={0.005} value={typographySettings.letterSpacing} onChange={(v) => typePatch({ letterSpacing: v })} />
        <Range label="Межстрочный интервал" min={0.95} max={1.45} step={0.01} value={typographySettings.lineHeight} onChange={(v) => typePatch({ lineHeight: v })} />
        <Range label="Макс. ширина текста" min={0.55} max={1.08} step={0.01} value={typographySettings.maxTextWidthRatio} onChange={(v) => typePatch({ maxTextWidthRatio: v })} />
      </section>

      <section className="style-group">
        <div className="style-group__head"><strong>Расположение</strong></div>
        <div className="style-preset-row">
          {Object.keys(COMPOSITION_PRESETS).map((name) => (
            <button key={name} className="btn btn-ghost btn-xs" type="button" onClick={() => compPatch(COMPOSITION_PRESETS[name]!)}>{name}</button>
          ))}
        </div>
        <div className="style-grid-2">
          <Select label="Плотность" value={compositionSettings.density} values={['compact', 'balanced', 'airy']} onChange={(v) => compPatch({ density: v as CompositionSettings['density'] })} />
          <Select label="Группа" value={compositionSettings.mainAxisAlign} values={['left', 'center', 'right']} onChange={(v) => compPatch({ mainAxisAlign: v as CompositionSettings['mainAxisAlign'] })} />
          <Select label="Вертикаль" value={compositionSettings.verticalPosition} values={['top', 'center', 'bottom']} onChange={(v) => compPatch({ verticalPosition: v as CompositionSettings['verticalPosition'] })} />
        </div>
        <Range label="Внутренние поля" min={0.7} max={1.35} step={0.01} value={compositionSettings.canvasPaddingScale} onChange={(v) => compPatch({ canvasPaddingScale: v })} />
        <Range label="Общие расстояния" min={0.55} max={1.6} step={0.01} value={compositionSettings.groupGapScale} onChange={(v) => compPatch({ groupGapScale: v })} />
        <Range label="Лого → заголовок" min={0.4} max={1.8} step={0.01} value={compositionSettings.logoTitleGap} onChange={(v) => compPatch({ logoTitleGap: v })} />
        <Range label="Заголовок → описание" min={0.4} max={1.8} step={0.01} value={compositionSettings.titleBodyGap} onChange={(v) => compPatch({ titleBodyGap: v })} />
        <Range label="Описание → CTA" min={0.4} max={1.8} step={0.01} value={compositionSettings.bodyCtaGap} onChange={(v) => compPatch({ bodyCtaGap: v })} />
        <Range label="CTA → изображение" min={0.4} max={1.8} step={0.01} value={compositionSettings.imageTextGap} onChange={(v) => compPatch({ imageTextGap: v })} />
        <Range label="Интервал объектов" min={0.45} max={1.8} step={0.01} value={compositionSettings.objectGap} onChange={(v) => compPatch({ objectGap: v })} />
        <Range label="Декоративные объекты" min={0} max={1.4} step={0.01} value={compositionSettings.decorativeIntensity} onChange={(v) => compPatch({ decorativeIntensity: v })} />
        <Range label="Hero image" min={0.65} max={1.45} step={0.01} value={compositionSettings.heroImageScale} onChange={(v) => compPatch({ heroImageScale: v })} />
        <Range label="Логотип" min={0.65} max={1.35} step={0.01} value={compositionSettings.logoScale} onChange={(v) => compPatch({ logoScale: v })} />
        <Range label="Скругления" min={0} max={1.8} step={0.01} value={compositionSettings.cornerRadiusScale} onChange={(v) => compPatch({ cornerRadiusScale: v })} />
        <Range label="Толщина рамки" min={0} max={8} step={1} value={compositionSettings.borderWidth} onChange={(v) => compPatch({ borderWidth: v })} />
      </section>

      {warnings.length > 0 ? (
        <section className="style-group style-warnings">
          <strong>Предупреждения</strong>
          {warnings.map((warning) => <div key={warning.id} className={`style-warning style-warning--${warning.severity}`}>{warning.message}</div>)}
        </section>
      ) : null}
    </div>
  )
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field style-range">
      <span>{label}<b>{value.toFixed(step >= 1 ? 0 : 2)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  )
}

function FormatGroup({
  title,
  keys,
  selected,
  customFormats,
  onToggle,
  onSetFormats,
  filters,
  onFiltersChange,
}: {
  title: string
  keys: FormatKey[]
  selected: FormatKey[]
  customFormats?: Project['customFormats']
  onToggle: (key: FormatKey) => void
  onSetFormats: (keys: FormatKey[]) => void
  filters?: FormatFiltersState
  onFiltersChange?: (next: FormatFiltersState) => void
}) {
  const allSelected = keys.every((key) => selected.includes(key))
  const groups = customFormats
    ? keys.map((key) => {
        const format = getFormat(key, customFormats)
        return { key, previewKey: key, formatKeys: [key], label: format.label, width: format.width, height: format.height }
      })
    : groupFormatsByResolution(keys)

  return (
    <section className="wizard-format-group">
      <div className="wizard-format-group__head">
        <strong>{title}</strong>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => {
            const set = new Set(selected)
            if (allSelected) {
              keys.forEach((key) => set.delete(key))
            } else {
              keys.forEach((key) => set.add(key))
            }
            onSetFormats([...set])
          }}
        >
          {allSelected ? 'Снять все' : 'Выбрать все'}
        </button>
      </div>
      {filters && onFiltersChange ? (
        <FormatFilters filters={filters} onChange={onFiltersChange} />
      ) : null}
      <div className="format-list">
        {groups.map((group) => {
          const enabled = group.formatKeys.every((key) => selected.includes(key))
          const partiallyEnabled = !enabled && group.formatKeys.some((key) => selected.includes(key))
          return (
            <label key={group.key} className={`format-row format-row--group${enabled ? ' is-on' : ''}${partiallyEnabled ? ' is-partial' : ''}`}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => {
                  if (group.formatKeys.length === 1) {
                    onToggle(group.formatKeys[0]!)
                    return
                  }
                  const set = new Set(selected)
                  if (enabled || partiallyEnabled) group.formatKeys.forEach((key) => set.delete(key))
                  else group.formatKeys.forEach((key) => set.add(key))
                  onSetFormats([...set])
                }}
              />
              <span className="format-row__label">
                {customFormats ? group.label : formatGroupTitle(group)}
                <small>{customFormats ? group.label : formatGroupUsageLabel(group)}</small>
                {!customFormats ? <FormatRowMeta format={getFormat(group.previewKey)} /> : null}
              </span>
              <span className="format-row__dim">{group.width}×{group.height}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

type FormatFiltersState = {
  platformId: string
  placementGroup: string
  device: string
  aspectRatio: string
  goal: string
  staticOnly: boolean
  supportsHtml5: boolean
  requiresSafeZone: boolean
}

const EMPTY_FORMAT_FILTERS: FormatFiltersState = {
  platformId: '',
  placementGroup: '',
  device: '',
  aspectRatio: '',
  goal: '',
  staticOnly: false,
  supportsHtml5: false,
  requiresSafeZone: false,
}

function FormatFilters({
  filters,
  onChange,
}: {
  filters: FormatFiltersState
  onChange: (next: FormatFiltersState) => void
}) {
  const catalog = AD_FORMAT_CATALOG
  return (
    <div className="format-filters">
      <SelectFilter label="Площадка" value={filters.platformId} values={unique(catalog.map((f) => f.platformId))} labelFor={(v) => catalog.find((f) => f.platformId === v)?.platformName ?? v} onChange={(platformId) => onChange({ ...filters, platformId })} />
      <SelectFilter label="Тип размещения" value={filters.placementGroup} values={unique(catalog.map((f) => f.placementGroup))} onChange={(placementGroup) => onChange({ ...filters, placementGroup })} />
      <SelectFilter label="Устройство" value={filters.device} values={unique(catalog.map((f) => f.device))} onChange={(device) => onChange({ ...filters, device })} />
      <SelectFilter label="Соотношение" value={filters.aspectRatio} values={unique(catalog.map((f) => aspectRatioText(f)))} onChange={(aspectRatio) => onChange({ ...filters, aspectRatio })} />
      <SelectFilter label="Цель" value={filters.goal} values={unique(catalog.map((f) => f.goal))} onChange={(goal) => onChange({ ...filters, goal })} />
      <div className="format-filters__checks">
        <label><input type="checkbox" checked={filters.staticOnly} onChange={(e) => onChange({ ...filters, staticOnly: e.target.checked })} /> только статичные</label>
        <label><input type="checkbox" checked={filters.supportsHtml5} onChange={(e) => onChange({ ...filters, supportsHtml5: e.target.checked })} /> HTML5</label>
        <label><input type="checkbox" checked={filters.requiresSafeZone} onChange={(e) => onChange({ ...filters, requiresSafeZone: e.target.checked })} /> safe zone</label>
      </div>
    </div>
  )
}

function SelectFilter({
  label,
  value,
  values,
  labelFor,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  labelFor?: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Все</option>
        {values.map((item) => (
          <option key={item} value={item}>{labelFor ? labelFor(item) : item}</option>
        ))}
      </select>
    </label>
  )
}

function FormatRowMeta({ format }: { format: ReturnType<typeof getFormat> }) {
  const fileTypes = format.allowedFileTypes?.join(', ').toUpperCase() || 'PNG/JPG'
  const parts = [
    format.platformName,
    aspectRatioText(format),
    `${fileTypes}${format.maxFileSizeKb ? ` <= ${format.maxFileSizeKb} KB` : ''}`,
    format.safeArea && (format.safeArea.top || format.safeArea.right || format.safeArea.bottom || format.safeArea.left) ? 'safe zone' : '',
    format.visibleArea ? 'visible area' : '',
    (format.overlayZones?.length ?? 0) > 0 ? 'маркировка' : '',
  ].filter(Boolean)
  return (
    <span className="format-row__meta">
      {parts.map((part) => <span key={part} className="format-row__chip">{part}</span>)}
    </span>
  )
}

function filterFormatKeys(keys: FormatKey[], filters: FormatFiltersState, customFormats?: Project['customFormats']): FormatKey[] {
  return keys.filter((key) => {
    const format = getFormat(key, customFormats)
    if (filters.platformId && format.platformId !== filters.platformId) return false
    if (filters.placementGroup && format.placementGroup !== filters.placementGroup) return false
    if (filters.device && format.device !== filters.device) return false
    if (filters.aspectRatio && aspectRatioText(format) !== filters.aspectRatio) return false
    if (filters.goal && format.goal !== filters.goal) return false
    if (filters.staticOnly && format.animationAllowed) return false
    if (filters.supportsHtml5 && !format.supportsHtml5) return false
    if (filters.requiresSafeZone && !hasSafeArea(format)) return false
    return true
  })
}

function hasSafeArea(format: ReturnType<typeof getFormat>): boolean {
  const safe = format.safeArea
  return !!safe && (safe.top > 0 || safe.right > 0 || safe.bottom > 0 || safe.left > 0)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function getText(scene: Scene, kind: 'title' | 'subtitle' | 'cta' | 'badge') {
  return scene[kind]?.text ?? ''
}

function setText(
  onPatchScene: (patch: (scene: Scene) => Scene) => void,
  kind: 'title' | 'subtitle' | 'cta' | 'badge',
  value: string,
) {
  onPatchScene((scene) => {
    const block = scene[kind]
    if (!block) return scene
    return { ...scene, [kind]: { ...block, text: value } }
  })
}
