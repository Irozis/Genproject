import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Onboarding } from './components/Onboarding'
import { EditorHeader, type ExportFormat } from './components/EditorHeader'
import { Sidebar } from './components/Sidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TemplatePicker } from './components/TemplatePicker'
import { FormatGrid, type FormatGridHandle } from './components/FormatGrid'
import { newProject } from './lib/defaults'
import { loadProject, saveProject } from './lib/storage'
import { exportZip, exportPdf } from './lib/export'
import { exportSvgZip } from './lib/exportSvg'
import { exportJson, importJson } from './lib/serialize'
import { analyzeImage } from './lib/imageAnalysis'
import { paletteAlternatives, type DerivedBrandColors } from './lib/paletteFromImage'
import { buildScene } from './lib/buildScene'
import { fixLayout } from './lib/fixLayout'
import { getFormat } from './lib/formats'
import { applyLayoutDensity } from './lib/layoutDensity'
import { useHistory } from './lib/useHistory'
import { applyImageHint } from './lib/applyImageHint'
import { applySnapshot, deleteSnapshot, listSnapshots, saveSnapshot } from './lib/brandSnapshots'
import type { Template } from './lib/templates'
import type {
  BlockOverride,
  BlockKind,
  BrandKit,
  BrandSnapshot,
  FormatKey,
  FormatRuleSet,
  LayoutDensity,
  OnboardingMode,
  Project,
  Scene,
  View,
} from './lib/types'

export default function App() {
  const [view, setView] = useState<View>('onboarding')
  const [project, setProject, history] = useHistory<Project>(
    () => loadProject() ?? newProject(),
    350,
  )
  const [selectedKind, setSelectedKind] = useState<BlockKind | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<FormatKey | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [layoutClipboard, setLayoutClipboard] = useState<Partial<Record<BlockKind, BlockOverride>> | null>(null)
  const [snapshots, setSnapshots] = useState<BrandSnapshot[]>(() => listSnapshots())
  const gridRef = useRef<FormatGridHandle>(null)
  // Monotonic counter for image-analysis results. The user may replace the image
  // before the previous analysis resolves — we drop any hint that isn't from the
  // most recent upload so a stale palette can't clobber the current one.
  const imageGenRef = useRef(0)

  // hydrate view if a saved project exists
  useEffect(() => {
    const saved = loadProject()
    if (saved) setView('editor')
  }, [])

  // Debounced persist. The "isSaving" flag flips true on every change and
  // flips back false once the debounced write lands — this is what drives the
  // "Saving…" → "Saved 3s ago" transition in the header.
  useEffect(() => {
    setIsSaving(true)
    const t = window.setTimeout(() => {
      saveProject(project)
      setLastSavedAt(Date.now())
      setIsSaving(false)
    }, 300)
    return () => window.clearTimeout(t)
  }, [project])

  // auto-clear error toast
  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(null), 4000)
    return () => window.clearTimeout(t)
  }, [error])

  // Ctrl+Z / Cmd+Z = undo, Ctrl+Shift+Z / Cmd+Shift+Z = redo.
  // Plain T/S/C/B/L/I (no modifier) = toggle enabled for title/subtitle/cta/
  // badge/logo/image. All skip when focus is in a form field so native input
  // behavior + browser undo keep working there.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod) {
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          history.undo()
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault()
          history.redo()
        }
        return
      }
      // Unmodified letter shortcuts. Ignore when Alt/Shift held (those are
      // reserved for future chords) and when the user is mid-typing somewhere
      // outside a field (e.g. dragging a contenteditable).
      if (e.altKey || e.shiftKey) return
      const kindByKey: Record<string, BlockKind> = {
        t: 'title',
        s: 'subtitle',
        c: 'cta',
        b: 'badge',
        l: 'logo',
        i: 'image',
      }
      const kind = kindByKey[k]
      if (kind) {
        e.preventDefault()
        setProject((p) => ({ ...p, enabled: { ...p.enabled, [kind]: !p.enabled[kind] } }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, setProject])

  // sync image/logo into master scene
  const masterWithAssets = useMemo<Scene>(() => {
    const m = project.master
    return {
      ...m,
      image: m.image ? { ...m.image, src: project.imageSrc } : m.image,
      logo: m.logo ? { ...m.logo, src: project.logoSrc } : m.logo,
    }
  }, [project.master, project.imageSrc, project.logoSrc])

  const selectedFormatScene = useMemo<Scene | null>(() => {
    if (!selectedFormat || !project.blockOverrides?.[selectedFormat]) return null
    return buildSceneForProject(project, selectedFormat)
  }, [project, selectedFormat])

  const sidebarProject = useMemo<Project>(() => (
    selectedFormatScene ? { ...project, master: selectedFormatScene } : { ...project, master: masterWithAssets }
  ), [project, masterWithAssets, selectedFormatScene])

  const patchScene = useCallback((patch: (s: Scene) => Scene) => {
    setProject((p) => {
      const nextMaster = patch(p.master)
      return { ...p, master: nextMaster }
    })
  }, [setProject])

  const patchEditableScene = useCallback((patch: (s: Scene) => Scene) => {
    if (!selectedFormat || !project.blockOverrides?.[selectedFormat]) {
      patchScene(patch)
      return
    }
    setProject((p) => {
      const current = buildSceneForProject(p, selectedFormat)
      const next = patch(current)
      const previous = p.blockOverrides?.[selectedFormat] ?? {}
      return {
        ...p,
        blockOverrides: {
          ...(p.blockOverrides ?? {}),
          [selectedFormat]: mergeChangedOverrides(previous, current, next),
        },
      }
    })
  }, [patchScene, project.blockOverrides, selectedFormat, setProject])

  // Inline-edit callback — invoked by FormatPreview on dbl-click + blur/Enter.
  // Writes the new text back onto master.<kind> so every format rerenders.
  const setBlockText = useCallback((formatKey: FormatKey, kind: 'title' | 'subtitle' | 'cta' | 'badge', text: string) => {
    if (project.blockOverrides?.[formatKey]) {
      const activeLocale = project.activeLocale
      setProject((p) => ({
        ...p,
        blockOverrides: {
          ...(p.blockOverrides ?? {}),
          [formatKey]: {
            ...(p.blockOverrides?.[formatKey] ?? {}),
            [kind]: {
              ...(p.blockOverrides?.[formatKey]?.[kind] ?? {}),
              ...(activeLocale
                ? {
                    textByLocale: {
                      ...(p.blockOverrides?.[formatKey]?.[kind]?.textByLocale ?? {}),
                      [activeLocale]: text,
                    },
                  }
                : { text }),
            },
          },
        },
      }))
      return
    }
    const activeLocale = project.activeLocale
    patchScene((m) => {
      const b = m[kind]
      if (!b) return m
      if (activeLocale) {
        return {
          ...m,
          [kind]: {
            ...b,
            textByLocale: { ...(b.textByLocale ?? {}), [activeLocale]: text },
          },
        }
      }
      return { ...m, [kind]: { ...b, text } }
    })
  }, [patchScene, project.activeLocale, project.blockOverrides, setProject])

  function toggleEnabled(kind: BlockKind, next: boolean) {
    setProject((p) => ({ ...p, enabled: { ...p.enabled, [kind]: next } }))
  }

  // Precompute up to four distinct palette variants from the analyzed image
  // so the sidebar can offer one-click alternatives without recomputing on
  // every render. Returns empty list when no image has been analyzed yet.
  const paletteAlts = useMemo<DerivedBrandColors[]>(() => {
    if (!project.assetHint) return []
    return paletteAlternatives(project.assetHint, {
      palette: project.brandKit.palette,
      gradient: project.brandKit.gradient,
    })
  }, [project.assetHint, project.brandKit.palette, project.brandKit.gradient])

  // Apply one of the derived palette variants. Same mutation shape as
  // applyImageHint — palette + gradient + master.background + master.accent.
  function applyPaletteAlt(alt: DerivedBrandColors) {
    setProject((p) => ({
      ...p,
      brandKit: { ...p.brandKit, palette: alt.palette, gradient: alt.gradient },
      master: {
        ...p.master,
        background: { kind: 'gradient', stops: alt.gradient },
        accent: alt.palette.accent,
      },
    }))
  }

  function setBrand(next: BrandKit) {
    setProject((p) => ({
      ...p,
      brandKit: next,
      master: {
        ...p.master,
        background: { kind: 'gradient', stops: next.gradient },
        accent: next.palette.accent,
      },
    }))
  }

  function refreshSnapshots() {
    setSnapshots(listSnapshots())
  }

  function handleSaveSnapshot(name: string) {
    saveSnapshot(name, project.brandKit)
    refreshSnapshots()
  }

  function handleApplySnapshot(id: string) {
    const kit = applySnapshot(id)
    if (!kit) return
    setBrand(kit)
  }

  function handleDeleteSnapshot(id: string) {
    deleteSnapshot(id)
    refreshSnapshots()
  }

  function setPaletteLocked(next: boolean) {
    setProject((p) => ({ ...p, paletteLocked: next }))
  }

  function setImage(dataUrl: string) {
    const gen = ++imageGenRef.current
    setProject((p) => ({ ...p, imageSrc: dataUrl, enabled: { ...p.enabled, image: true } }))
    void analyzeImage(dataUrl)
      .then((hint) => {
        if (gen !== imageGenRef.current) return // a newer image is in flight
        setProject((p) => applyImageHint(p, hint))
      })
      .catch(() => {})
  }

  function setLogo(dataUrl: string) {
    setProject((p) => ({ ...p, logoSrc: dataUrl, enabled: { ...p.enabled, logo: true } }))
  }

  const setFormatFocal = useCallback((key: FormatKey, focal: { x: number; y: number } | null) => {
    setProject((p) => {
      const current = p.imageFocals ?? {}
      const next: Partial<Record<FormatKey, { x: number; y: number }>> = { ...current }
      if (focal === null) {
        // inherit from master — drop the override
        delete next[key]
      } else {
        next[key] = focal
      }
      return { ...p, imageFocals: Object.keys(next).length > 0 ? next : undefined }
    })
  }, [setProject])

  function toggleFormat(key: FormatKey) {
    setSelectedFormat((current) => current === key ? null : current)
    setProject((p) => {
      const has = p.selectedFormats.includes(key)
      const next = has ? p.selectedFormats.filter((k) => k !== key) : [...p.selectedFormats, key]
      return { ...p, selectedFormats: next }
    })
  }

  function setActiveLocale(locale: string | undefined) {
    setProject((p) => ({ ...p, activeLocale: locale }))
  }

  function setAvailableLocales(locales: string[]) {
    setProject((p) => ({
      ...p,
      availableLocales: locales.length > 0 ? locales : undefined,
      activeLocale:
        locales.length === 0 || !p.activeLocale || locales.includes(p.activeLocale)
          ? p.activeLocale
          : locales[0],
    }))
  }

  function addCustomFormat(input: { name: string; width: number; height: number; safePct: number; gutterPct: number }) {
    setProject((p) => {
      const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'custom'
      const key: FormatKey = `custom:${slug}-${Date.now()}`
      const rule: FormatRuleSet = {
        key,
        label: input.name.trim() || 'Custom',
        width: input.width,
        height: input.height,
        aspectRatio: input.width / input.height,
        safeZone: { top: input.safePct, right: input.safePct, bottom: input.safePct, left: input.safePct },
        gutter: input.gutterPct,
        minTitleSize: 5,
        maxTitleLines: 3,
        requiredElements: ['title'],
      }
      return {
        ...p,
        customFormats: [...(p.customFormats ?? []), rule],
        selectedFormats: p.selectedFormats.includes(key) ? p.selectedFormats : [...p.selectedFormats, key],
      }
    })
  }

  function deleteCustomFormat(key: FormatKey) {
    if (!key.startsWith('custom:')) return
    setSelectedFormat((current) => current === key ? null : current)
    setProject((p) => {
      const customFormats = (p.customFormats ?? []).filter((f) => f.key !== key)
      const selectedFormats = p.selectedFormats.filter((k) => k !== key)
      const formatOverrides = p.formatOverrides
        ? Object.fromEntries(Object.entries(p.formatOverrides).filter(([k]) => k !== key))
        : undefined
      const imageFocals = p.imageFocals
        ? Object.fromEntries(Object.entries(p.imageFocals).filter(([k]) => k !== key))
        : undefined
      const blockOverrides = p.blockOverrides
        ? Object.fromEntries(Object.entries(p.blockOverrides).filter(([k]) => k !== key))
        : undefined
      const formatDensities = p.formatDensities
        ? Object.fromEntries(Object.entries(p.formatDensities).filter(([k]) => k !== key))
        : undefined
      return { ...p, customFormats, selectedFormats, formatOverrides, imageFocals, blockOverrides, formatDensities }
    })
  }

  const setLayoutDensity = useCallback((density: LayoutDensity, formatKey?: FormatKey | null) => {
    if (!formatKey) {
      setProject((p) => ({ ...p, layoutDensity: density }))
      return
    }
    setProject((p) => ({
      ...p,
      formatDensities: {
        ...(p.formatDensities ?? {}),
        [formatKey]: density,
      },
    }))
  }, [setProject])

  const copyLayout = useCallback((layout: Partial<Record<BlockKind, BlockOverride>>) => {
    setLayoutClipboard(layout)
  }, [])

  const pasteLayout = useCallback((formatKey: FormatKey) => {
    if (!layoutClipboard) return
    setProject((p) => ({
      ...p,
      blockOverrides: {
        ...(p.blockOverrides ?? {}),
        [formatKey]: { ...layoutClipboard },
      },
    }))
  }, [layoutClipboard, setProject])

  const handleFix = useCallback((formatKey: FormatKey) => {
    setProject((p) => {
      const density = p.formatDensities?.[formatKey] ?? p.layoutDensity
      const rules = applyLayoutDensity(getFormat(formatKey, p.customFormats), density)
      const override = p.formatOverrides?.[formatKey]
      const focal = p.imageFocals?.[formatKey]
      const masterForFormat: Scene = focal && p.master.image
        ? {
            ...p.master,
            image: { ...p.master.image, focalX: focal.x, focalY: focal.y },
          }
        : p.master
      const positioned = buildScene(
        masterForFormat,
        formatKey,
        p.brandKit,
        p.enabled,
        {
          ...(override ? { override } : {}),
          assetHint: p.assetHint,
          blockOverrides: p.blockOverrides?.[formatKey],
          locale: p.activeLocale,
          customFormats: p.customFormats,
          density,
        },
      )
      const fixed = fixLayout(positioned, rules)
      const fixedLayout = extractLayout(fixed)
      const next: Scene = {
        ...p.master,
        title: p.master.title && fixed.title
          ? { ...p.master.title, fill: fixed.title.fill }
          : p.master.title,
      }
      return {
        ...p,
        master: next,
        blockOverrides: {
          ...(p.blockOverrides ?? {}),
          [formatKey]: fixedLayout,
        },
      }
    })
  }, [setProject])

  const enableFormatCustom = useCallback((formatKey: FormatKey, scene: Scene) => {
    setSelectedFormat(formatKey)
    setProject((p) => ({
      ...p,
      blockOverrides: {
        ...(p.blockOverrides ?? {}),
        [formatKey]: extractOverrides(scene),
      },
    }))
  }, [setProject])

  const disableFormatCustom = useCallback((formatKey: FormatKey) => {
    setSelectedFormat((current) => current === formatKey ? null : current)
    setProject((p) => {
      if (!p.blockOverrides?.[formatKey]) return p
      const next = { ...p.blockOverrides }
      delete next[formatKey]
      return { ...p, blockOverrides: Object.keys(next).length > 0 ? next : undefined }
    })
  }, [setProject])

  const resetFormatBlock = useCallback((formatKey: FormatKey, kind: BlockKind) => {
    setProject((p) => {
      const current = p.blockOverrides?.[formatKey]
      if (!current?.[kind]) return p
      const nextForFormat = { ...current }
      delete nextForFormat[kind]
      const nextBlockOverrides = { ...(p.blockOverrides ?? {}) }
      if (Object.keys(nextForFormat).length > 0) {
        nextBlockOverrides[formatKey] = nextForFormat
      } else {
        delete nextBlockOverrides[formatKey]
      }
      return {
        ...p,
        blockOverrides: Object.keys(nextBlockOverrides).length > 0 ? nextBlockOverrides : undefined,
      }
    })
  }, [setProject])

  const handlePickElement = useCallback((k: BlockKind, formatKey: FormatKey) => {
    setSelectedKind(k)
    setSelectedFormat(project.blockOverrides?.[formatKey] ? formatKey : null)
  }, [project.blockOverrides])

  async function handleExport(kind: ExportFormat) {
    setExporting(kind)
    try {
      if (kind === 'json') {
        exportJson(project)
        return
      }
      const svgs: Partial<Record<FormatKey, SVGSVGElement>> = {}
      for (const k of project.selectedFormats) {
        const el = gridRef.current?.getSvg(k)
        if (el) svgs[k] = el
      }
      if (kind === 'png') {
        await exportZip(svgs, project.selectedFormats, project.name || 'project', project.customFormats)
      } else if (kind === 'svg') {
        await exportSvgZip(svgs, project.name || 'project')
      } else if (kind === 'pdf') {
        await exportPdf(svgs, project.selectedFormats, project.name || 'project', project.customFormats)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  async function handleImportJson(file: File) {
    try {
      const imported = await importJson(file)
      // Replacing the entire project from a file shouldn't be a tiny undo
      // step — reset history so Ctrl+Z doesn't surface a previous project.
      history.reset(imported)
      setView('editor')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  function handleOnboard(mode: OnboardingMode, payload?: { imageDataUrl?: string }) {
    if (mode === 'template') {
      setView('templates')
      return
    }
    const fresh = newProject()
    if (mode === 'reference' && payload?.imageDataUrl) {
      fresh.imageSrc = payload.imageDataUrl
      fresh.enabled = { ...fresh.enabled, image: true }
      void analyzeImage(payload.imageDataUrl)
        .then((hint) => setProject((p) => applyImageHint(p, hint)))
        .catch(() => {})
    }
    history.reset(fresh)
    setView('editor')
  }

  function handleTemplate(t: Template) {
    const fresh = newProject(t.id)
    fresh.brandKit = t.brandKit
    fresh.master = t.master
    if (t.preferredModels) fresh.formatOverrides = { ...t.preferredModels }
    history.reset(fresh)
    setView('editor')
  }

  if (view === 'onboarding') {
    return (
      <>
        <Onboarding onChoose={handleOnboard} onImportJson={handleImportJson} />
        {error ? <Toast text={error} onDismiss={() => setError(null)} /> : null}
      </>
    )
  }

  if (view === 'templates') {
    return <TemplatePicker onPick={handleTemplate} onBack={() => setView('onboarding')} />
  }

  return (
    <div className="editor">
      <EditorHeader
        projectName={project.name}
        onRename={(n) => setProject((p) => ({ ...p, name: n }))}
        onBack={() => setView('onboarding')}
        onExport={handleExport}
        onImportJson={handleImportJson}
        exporting={exporting}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        lastSavedAt={lastSavedAt}
        isSaving={isSaving}
        activeLocale={project.activeLocale}
        availableLocales={project.availableLocales}
        onSetLocale={setActiveLocale}
      />
      <div className="editor__body">
        <ErrorBoundary fallback={(_, reset) => (
          <aside className="sidebar">
            <div className="sidebar__scroll" style={{ padding: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Sidebar failed.</div>
              <button className="btn btn-ghost btn-xs" onClick={reset}>Reset</button>
            </div>
          </aside>
        )}
        >
          <Sidebar
            project={sidebarProject}
            selectedKind={selectedKind}
            editingFormatKey={selectedFormatScene ? selectedFormat : null}
            onPatchScene={patchEditableScene}
            onResetFormatCustom={disableFormatCustom}
            onResetFormatBlock={resetFormatBlock}
            onSetLayoutDensity={setLayoutDensity}
            onToggleEnabled={toggleEnabled}
            onBrandChange={setBrand}
            onSetImage={setImage}
            onSetLogo={setLogo}
            onToggleFormat={toggleFormat}
            onSetFormatFocal={setFormatFocal}
            paletteAlternatives={paletteAlts}
            onApplyPaletteAlt={applyPaletteAlt}
            onTogglePaletteLock={setPaletteLocked}
            snapshots={snapshots}
            onSaveSnapshot={handleSaveSnapshot}
            onApplySnapshot={handleApplySnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            onSetLocales={setAvailableLocales}
            onAddCustomFormat={addCustomFormat}
            onDeleteCustomFormat={deleteCustomFormat}
          />
        </ErrorBoundary>
        <main className="editor__main">
          <ErrorBoundary fallback={(err, reset) => (
            <div style={{ padding: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Preview failed.</div>
              <div style={{ marginBottom: 8, color: '#4E5155' }}>{err.message}</div>
              <div style={{ marginBottom: 6 }}>Copy project JSON to recover:</div>
              <textarea
                readOnly
                value={JSON.stringify(project, null, 2)}
                style={{ width: '100%', minHeight: 180 }}
              />
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-ghost btn-xs" onClick={reset}>Reset</button>
              </div>
            </div>
          )}
          >
            <FormatGrid
              ref={gridRef}
              formats={project.selectedFormats}
              master={masterWithAssets}
              brandKit={project.brandKit}
              enabled={project.enabled}
              overrides={project.formatOverrides}
              blockOverrides={project.blockOverrides}
              layoutDensity={project.layoutDensity}
              formatDensities={project.formatDensities}
              layoutClipboard={layoutClipboard}
              imageFocals={project.imageFocals}
              assetHint={project.assetHint}
              onPickElement={handlePickElement}
              onFix={handleFix}
              onSetFocal={setFormatFocal}
              onSetBlockText={setBlockText}
              onCopyLayout={copyLayout}
              onPasteLayout={pasteLayout}
              onEnableCustom={enableFormatCustom}
              onDisableCustom={disableFormatCustom}
              locale={project.activeLocale}
              customFormats={project.customFormats}
            />
          </ErrorBoundary>
        </main>
      </div>
      {error ? <Toast text={error} onDismiss={() => setError(null)} /> : null}
    </div>
  )
}

function Toast({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div className="toast" role="status">
      <span>{text}</span>
      <button className="toast__close" onClick={onDismiss}>×</button>
    </div>
  )
}

function buildSceneForProject(project: Project, formatKey: FormatKey): Scene {
  const focal = project.imageFocals?.[formatKey]
  const master = sceneWithAssets(project)
  const masterForFormat: Scene = focal && master.image
    ? {
        ...master,
        image: { ...master.image, focalX: focal.x, focalY: focal.y },
      }
    : master
  return buildScene(
    masterForFormat,
    formatKey,
    project.brandKit,
    project.enabled,
    {
      ...(project.formatOverrides?.[formatKey] ? { override: project.formatOverrides[formatKey] } : {}),
      assetHint: project.assetHint,
      blockOverrides: project.blockOverrides?.[formatKey],
      locale: project.activeLocale,
      customFormats: project.customFormats,
      density: project.formatDensities?.[formatKey] ?? project.layoutDensity,
    },
  )
}

function sceneWithAssets(project: Project): Scene {
  const m = project.master
  return {
    ...m,
    image: m.image ? { ...m.image, src: project.imageSrc } : m.image,
    logo: m.logo ? { ...m.logo, src: project.logoSrc } : m.logo,
  }
}

function extractLayout(scene: Scene): Partial<Record<BlockKind, BlockOverride>> {
  return extractOverrides(scene)
}

function extractOverrides(scene: Scene): Partial<Record<BlockKind, BlockOverride>> {
  const out: Partial<Record<BlockKind, BlockOverride>> = {}
  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const b = scene[k]
    if (!b) continue
    out[k] = blockToOverride(b)
  }
  return out
}

function mergeChangedOverrides(
  previous: Partial<Record<BlockKind, BlockOverride>>,
  current: Scene,
  next: Scene,
): Partial<Record<BlockKind, BlockOverride>> {
  const out: Partial<Record<BlockKind, BlockOverride>> = { ...previous }
  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const before = current[k]
    const after = next[k]
    if (!after) {
      delete out[k]
      continue
    }
    if (!before || !sameOverride(blockToOverride(before), blockToOverride(after))) {
      out[k] = blockToOverride(after)
    }
  }
  return out
}

function sameOverride(a: BlockOverride, b: BlockOverride): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function blockToOverride(block: NonNullable<Scene[BlockKind]>): BlockOverride {
  const keys = [
    'x',
    'y',
    'w',
    'h',
    'text',
    'textByLocale',
    'fontSize',
    'charsPerLine',
    'maxLines',
    'fitMode',
    'weight',
    'fill',
    'opacity',
    'letterSpacing',
    'lineHeight',
    'align',
    'transform',
    'bg',
    'rx',
    'fit',
    'focalX',
    'focalY',
    'bgOpacity',
  ] as const
  const out: Record<string, unknown> = {}
  const source = block as Record<string, unknown>
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key]
  }
  return out as BlockOverride
}
