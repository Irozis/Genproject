import { useEffect, useRef, useState } from 'react'

export type ExportFormat = 'png' | 'pdf' | 'svg' | 'json'

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
  /** Timestamp (Date.now()) of the most recent successful autosave. null
   *  when the project hasn't been saved yet this session. Drives the
   *  "Saved Xs ago" indicator. */
  lastSavedAt: number | null
  /** True while a save is in flight (debounce pending) — shows "Saving…". */
  isSaving: boolean
  activeLocale?: string
  availableLocales?: string[]
  onSetLocale?: (locale: string | undefined) => void
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
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="editor-header">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
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
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          ↶
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          ↷
        </button>
        <SaveStatus lastSavedAt={lastSavedAt} isSaving={isSaving} />
        {availableLocales && availableLocales.length >= 2 ? (
          <select
            className="btn btn-ghost btn-sm"
            value={activeLocale ?? ''}
            onChange={(e) => onSetLocale?.(e.target.value || undefined)}
            title="Active locale"
          >
            <option value="">default</option>
            {availableLocales.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        ) : null}
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          Import .json
        </button>
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
      <div className="export-group">
        <button
          className="btn btn-sm"
          onClick={() => onExport('png')}
          disabled={exporting !== null}
        >
          {exporting === 'png' ? '…' : 'PNG zip'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => onExport('svg')}
          disabled={exporting !== null}
        >
          {exporting === 'svg' ? '…' : 'SVG zip'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => onExport('pdf')}
          disabled={exporting !== null}
        >
          {exporting === 'pdf' ? '…' : 'PDF'}
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onExport('json')}
          disabled={exporting !== null}
        >
          {exporting === 'json' ? '…' : 'JSON'}
        </button>
      </div>
    </header>
  )
}

// Autosave indicator. Re-renders once every 10 s via a tick state so the
// "Saved Xs ago" label stays honest without a useEffect on every keystroke.
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
    return <span className="save-status save-status--pending">Saving…</span>
  }
  if (lastSavedAt === null) {
    return <span className="save-status save-status--muted">Not saved</span>
  }
  return (
    <span className="save-status" title={new Date(lastSavedAt).toLocaleString()}>
      Saved {formatAgo(Date.now() - lastSavedAt)}
    </span>
  )
}

function formatAgo(ms: number): string {
  if (ms < 5_000) return 'just now'
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  return `${Math.floor(ms / 3_600_000)}h ago`
}
