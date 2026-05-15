import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Onboarding } from './components/Onboarding'
import { EditorHeader, type ExportFormat } from './components/EditorHeader'
import { Sidebar } from './components/Sidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TemplatePicker } from './components/TemplatePicker'
import { FormatGrid, type FormatGridHandle } from './components/FormatGrid'
import { LayoutEditor } from './components/LayoutEditor'
import { PropagateDialog } from './components/PropagateDialog'
import { projectOverrides } from './lib/propagateLayout'
import { newProject } from './lib/defaults'
import { loadProject, saveProject } from './lib/storage'
import {
  deleteProjectFromHistory,
  duplicateProjectFromHistory,
  listProjectHistory,
  loadProjectFromHistory,
  saveProjectToHistory,
} from './lib/projectHistory'
import { exportZip, exportPdf } from './lib/export'
import { exportSvgZip } from './lib/exportSvg'
import { exportJson, importJson } from './lib/serialize'
import { analyzeImage } from './lib/imageAnalysis'
import { paletteAlternatives, type DerivedBrandColors } from './lib/paletteFromImage'
import { buildScene, resolveCompositionModel } from './lib/buildScene'
import { COMPOSITION_MODEL_LABELS } from './lib/composition'
import { fixLayout } from './lib/fixLayout'
import { getFormat } from './lib/formats'
import { applyLayoutDensity } from './lib/layoutDensity'
import { useHistory } from './lib/useHistory'
import { applyImageHint } from './lib/applyImageHint'
import { extendImageBackgroundForFormat } from './lib/imageBackgroundExtension'
import { resolveImageFitDecisionForFormat } from './lib/imageFitDecision'
import { getActiveImageFitMode, getActiveImageSrc } from './lib/projectImages'
import { clearFormatLayoutOverrides, normalizeFormatOverrides, setFormatCompositionOverride } from './lib/projectComposition'
import { addSceneObject, ensureProjectFormatDocuments, moveLayer, resetProjectFormatDocument, sceneFromFormatDocument, selectDocumentObject, updateObjectProperties, updateObjectsFromScene, type CreatableSceneObjectType } from './lib/formatDocuments'
import { applySnapshot, deleteSnapshot, listSnapshots, saveSnapshot } from './lib/brandSnapshots'
import type { Template } from './lib/templates'
import type {
  BlockOverride,
  BlockKind,
  BrandKit,
  BrandSnapshot,
  CompositionModel,
  FormatKey,
  FormatRuleSet,
  ImageFitPreference,
  LayoutDensity,
  OnboardingMode,
  Project,
  ProjectHistoryItem,
  Scene,
  SceneObject,
  View,
} from './lib/types'

export default function App() {
  const [view, setView] = useState<View>('onboarding')
  const [project, setProject, history] = useHistory<Project>(
    () => normalizeBackgroundExtensionState(loadProject() ?? newProject()),
    350,
  )
  const [selectedKind, setSelectedKind] = useState<BlockKind | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<FormatKey | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme())
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [layoutClipboard, setLayoutClipboard] = useState<Partial<Record<BlockKind, BlockOverride>> | null>(null)
  const [snapshots, setSnapshots] = useState<BrandSnapshot[]>(() => listSnapshots())
  const [projectHistoryItems, setProjectHistoryItems] = useState<ProjectHistoryItem[]>(() => listProjectHistory())
  // Полноэкранный редактор макета и диалог переноса на другие форматы.
  const [editingFormat, setEditingFormat] = useState<FormatKey | null>(null)
  const [propagateState, setPropagateState] = useState<
    { source: FormatKey; overrides: Partial<Record<BlockKind, BlockOverride>> } | null
  >(null)
  const gridRef = useRef<FormatGridHandle>(null)
  // Monotonic counter for image-analysis results. The user may replace the image
  // before the previous analysis resolves — we drop any hint that isn't from the
  // most recent upload so a stale palette can't clobber the current one.
  const imageGenRef = useRef(0)
  const bgAutoStartedForRef = useRef<string | null>(null)
  const toastIdRef = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback((text: string, tone: ToastEntry['tone'] = 'error') => {
    const id = ++toastIdRef.current
    setToasts((list) => {
      const next = [...list, { id, text, tone }]
      // Cap the visible stack at 3 entries — older toasts get evicted.
      return next.length > 3 ? next.slice(next.length - 3) : next
    })
  }, [])

  // hydrate view if a saved project exists
  useEffect(() => {
    const saved = loadProject()
    if (saved) setView('editor')
  }, [])

  useEffect(() => {
    const sourceImageSrc = project.originalImageSrc ?? project.imageSrc
    if (!sourceImageSrc) return
    if (project.backgroundExtensionStatus === 'calculating') return
    const missingFormats = project.selectedFormats.filter((key) => !project.backgroundExtensionByFormat?.[key])
    if (missingFormats.length === 0) return
    const batchKey = `${sourceImageSrc}:${missingFormats.join('|')}`
    if (bgAutoStartedForRef.current === batchKey) return
    bgAutoStartedForRef.current = batchKey
    const gen = ++imageGenRef.current
    setProject((p) => ({
      ...p,
      originalImageSrc: p.originalImageSrc ?? p.imageSrc,
      backgroundExtensionStatus: 'calculating',
    }))
    prepareBackgroundExtensionsForFormats(sourceImageSrc, gen, project, missingFormats)
  }, [
    project.backgroundExtensionByFormat,
    project.backgroundExtensionStatus,
    project.customFormats,
    project.imageSrc,
    project.originalImageSrc,
    project.selectedFormats,
    setProject,
  ])

  useEffect(() => {
    if (view !== 'editor') return
    if (project.imageSrc && !hasBackgroundExtensionMetadataForAllFormats(project)) return
    setProject((p) => ensureProjectFormatDocuments(p))
  }, [project.backgroundExtensionByFormat, project.formatDocuments, project.imageSrc, project.selectedFormats, setProject, view])

  useEffect(() => {
    if (!project.imageSrc || !project.master.image) {
      if (Object.keys(project.imageFitDecisionByFormat ?? {}).length === 0) return
      setProject((p) => ({ ...p, imageFitDecisionByFormat: {} }))
      return
    }
    if (!hasBackgroundExtensionMetadataForAllFormats(project)) {
      if (Object.keys(project.imageFitDecisionByFormat ?? {}).length === 0) return
      setProject((p) => ({ ...p, imageFitDecisionByFormat: {} }))
      return
    }
    const next = computeImageFitDecisions(project)
    if (JSON.stringify(next) === JSON.stringify(project.imageFitDecisionByFormat ?? {})) return
    setProject((p) => ({ ...p, imageFitDecisionByFormat: next }))
  }, [
    project.backgroundExtensionByFormat,
    project.blockOverrides,
    project.brandKit,
    project.customFormats,
    project.enabled,
    project.extendedImageByFormat,
    project.formatDensities,
    project.formatOverrides,
    project.imageFitDecisionByFormat,
    project.imageFitPreference,
    project.imageFocals,
    project.imageSrc,
    project.layoutDensity,
    project.master,
    project.activeLocale,
    project.selectedFormats,
    setProject,
  ])

  // Theme propagation: apply data-theme to <html> and persist user choice.
  // The editor chrome uses [data-theme="dark"] overrides; rendered scenes
  // are untouched (they keep template brand kits regardless of UI theme).
  useEffect(() => {
    const root = document.documentElement
    const resolved = resolveTheme(theme)
    root.setAttribute('data-theme', resolved)
    if (theme === 'system') {
      window.localStorage.removeItem('ag.theme')
    } else {
      window.localStorage.setItem('ag.theme', theme)
    }
  }, [theme])

  // React to OS-level preference flips when user is on system mode.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setTheme((current) => (current === 'system' ? 'system' : current))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Debounced persist. The "isSaving" flag flips true on every change and
  // flips back false once the debounced write lands — this is what drives the
  // "Saving…" → "Saved 3s ago" transition in the header.
  useEffect(() => {
    setIsSaving(true)
    const t = window.setTimeout(() => {
      saveProject(project)
      saveProjectToHistory(project)
      setProjectHistoryItems(listProjectHistory())
      setLastSavedAt(Date.now())
      setIsSaving(false)
    }, 300)
    return () => window.clearTimeout(t)
  }, [project])

  // auto-clear toasts after 4s. Each entry is removed independently so the
  // user can see a stack of recent messages.
  useEffect(() => {
    if (toasts.length === 0) return
    const earliest = toasts[0]!
    const t = window.setTimeout(() => dismissToast(earliest.id), 4000)
    return () => window.clearTimeout(t)
  }, [toasts, dismissToast])

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
    const imageSrc = selectedFormat ? getActiveImageSrc(project, selectedFormat) : getActiveImageSrc(project)
    const imageFit = selectedFormat ? getActiveImageFitMode(project, selectedFormat) : getActiveImageFitMode(project)
    return {
      ...m,
      image: m.image ? { ...m.image, src: imageSrc, fit: imageFit } : m.image,
      logo: m.logo ? { ...m.logo, src: project.logoSrc } : m.logo,
    }
  }, [project, selectedFormat])

  const imageSrcByFormat = useMemo<Partial<Record<FormatKey, string | null>>>(() => {
    return Object.fromEntries(project.selectedFormats.map((key) => [key, getActiveImageSrc(project, key)])) as Partial<Record<FormatKey, string | null>>
  }, [project])

  const imageFitByFormat = useMemo<Partial<Record<FormatKey, 'cover' | 'contain'>>>(() => {
    return Object.fromEntries(project.selectedFormats.map((key) => [key, getActiveImageFitMode(project, key)])) as Partial<Record<FormatKey, 'cover' | 'contain'>>
  }, [project])

  const selectedFormatScene = useMemo<Scene | null>(() => {
    if (!selectedFormat) return null
    if (project.blockOverrides?.[selectedFormat]) return buildSceneForProject(project, selectedFormat)
    const document = project.formatDocuments?.[selectedFormat]
    if (document?.isEdited) return sceneFromFormatDocument(document)
    return null
  }, [project, selectedFormat])

  const editingDocument = editingFormat ? project.formatDocuments?.[editingFormat] : undefined
  const editingActiveObjectId = editingDocument?.activeObjectId ?? project.activeObjectId ?? null

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
    if (!selectedFormat) {
      patchScene(patch)
      return
    }
    if (project.blockOverrides?.[selectedFormat]) {
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
      return
    }
    if (project.formatDocuments?.[selectedFormat]?.isEdited) {
      setProject((p) => {
        const document = p.formatDocuments?.[selectedFormat]
        if (!document) return p
        const nextScene = patch(sceneFromFormatDocument(document))
        const updated = {
          ...document,
          scene: nextScene,
          objects: updateObjectsFromScene(nextScene, document.objects, document.format),
          isEdited: true,
          updatedAt: new Date().toISOString(),
        }
        return {
          ...p,
          formatDocuments: { ...(p.formatDocuments ?? {}), [selectedFormat]: updated },
        }
      })
      return
    }
    patchScene(patch)
  }, [patchScene, project.blockOverrides, project.formatDocuments, selectedFormat, setProject])

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
    if (project.formatDocuments?.[formatKey]?.isEdited) {
      setProject((p) => {
        const document = p.formatDocuments?.[formatKey]
        if (!document) return p
        const current = sceneFromFormatDocument(document)
        const block = current[kind]
        if (!block) return p
        const nextScene = { ...current, [kind]: { ...block, text } }
        return {
          ...p,
          formatDocuments: {
            ...(p.formatDocuments ?? {}),
            [formatKey]: {
              ...document,
              scene: nextScene,
              objects: updateObjectsFromScene(nextScene, document.objects, document.format),
              isEdited: true,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      })
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
  }, [patchScene, project.activeLocale, project.blockOverrides, project.formatDocuments, setProject])

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

  function refreshProjectHistory() {
    setProjectHistoryItems(listProjectHistory())
  }

  function handleOpenHistoryProject(id: string) {
    saveProject(project)
    saveProjectToHistory(project)
    const stored = loadProjectFromHistory(id)
    if (!stored) {
      refreshProjectHistory()
      pushToast('Проект не найден в истории.')
      return
    }
    imageGenRef.current += 1
    history.reset(normalizeBackgroundExtensionState(stored))
    setSelectedKind(null)
    setSelectedFormat(null)
    setEditingFormat(null)
    setPropagateState(null)
    setView('editor')
    refreshProjectHistory()
  }

  function handleDuplicateHistoryProject(id: string) {
    if (!duplicateProjectFromHistory(id)) {
      pushToast('Не удалось продублировать проект.')
      return
    }
    refreshProjectHistory()
  }

  function handleDeleteHistoryProject(id: string) {
    deleteProjectFromHistory(id)
    refreshProjectHistory()
  }

  function setPaletteLocked(next: boolean) {
    setProject((p) => ({ ...p, paletteLocked: next }))
  }

  function setImage(dataUrl: string) {
    const gen = ++imageGenRef.current
    setProject((p) => ({
      ...p,
      imageSrc: dataUrl,
      originalImageSrc: dataUrl,
      extendedImageSrc: null,
      useExtendedImage: false,
      imageFitDecisionByFormat: {},
      backgroundExtensionStatus: 'calculating',
      backgroundExtension: undefined,
      extendedImageByFormat: {},
      backgroundExtensionByFormat: {},
      enabled: { ...p.enabled, image: true },
    }))
    void analyzeImage(dataUrl)
      .then((hint) => {
        if (gen !== imageGenRef.current) return // a newer image is in flight
        setProject((p) => applyImageHint(p, hint))
      })
      .catch(() => {})
    prepareBackgroundExtensionsForFormats(dataUrl, gen, project, project.selectedFormats)
  }

  function prepareBackgroundExtensionsForFormats(
    dataUrl: string,
    gen: number,
    projectSnapshot: Project,
    formatKeys: FormatKey[],
  ) {
    const uniqueKeys = [...new Set(formatKeys)]
    console.debug('[bg-extension] start', { gen, formats: uniqueKeys })
    void Promise.all(uniqueKeys.map(async (formatKey) => {
      try {
        const rules = getFormat(formatKey, projectSnapshot.customFormats)
        const result = await extendImageBackgroundForFormat({
          imageSrc: dataUrl,
          targetWidth: rules.width,
          targetHeight: rules.height,
          targetFormatKey: formatKey,
          paddingRatio: 0.08,
          maxExpansionPercent: 0.5,
          maxWidthExpansionPercent: 0.5,
          maxHeightExpansionPercent: 0.5,
          minSubjectWidthCoverage: 0.25,
          minSubjectHeightCoverage: 0.45,
        })
        return { formatKey, result }
      } catch (error) {
        console.error('[bg-extension] failed', { formatKey, error })
        let aspectRatio = 1
        try {
          aspectRatio = getFormat(formatKey, projectSnapshot.customFormats).aspectRatio
        } catch {
          aspectRatio = 1
        }
        return {
          formatKey,
          result: {
            imageSrc: dataUrl,
            changed: false,
            reason: 'calculation-failed',
            originalSize: { width: 0, height: 0 },
            extendedSize: { width: 0, height: 0 },
            targetAspectRatio: aspectRatio,
            targetAspectRatioRaw: aspectRatio,
            targetAspectRatioUsed: Math.max(0.75, Math.min(1.8, aspectRatio)),
            targetFormatKey: formatKey,
            backgroundUniformity: 0,
            aspectRatioPreserved: true,
            drawScaleX: 1,
            drawScaleY: 1,
            drawOffsetX: 0,
            drawOffsetY: 0,
          },
        } as const
      }
    }))
      .then((entries) => {
        if (gen !== imageGenRef.current) return
        console.debug('[bg-extension] done', entries)
        setProject((p) => {
          const extendedImageByFormat = { ...(p.extendedImageByFormat ?? {}) }
          const backgroundExtensionByFormat = { ...(p.backgroundExtensionByFormat ?? {}) }
          let firstChanged: typeof entries[number]['result'] | null = null
          for (const { formatKey, result } of entries) {
            backgroundExtensionByFormat[formatKey] = { ...result }
            if (result.changed) {
              extendedImageByFormat[formatKey] = { imageSrc: result.imageSrc, metadata: { ...result } }
              firstChanged ??= result
            } else {
              delete extendedImageByFormat[formatKey]
            }
          }
          return {
            ...p,
            extendedImageByFormat,
            backgroundExtensionByFormat,
            extendedImageSrc: firstChanged?.imageSrc ?? p.extendedImageSrc ?? null,
            backgroundExtension: firstChanged ? { ...firstChanged } : entries[0] ? { ...entries[0].result } : p.backgroundExtension,
            backgroundExtensionStatus: entries.some(({ result }) => result.reason === 'calculation-failed' || result.reason === 'load-failed' || result.reason === 'canvas-unavailable')
              ? 'failed'
              : 'done',
          }
        })
      })
  }

  function setLogo(dataUrl: string) {
    setProject((p) => ({ ...p, logoSrc: dataUrl, enabled: { ...p.enabled, logo: true } }))
  }

  function setImageFitPreference(next: ImageFitPreference) {
    setProject((p) => ({ ...p, imageFitPreference: next }))
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
        label: input.name.trim() || 'Свой формат',
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
      blockOverrides: clearFormatLayoutOverrides(p.blockOverrides, formatKey),
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

  const setFormatComposition = useCallback((formatKey: FormatKey, model: CompositionModel | null) => {
    setProject((p) => {
      return {
        ...p,
        formatOverrides: setFormatCompositionOverride(p.formatOverrides, formatKey, model),
        blockOverrides: clearFormatLayoutOverrides(p.blockOverrides, formatKey),
      }
    })
  }, [setProject])

  const disableFormatCustom = useCallback((formatKey: FormatKey) => {
    setSelectedFormat((current) => current === formatKey ? null : current)
    setProject((p) => {
      if (!p.blockOverrides?.[formatKey] && !p.formatDocuments?.[formatKey]?.isEdited) return p
      const nextBlockOverrides = { ...(p.blockOverrides ?? {}) }
      delete nextBlockOverrides[formatKey]
      const nextProject: Project = {
        ...p,
        blockOverrides: Object.keys(nextBlockOverrides).length > 0 ? nextBlockOverrides : undefined,
      }
      return p.formatDocuments?.[formatKey]?.isEdited
        ? resetProjectFormatDocument(nextProject, formatKey)
        : nextProject
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
    setSelectedFormat(project.formatDocuments?.[formatKey]?.isEdited || project.blockOverrides?.[formatKey] ? formatKey : null)
    if (project.formatDocuments?.[formatKey]?.isEdited) {
      setProject((p) => {
        const document = p.formatDocuments?.[formatKey]
        if (!document) return p
        const object = document.objects.find((candidate) => candidate.type === k)
        if (!object) return p
        return {
          ...p,
          formatDocuments: {
            ...(p.formatDocuments ?? {}),
            [formatKey]: selectDocumentObject(document, object.id),
          },
        }
      })
    }
  }, [project.blockOverrides, project.formatDocuments, setProject])

  const selectObject = useCallback((objectId: string) => {
    const formatKey = editingFormat ?? selectedFormat
    if (!formatKey) return
    const object = project.formatDocuments?.[formatKey]?.objects.find((candidate) => candidate.id === objectId)
    setProject((p) => {
      const document = p.formatDocuments?.[formatKey]
      if (!document) return p
      return {
        ...p,
        activeObjectId: objectId,
        formatDocuments: {
          ...(p.formatDocuments ?? {}),
          [formatKey]: selectDocumentObject(document, objectId),
        },
      }
    })
    if (object && isBlockObjectType(object.type)) setSelectedKind(object.type)
  }, [editingFormat, project.formatDocuments, selectedFormat, setProject])

  const toggleObjectVisible = useCallback((objectId: string, visible: boolean) => {
    const formatKey = editingFormat ?? selectedFormat
    if (!formatKey) return
    setProject((p) => updateFormatDocumentObject(p, formatKey, objectId, { visible }))
  }, [editingFormat, selectedFormat, setProject])

  const toggleObjectLocked = useCallback((objectId: string, locked: boolean) => {
    const formatKey = editingFormat ?? selectedFormat
    if (!formatKey) return
    setProject((p) => updateFormatDocumentObject(p, formatKey, objectId, { locked }))
  }, [editingFormat, selectedFormat, setProject])

  const moveObject = useCallback((objectId: string, direction: 'up' | 'down') => {
    const formatKey = editingFormat ?? selectedFormat
    if (!formatKey) return
    setProject((p) => {
      const document = p.formatDocuments?.[formatKey]
      if (!document) return p
      return {
        ...p,
        activeObjectId: objectId,
        formatDocuments: {
          ...(p.formatDocuments ?? {}),
          [formatKey]: {
            ...document,
            objects: moveLayer(document.objects, objectId, direction),
            activeObjectId: objectId,
            isEdited: true,
            updatedAt: new Date().toISOString(),
          },
        },
      }
    })
  }, [editingFormat, selectedFormat, setProject])

  const updateObject = useCallback((objectId: string, patch: Partial<SceneObject>) => {
    const formatKey = editingFormat ?? selectedFormat
    if (!formatKey) return
    setProject((p) => updateFormatDocumentObject(p, formatKey, objectId, patch))
  }, [editingFormat, selectedFormat, setProject])

  const resetEditingFormat = useCallback(() => {
    if (!editingFormat) return
    const confirmed = window.confirm('Все ручные изменения этого формата будут сброшены. Остальные форматы не изменятся.')
    if (!confirmed) return
    setProject((p) => enterFormatEditMode(resetProjectFormatDocument(p, editingFormat), editingFormat, true))
    setSelectedFormat(editingFormat)
    pushToast('Формат сброшен к авто-версии', 'info')
  }, [editingFormat, pushToast, setProject])

  const addObject = useCallback((type: CreatableSceneObjectType) => {
    if (!editingFormat) return
    setProject((p) => {
      const ensured = ensureProjectFormatDocuments(p)
      const document = ensured.formatDocuments?.[editingFormat]
      if (!document) return ensured
      return {
        ...ensured,
        activeFormatKey: editingFormat,
        editorMode: 'edit',
        formatDocuments: {
          ...(ensured.formatDocuments ?? {}),
          [editingFormat]: addSceneObject(document, type),
        },
      }
    })
  }, [editingFormat, setProject])

  // Open the full-screen layout editor for a format. If the format is in
  // "Auto" mode (no manual composition picked), resolve the auto-chosen
  // model and pin it now — that way the user edits on top of a known,
  // stable layout. Otherwise the auto-picker could re-evaluate next time
  // (image changes, density tweaks, etc.) and the saved blockOverrides
  // would no longer match the layout they were authored against.
  const openLayoutEditor = useCallback(
    (formatKey: FormatKey) => {
      setSelectedFormat(formatKey)
      const resolved = project.formatOverrides?.[formatKey] ?? resolveCompositionModel(
        masterWithAssets,
        formatKey,
        project.brandKit,
        project.enabled,
        {
          assetHint: project.assetHint ?? undefined,
          customFormats: project.customFormats,
          density: project.formatDensities?.[formatKey] ?? project.layoutDensity,
        },
      )
      setProject((p) => {
        const withOverride = p.formatOverrides?.[formatKey]
          ? p
          : { ...p, formatOverrides: { ...(p.formatOverrides ?? {}), [formatKey]: resolved } }
        return enterFormatEditMode(withOverride, formatKey, true)
      })
      if (!project.formatOverrides?.[formatKey]) {
        pushToast(
          `Композиция «${COMPOSITION_MODEL_LABELS[resolved].short}» зафиксирована для редактирования`,
          'info',
        )
      }
      setEditingFormat(formatKey)
    },
    [
      masterWithAssets,
      project.formatOverrides,
      project.brandKit,
      project.enabled,
      project.assetHint,
      project.customFormats,
      project.formatDensities,
      project.layoutDensity,
      pushToast,
      setProject,
    ],
  )

  const closeLayoutEditor = useCallback(() => {
    setEditingFormat(null)
    setProject((p) => exitFormatEditMode(p))
  }, [setProject])

  // Save edited overrides back into the project. Always lands them under
  // blockOverrides[formatKey] — that way the format becomes "custom" and the
  // user's manual edits aren't blown away by master-scene tweaks afterward.
  const saveEditedLayout = useCallback(
    (formatKey: FormatKey, overrides: Partial<Record<BlockKind, BlockOverride>>) => {
      if (project.formatDocuments?.[formatKey]) {
        setSelectedFormat(formatKey)
        return
      }
      setProject((p) => ({
        ...p,
        blockOverrides: {
          ...(p.blockOverrides ?? {}),
          [formatKey]: overrides,
        },
      }))
      setSelectedFormat(formatKey)
    },
    [project.formatDocuments, setProject],
  )

  const requestPropagate = useCallback(
    (formatKey: FormatKey, overrides: Partial<Record<BlockKind, BlockOverride>>) => {
      setPropagateState({ source: formatKey, overrides })
    },
    [],
  )

  const applyPropagate = useCallback(
    (targets: FormatKey[]) => {
      if (!propagateState) return
      const { source, overrides } = propagateState
      const sourceRules = applyLayoutDensity(
        getFormat(source, project.customFormats),
        project.formatDensities?.[source] ?? project.layoutDensity,
      )
      setProject((p) => {
        const nextBlockOverrides = { ...(p.blockOverrides ?? {}) }
        for (const target of targets) {
          if (target === source) continue
          const targetRules = applyLayoutDensity(
            getFormat(target, p.customFormats),
            p.formatDensities?.[target] ?? p.layoutDensity,
          )
          nextBlockOverrides[target] = projectOverrides(overrides, sourceRules, targetRules)
        }
        return { ...p, blockOverrides: nextBlockOverrides }
      })
      pushToast(`Макет применён к ${targets.length} формат${pluralEnding(targets.length)}.`, 'info')
      setPropagateState(null)
    },
    [project.customFormats, project.formatDensities, project.layoutDensity, propagateState, pushToast, setProject],
  )

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
      pushToast(e instanceof Error ? e.message : 'Не удалось выполнить экспорт.')
    } finally {
      setExporting(null)
    }
  }

  async function handleImportJson(file: File) {
    try {
      const imported = normalizeBackgroundExtensionState(await importJson(file))
      // Replacing the entire project from a file shouldn't be a tiny undo
      // step — reset history so Ctrl+Z doesn't surface a previous project.
      const hasImportedBackgroundExtension = !!imported.backgroundExtension || Object.keys(imported.backgroundExtensionByFormat ?? {}).length > 0
      if (imported.imageSrc && !hasImportedBackgroundExtension) {
        const gen = ++imageGenRef.current
        history.reset({
          ...imported,
          originalImageSrc: imported.originalImageSrc ?? imported.imageSrc,
          extendedImageSrc: null,
          useExtendedImage: false,
          backgroundExtensionStatus: 'calculating',
        })
        prepareBackgroundExtensionsForFormats(imported.imageSrc, gen, imported, imported.selectedFormats)
      } else {
        history.reset(imported)
      }
      setView('editor')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Не удалось импортировать проект.')
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
    fresh.enabled = { ...fresh.enabled, ...t.enabled }
    fresh.imageSrc = t.master.image?.src ?? null
    fresh.logoSrc = t.master.logo?.src ?? null
    if (t.preferredModels) {
      fresh.formatOverrides = { ...(fresh.formatOverrides ?? {}), ...t.preferredModels }
    }
    if (t.blockOverrides) fresh.blockOverrides = { ...t.blockOverrides }
    if (t.formatDensities) fresh.formatDensities = { ...t.formatDensities }
    history.reset(fresh)
    setView('editor')
  }

  if (view === 'onboarding') {
    return (
      <>
        <Onboarding onChoose={handleOnboard} onImportJson={handleImportJson} />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
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
        theme={theme}
        onSetTheme={setTheme}
      />
      <div className="editor__body">
        <ErrorBoundary fallback={(_, reset) => (
          <aside className="sidebar" role="alert" aria-live="assertive">
            <div className="sidebar__scroll" style={{ padding: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Боковая панель сломалась.</div>
              <button className="btn btn-ghost btn-xs" onClick={reset}>Перезапустить</button>
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
            onSetImageFitPreference={setImageFitPreference}
            onToggleFormat={toggleFormat}
            onSetFormatFocal={setFormatFocal}
            paletteAlternatives={paletteAlts}
            onApplyPaletteAlt={applyPaletteAlt}
            onTogglePaletteLock={setPaletteLocked}
            snapshots={snapshots}
            onSaveSnapshot={handleSaveSnapshot}
            onApplySnapshot={handleApplySnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            projectHistoryItems={projectHistoryItems}
            currentProjectId={project.id}
            onOpenHistoryProject={handleOpenHistoryProject}
            onDuplicateHistoryProject={handleDuplicateHistoryProject}
            onDeleteHistoryProject={handleDeleteHistoryProject}
            onSetLocales={setAvailableLocales}
            onAddCustomFormat={addCustomFormat}
            onDeleteCustomFormat={deleteCustomFormat}
          />
        </ErrorBoundary>
        <main className="editor__main">
          <ErrorBoundary fallback={(err, reset) => (
            <div style={{ padding: 12 }} role="alert" aria-live="assertive">
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Превью сломалось.</div>
              <div style={{ marginBottom: 8, color: '#4E5155' }}>{err.message}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-xs" onClick={reset}>Перезапустить</button>
              </div>
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: '#4E5155', fontSize: 12 }}>
                  Показать данные проекта (для отладки)
                </summary>
                <div style={{ marginTop: 6, marginBottom: 4, fontSize: 12, color: '#4E5155' }}>
                  Скопируйте JSON, чтобы восстановить проект:
                </div>
                <textarea
                  readOnly
                  value={JSON.stringify(project, null, 2)}
                  style={{ width: '100%', minHeight: 180 }}
                />
              </details>
            </div>
          )}
          >
            <FormatGrid
              ref={gridRef}
              formats={project.selectedFormats}
              master={masterWithAssets}
              imageSrcByFormat={imageSrcByFormat}
              imageFitByFormat={imageFitByFormat}
              brandKit={project.brandKit}
              enabled={project.enabled}
              overrides={project.formatOverrides}
              formatDocuments={project.formatDocuments}
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
              onFormatComposition={setFormatComposition}
              onOpenLayoutEditor={openLayoutEditor}
            />
          </ErrorBoundary>
        </main>
      </div>
      {editingFormat ? (
        <LayoutEditor
          formatKey={editingFormat}
          master={masterWithAssets}
          brandKit={project.brandKit}
          enabled={project.enabled}
          override={project.formatOverrides?.[editingFormat]}
          focal={project.imageFocals?.[editingFormat]}
          density={project.formatDensities?.[editingFormat] ?? project.layoutDensity}
          customFormats={project.customFormats}
          assetHint={project.assetHint}
          blockOverride={project.blockOverrides?.[editingFormat]}
          locale={project.activeLocale}
          onSave={(overrides) => {
            saveEditedLayout(editingFormat, overrides)
            setEditingFormat(null)
          }}
          onCancel={closeLayoutEditor}
          onPropagate={(overrides) => {
            saveEditedLayout(editingFormat, overrides)
            requestPropagate(editingFormat, overrides)
            setEditingFormat(null)
          }}
          formatDocument={editingDocument}
          activeObjectId={editingActiveObjectId}
          onSelectObject={selectObject}
          onToggleObjectVisible={toggleObjectVisible}
          onToggleObjectLocked={toggleObjectLocked}
          onMoveObject={moveObject}
          onUpdateObject={updateObject}
          onAddObject={addObject}
          onResetFormat={resetEditingFormat}
        />
      ) : null}
      {propagateState ? (
        <PropagateDialog
          sourceFormat={propagateState.source}
          candidates={project.selectedFormats}
          customFormats={project.customFormats}
          onCancel={() => setPropagateState(null)}
          onApply={applyPropagate}
        />
      ) : null}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

function pluralEnding(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return ''
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'а'
  return 'ов'
}

type ToastEntry = { id: number; text: string; tone: 'error' | 'info' }
type ThemeMode = 'light' | 'dark' | 'system'

function readStoredTheme(): ThemeMode {
  try {
    const raw = window.localStorage.getItem('ag.theme')
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // localStorage may be unavailable (private mode / SSR-style).
  }
  return 'system'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.tone}`}
          role={t.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{t.text}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Закрыть уведомление"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function buildSceneForProject(project: Project, formatKey: FormatKey): Scene {
  const focal = project.imageFocals?.[formatKey]
  const master = sceneWithAssetsForFormat(project, formatKey)
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

export function enterFormatEditMode(project: Project, formatKey: FormatKey, refreshGenerated = false): Project {
  const ensured = ensureProjectFormatDocuments(project)
  const existing = ensured.formatDocuments?.[formatKey]
  const refreshedScene = refreshGenerated && existing && !existing.isEdited
    ? buildSceneForProject(ensured, formatKey)
    : null
  const refreshedFormat = refreshedScene
    ? applyLayoutDensity(
        getFormat(formatKey, ensured.customFormats),
        ensured.formatDensities?.[formatKey] ?? ensured.layoutDensity,
      )
    : null
  const document = refreshedScene && refreshedFormat && existing
    ? {
        ...existing,
        format: refreshedFormat,
        scene: refreshedScene,
        objects: updateObjectsFromScene(refreshedScene, existing.objects, refreshedFormat),
      }
    : existing
  if (!document) return { ...ensured, activeFormatKey: formatKey, editorMode: 'edit' }
  const activeObjectId =
    document.activeObjectId ??
    document.objects.find((object) => object.type === 'title' && object.visible)?.id ??
    document.objects.find((object) => object.visible && object.type !== 'background')?.id ??
    document.objects[0]?.id
  return {
    ...ensured,
    activeFormatKey: formatKey,
    activeObjectId,
    editorMode: 'edit',
    formatDocuments: {
      ...(ensured.formatDocuments ?? {}),
      [formatKey]: {
        ...document,
        activeObjectId,
      },
    },
  }
}

export function exitFormatEditMode(project: Project): Project {
  const { activeFormatKey: _activeFormatKey, activeObjectId: _activeObjectId, editorMode: _editorMode, ...rest } = project
  return { ...rest, editorMode: 'preview' }
}

function sceneWithAssetsForFormat(project: Project, formatKey: FormatKey): Scene {
  const m = project.master
  const imageSrc = getActiveImageSrc(project, formatKey)
  const imageFit = getActiveImageFitMode(project, formatKey)
  return {
    ...m,
    image: m.image ? { ...m.image, src: imageSrc, fit: imageFit } : m.image,
    logo: m.logo ? { ...m.logo, src: project.logoSrc } : m.logo,
  }
}

function computeImageFitDecisions(project: Project): NonNullable<Project['imageFitDecisionByFormat']> {
  const decisions: NonNullable<Project['imageFitDecisionByFormat']> = {}
  const preference = project.imageFitPreference ?? 'auto'
  for (const formatKey of project.selectedFormats) {
    const measurementScene = buildMeasurementSceneForImageFit(project, formatKey)
    const rules = applyLayoutDensity(
      getFormat(formatKey, project.customFormats),
      project.formatDensities?.[formatKey] ?? project.layoutDensity,
    )
    const image = measurementScene.image
    const imageBoxWidth = image ? (image.w / 100) * rules.width : rules.width
    const imageBoxHeight = image ? ((image.h ?? 100) / 100) * rules.height : rules.height
    const metadata = project.backgroundExtensionByFormat?.[formatKey] ?? project.backgroundExtension
    const extendedEntry = project.extendedImageByFormat?.[formatKey]
    decisions[formatKey] = resolveImageFitDecisionForFormat({
      originalImageSrc: project.imageSrc,
      extendedImageSrc: extendedEntry?.imageSrc,
      originalMetadata: metadata,
      extendedMetadata: extendedEntry?.metadata ?? metadata,
      formatKey,
      imageBoxWidth,
      imageBoxHeight,
      preference,
    })
  }
  return decisions
}

function buildMeasurementSceneForImageFit(project: Project, formatKey: FormatKey): Scene {
  const focal = project.imageFocals?.[formatKey]
  const m = project.master
  const master: Scene = {
    ...m,
    image: m.image
      ? {
          ...m.image,
          src: project.imageSrc ?? m.image.src,
          fit: 'cover',
          ...(focal ? { focalX: focal.x, focalY: focal.y } : {}),
        }
      : m.image,
  }
  return buildScene(master, formatKey, project.brandKit, project.enabled, {
    ...(project.formatOverrides?.[formatKey] ? { override: project.formatOverrides[formatKey] } : {}),
    assetHint: project.assetHint,
    blockOverrides: project.blockOverrides?.[formatKey],
    locale: project.activeLocale,
    customFormats: project.customFormats,
    density: project.formatDensities?.[formatKey] ?? project.layoutDensity,
  })
}

function hasBackgroundExtensionMetadataForAllFormats(project: Project): boolean {
  const byFormat = project.backgroundExtensionByFormat ?? {}
  return project.selectedFormats.every((formatKey) => !!byFormat[formatKey])
}

function normalizeBackgroundExtensionState(project: Project): Project {
  const formatOverrides = normalizeFormatOverrides(project.formatOverrides)
  const hasPerFormatMetadata = Object.keys(project.backgroundExtensionByFormat ?? {}).length > 0
  const hasPerFormatImage = Object.values(project.extendedImageByFormat ?? {}).some((entry) => entry.metadata.changed && !!entry.imageSrc)
  if (project.backgroundExtension || hasPerFormatMetadata) {
    return {
      ...project,
      formatOverrides,
      backgroundExtensionStatus: project.backgroundExtensionStatus === 'failed' ? 'failed' : 'done',
      useExtendedImage: !!project.useExtendedImage && (hasPerFormatImage || !!project.extendedImageSrc),
      imageFitPreference: project.imageFitPreference ?? 'auto',
      imageFitDecisionByFormat: project.imageFitDecisionByFormat ?? {},
    }
  }
  return {
    ...project,
    formatOverrides,
    backgroundExtensionStatus: project.backgroundExtensionStatus === 'calculating' ? 'idle' : project.backgroundExtensionStatus ?? 'idle',
    useExtendedImage: false,
    imageFitPreference: project.imageFitPreference ?? 'auto',
    imageFitDecisionByFormat: project.imageFitDecisionByFormat ?? {},
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

function updateFormatDocumentObject(
  project: Project,
  formatKey: FormatKey,
  objectId: string,
  patch: Parameters<typeof updateObjectProperties>[2],
): Project {
  const document = project.formatDocuments?.[formatKey]
  if (!document) return project
  const updated = updateObjectProperties(document, objectId, patch)
  if (updated === document) return project
  return {
    ...project,
    formatDocuments: {
      ...(project.formatDocuments ?? {}),
      [formatKey]: updated,
    },
  }
}

function isBlockObjectType(type: string): type is BlockKind {
  return type === 'title' || type === 'subtitle' || type === 'cta' || type === 'badge' || type === 'logo' || type === 'image'
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
    'cropZoom',
    'cropX',
    'cropY',
    'bgOpacity',
  ] as const
  const out: Record<string, unknown> = {}
  const source = block as Record<string, unknown>
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key]
  }
  return out as BlockOverride
}
