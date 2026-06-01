import { BrandSystemPanel } from './BrandSystemPanel'
import { FilePicker } from './FilePicker'
import { BASE_FORMAT_KEYS, RU_MARKETPLACE_FORMAT_KEYS, getFormat } from '../lib/formats'
import { formatGroupTitle, formatGroupUsageLabel, groupFormatsByResolution } from '../lib/formatPlacements'
import type { ReactNode } from 'react'
import type { DerivedBrandColors } from '../lib/paletteFromImage'
import type { BlockKind, BrandKit, CreationStep, FormatKey, ImageFitPreference, Project, Scene } from '../lib/types'

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
  paletteAlternatives?: DerivedBrandColors[]
  onApplyPaletteAlt?: (alt: DerivedBrandColors) => void
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
  paletteAlternatives,
  onApplyPaletteAlt,
  onTogglePaletteLock,
  onToggleFormat,
  onSetFormats,
  onExport,
}: Props) {
  const currentIndex = STEPS.findIndex((item) => item.id === step)
  const selectedElements = ELEMENTS.filter((item) => project.enabled[item.kind])
  const canGoNext = step !== 'formats' || project.selectedFormats.length > 0

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
              {item.label}
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
              keys={[...BASE_FORMAT_KEYS, ...RU_MARKETPLACE_FORMAT_KEYS]}
              selected={project.selectedFormats}
              onToggle={onToggleFormat}
              onSetFormats={onSetFormats}
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

function FormatGroup({
  title,
  keys,
  selected,
  customFormats,
  onToggle,
  onSetFormats,
}: {
  title: string
  keys: FormatKey[]
  selected: FormatKey[]
  customFormats?: Project['customFormats']
  onToggle: (key: FormatKey) => void
  onSetFormats: (keys: FormatKey[]) => void
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
              </span>
              <span className="format-row__dim">{group.width}×{group.height}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
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
