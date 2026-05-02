import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export type ExportFormat = 'png' | 'pdf' | 'svg' | 'json'
export type ThemeMode = 'light' | 'dark' | 'system'

type Props = {
  projectName: string
  onRename: (next: string) => void
  onBack: () => void
  onExport: (kind: ExportFormat) => void
  onImportJson: (file: File) => void
  exporting: ExportFormat | null
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  lastSavedAt: number | null
  isSaving: boolean
  activeLocale?: string
  availableLocales?: string[]
  onSetLocale?: (locale: string | undefined) => void
  theme?: ThemeMode
  onSetTheme?: (mode: ThemeMode) => void
}

export function EditorHeader({
  projectName,
  onRename,
  onBack,
  onExport,
  onImportJson,
  exporting,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  lastSavedAt,
  isSaving,
  activeLocale,
  availableLocales,
  onSetLocale,
  theme,
  onSetTheme,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="editor-header">
      <button className="btn btn-ghost btn-sm btn-with-icon" onClick={onBack}>
        <Icon name="arrow-left" />
        <span>Назад</span>
      </button>
      <input
        className="editor-header__name"
        value={projectName}
        onChange={(e) => onRename(e.target.value)}
        spellCheck={false}
      />
      <div className="editor-header__chips">
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Отменить (Ctrl+Z)"
          aria-label="Отменить"
        >
          <Icon name="undo" />
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Повторить (Ctrl+Shift+Z)"
          aria-label="Повторить"
        >
          <Icon name="redo" />
        </button>
        <SaveStatus lastSavedAt={lastSavedAt} isSaving={isSaving} />
        {availableLocales && availableLocales.length >= 2 ? (
          <select
            className="btn btn-ghost btn-sm"
            value={activeLocale ?? ''}
            onChange={(e) => onSetLocale?.(e.target.value || undefined)}
            title="Активная локаль"
          >
            <option value="">по умолчанию</option>
            {availableLocales.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        ) : null}
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          Импорт .json
        </button>
        {theme !== undefined && onSetTheme ? (
          <ThemeToggle theme={theme} onChange={onSetTheme} />
        ) : null}
        <ShortcutsHint />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportJson(f)
            e.target.value = ''
          }}
        />
      </div>
      <details className="export-menu">
        <summary
          className="btn btn-primary btn-sm export-menu__trigger"
          aria-label="Экспортировать проект"
        >
          {exporting ? 'Экспорт...' : 'Экспорт'} <span aria-hidden="true">▾</span>
        </summary>
        <div className="export-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={() => onExport('png')} disabled={exporting !== null}>
            <strong>PNG ZIP</strong>
            <span>Готовые изображения для публикации</span>
          </button>
          <button type="button" role="menuitem" onClick={() => onExport('pdf')} disabled={exporting !== null}>
            <strong>PDF</strong>
            <span>Презентация или согласование</span>
          </button>
          <button type="button" role="menuitem" onClick={() => onExport('svg')} disabled={exporting !== null}>
            <strong>SVG ZIP</strong>
            <span>Векторные исходники</span>
          </button>
          <button type="button" role="menuitem" onClick={() => onExport('json')} disabled={exporting !== null}>
            <strong>JSON проект</strong>
            <span>Сохранить для дальнейшей работы</span>
          </button>
        </div>
      </details>
    </header>
  )
}

// Three-state theme picker: light / dark / follow system. Cycles on click,
// persists via App-level state. Pure UI — colors come from CSS tokens that
// react to data-theme.
function ThemeToggle({ theme, onChange }: { theme: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  const next: ThemeMode = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  const label = theme === 'system' ? 'Системная тема' : theme === 'light' ? 'Светлая тема' : 'Тёмная тема'
  const glyph = theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs btn-icon"
      title={`${label}. Клик — переключить.`}
      aria-label={`${label}. Клик — переключить тему.`}
      onClick={() => onChange(next)}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )
}

// Tiny help-popover that surfaces the shortcuts already wired up in App.tsx
// (undo, pan, zoom, element toggles). Keeps them discoverable without
// requiring the user to read any title-tooltips.
function ShortcutsHint() {
  return (
    <details className="kebab shortcuts-hint">
      <summary
        className="btn btn-ghost btn-xs btn-icon"
        aria-label="Показать горячие клавиши"
        title="Горячие клавиши"
      >
        ?
      </summary>
      <div className="kebab__menu shortcuts-hint__menu" role="menu" aria-label="Горячие клавиши">
        <div className="shortcuts-hint__title">Горячие клавиши</div>
        <ul className="shortcuts-hint__list">
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> · Отменить</li>
          <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> · Повторить</li>
          <li><kbd>Space</kbd> + перетаскивание · Панорама</li>
          <li><kbd>Ctrl</kbd> + колесо · Зум</li>
          <li><kbd>Shift</kbd> + клик по фото · Точка фокуса</li>
          <li>Двойной клик по тексту · Редактирование</li>
          <li><kbd>T</kbd>/<kbd>S</kbd>/<kbd>C</kbd>/<kbd>B</kbd>/<kbd>L</kbd>/<kbd>I</kbd> · Включить/выключить блок</li>
        </ul>
      </div>
    </details>
  )
}

function SaveStatus({
  lastSavedAt,
  isSaving,
}: {
  lastSavedAt: number | null
  isSaving: boolean
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 10_000)
    return () => window.clearInterval(id)
  }, [])

  if (isSaving) {
    return <span className="save-status save-status--pending">Сохраняем...</span>
  }
  if (lastSavedAt === null) {
    return <span className="save-status save-status--muted">Еще не сохранено</span>
  }
  return (
    <span className="save-status" title={new Date(lastSavedAt).toLocaleString()}>
      Сохранено {formatAgo(Date.now() - lastSavedAt)}
    </span>
  )
}

function formatAgo(ms: number): string {
  if (ms < 5_000) return 'только что'
  if (ms < 60_000) return `${Math.floor(ms / 1000)} с назад`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} мин назад`
  return `${Math.floor(ms / 3_600_000)} ч назад`
}
