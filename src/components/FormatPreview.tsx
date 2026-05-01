import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type WheelEvent,
} from 'react'
import { SceneRenderer } from '../renderers/SceneRenderer'
import { buildScene } from '../lib/buildScene'
import { checkOverflow, type LayoutIssue } from '../lib/fixLayout'
import { getFormat } from '../lib/formats'
import { applyLayoutDensity } from '../lib/layoutDensity'
import type {
  AssetHint,
  BlockKind,
  BlockOverride,
  BrandKit,
  CompositionModel,
  EnabledMap,
  FormatKey,
  FormatRuleSet,
  LayoutDensity,
  Scene,
} from '../lib/types'

type Props = {
  formatKey: FormatKey
  master: Scene
  brandKit: BrandKit
  enabled: EnabledMap
  override?: CompositionModel
  /** Per-format image focal point override. When absent, master.image focal is used. */
  focal?: { x: number; y: number }
  /** Analyzed image stats. Used by hero-overlay to auto-tune scrim opacity. */
  assetHint?: AssetHint | null
  onPickElement: (kind: BlockKind) => void
  onFix: (formatKey: FormatKey) => void
  /** Shift-click on the image hotspot → set per-format focal in
   *  normalized [0..1] coords relative to the image block. Passing null
   *  (Shift+Alt+click) clears the override back to master focal. */
  onSetFocal?: (formatKey: FormatKey, focal: { x: number; y: number } | null) => void
  /** Double-click on a text hotspot → open inline editor, commit via this. */
  onSetBlockText?: (kind: 'title' | 'subtitle' | 'cta' | 'badge', text: string) => void
  blockOverride?: Partial<Record<BlockKind, BlockOverride>>
  density?: LayoutDensity
  isCustom?: boolean
  onEnableCustom?: (formatKey: FormatKey, scene: Scene) => void
  onDisableCustom?: (formatKey: FormatKey) => void
  onCopyLayout?: (layout: Partial<Record<BlockKind, BlockOverride>>) => void
  onPasteLayout?: () => void
  canPaste?: boolean
  locale?: string
  customFormats?: FormatRuleSet[]
}

type EditableTextKind = 'title' | 'subtitle' | 'cta' | 'badge'

export type FormatPreviewHandle = {
  svgEl: SVGSVGElement | null
}

const FormatPreviewBase = forwardRef<FormatPreviewHandle, Props>(function FormatPreview(
  {
    formatKey,
    master,
    brandKit,
    enabled,
    override,
    focal,
    assetHint,
    onPickElement,
    onFix,
    onSetFocal,
    onSetBlockText,
    blockOverride,
    density,
    isCustom,
    onEnableCustom,
    onDisableCustom,
    onCopyLayout,
    onPasteLayout,
    canPaste,
    locale,
    customFormats,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [showGuides, setShowGuides] = useState(false)
  const [editing, setEditing] = useState<EditableTextKind | null>(null)
  const [view, setView] = useState<{ zoom: number; tx: number; ty: number }>({
    zoom: 1,
    tx: 0,
    ty: 0,
  })
  // Space held → drag-to-pan mode. Tracked at the component level so the
  // cursor + pointer-events hint update globally for this preview.
  const [panReady, setPanReady] = useState(false)
  const panState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const zoomed = view.zoom !== 1 || view.tx !== 0 || view.ty !== 0

  const resetView = useCallback(() => setView({ zoom: 1, tx: 0, ty: 0 }), [])

  // Ctrl/Cmd+wheel → zoom toward cursor. Regular wheel stays for page scroll.
  const onWheel = useCallback(
    (ev: WheelEvent<HTMLDivElement>) => {
      if (!(ev.ctrlKey || ev.metaKey)) return
      ev.preventDefault()
      const el = stageRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = ev.clientX - rect.left
      const cy = ev.clientY - rect.top
      setView((v) => {
        const factor = Math.exp(-ev.deltaY * 0.0015)
        const nextZoom = Math.max(1, Math.min(6, v.zoom * factor))
        if (nextZoom === v.zoom) return v
        // keep the cursor point fixed: solve tx'/ty' so the world point under
        // the cursor stays under the cursor after zoom.
        const k = nextZoom / v.zoom
        const tx = cx - k * (cx - v.tx)
        const ty = cy - k * (cy - v.ty)
        // clamp pan so stage can't drift fully off-screen
        const maxX = (nextZoom - 1) * rect.width
        const maxY = (nextZoom - 1) * rect.height
        return {
          zoom: nextZoom,
          tx: clampNum(tx, -maxX, 0),
          ty: clampNum(ty, -maxY, 0),
        }
      })
    },
    [],
  )

  // Space key (when not typing) arms pan-drag mode.
  useEffect(() => {
    function isTyping(): boolean {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }
    function down(e: KeyboardEvent) {
      if (e.code === 'Space' && !isTyping()) {
        e.preventDefault()
        setPanReady(true)
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === 'Space') setPanReady(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onMouseDown = useCallback(
    (ev: MouseEvent<HTMLDivElement>) => {
      if (!(panReady || ev.button === 1)) return
      ev.preventDefault()
      panState.current = {
        x: ev.clientX,
        y: ev.clientY,
        tx: view.tx,
        ty: view.ty,
      }
    },
    [panReady, view.tx, view.ty],
  )

  // Drag/release handlers on window so release outside the stage still cleans up.
  useEffect(() => {
    function move(e: globalThis.MouseEvent) {
      const st = panState.current
      if (!st) return
      const el = stageRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setView((v) => {
        const maxX = (v.zoom - 1) * rect.width
        const maxY = (v.zoom - 1) * rect.height
        return {
          zoom: v.zoom,
          tx: clampNum(st.tx + (e.clientX - st.x), -maxX, 0),
          ty: clampNum(st.ty + (e.clientY - st.y), -maxY, 0),
        }
      })
    }
    function up() {
      panState.current = null
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    get svgEl() {
      return svgRef.current
    },
  }))

  const rules = applyLayoutDensity(getFormat(formatKey, customFormats), density)
  const aspectClass = rules.aspectRatio > 4
    ? ' preview--ultrawide'
    : rules.aspectRatio > 1.25
      ? ' preview--wide'
      : rules.aspectRatio < 0.8
        ? ' preview--tall'
        : ' preview--square'
  // Apply per-format focal override onto master.image before building the scene
  // so the override flows through layout + SVG rendering identically to master.
  const effectiveMaster = useMemo<Scene>(() => {
    if (!focal || !master.image) return master
    return {
      ...master,
      image: { ...master.image, focalX: focal.x, focalY: focal.y },
    }
  }, [master, focal])
  const scene = useMemo(
    () =>
      buildScene(effectiveMaster, formatKey, brandKit, enabled, {
        ...(override ? { override } : {}),
        assetHint,
        blockOverrides: blockOverride,
        locale,
        customFormats,
        density,
      }),
    [effectiveMaster, formatKey, brandKit, enabled, override, assetHint, blockOverride, locale, customFormats, density],
  )
  const issues = useMemo(() => checkOverflow(scene, rules), [scene, rules])

  return (
    <article className={`preview${aspectClass}`}>
      <header className="preview__head">
        <div>
          <div className="preview__title">{rules.label}</div>
          <div className="preview__dim">{rules.width}×{rules.height}</div>
        </div>
        <div className="preview__head-actions">
          <IssuesBadge issues={issues} />
          <button
            type="button"
            className={`btn btn-ghost btn-xs preview__mode${isCustom ? ' is-on' : ''}`}
            onClick={() => isCustom ? onDisableCustom?.(formatKey) : onEnableCustom?.(formatKey, scene)}
            title={isCustom ? 'Использовать master-настройки' : 'Настроить этот формат отдельно'}
            aria-pressed={!!isCustom}
          >
            {isCustom ? 'Отдельно' : 'Настроить'}
          </button>
          {zoomed ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={resetView}
              title={`Сбросить масштаб и сдвиг (${Math.round(view.zoom * 100)}%)`}
            >
              {Math.round(view.zoom * 100)}%✕
            </button>
          ) : null}
          <button
            type="button"
            className={`btn btn-ghost btn-xs btn-icon${showGuides ? ' is-on' : ''}`}
            onClick={() => setShowGuides((v) => !v)}
            title="Показать/скрыть safe-area"
            aria-pressed={showGuides}
            aria-label="Показать/скрыть safe-area"
          >
            ⌗
          </button>
          <button
            className="btn btn-ghost btn-xs btn-icon"
            onClick={() => onFix(formatKey)}
            title="Исправить макет"
            aria-label="Исправить макет"
          >
            ↻
          </button>
          <details className="kebab">
            <summary
              className="btn btn-ghost btn-xs btn-icon"
              aria-label="Еще действия с превью"
              title="Еще действия"
            >
              ⋯
            </summary>
            <div className="kebab__menu" role="menu">
              <button
                type="button"
                className="kebab__item"
                role="menuitem"
                onClick={() => isCustom ? onDisableCustom?.(formatKey) : onEnableCustom?.(formatKey, scene)}
              >
                {isCustom ? 'Наследовать master' : 'Настроить формат'}
              </button>
              <button
                type="button"
                className="kebab__item"
                role="menuitem"
                onClick={() => onCopyLayout?.(extractLayout(scene))}
                disabled={!onCopyLayout}
              >
                Скопировать макет
              </button>
              <button
                type="button"
                className="kebab__item"
                role="menuitem"
                onClick={() => onPasteLayout?.()}
                disabled={!onPasteLayout || !canPaste}
              >
                Вставить макет
              </button>
            </div>
          </details>
        </div>
      </header>
      <div
        ref={stageRef}
        className={`preview__stage${panReady ? ' preview__stage--pan-ready' : ''}${panState.current ? ' preview__stage--panning' : ''}`}
        style={{ aspectRatio: `${rules.width} / ${rules.height}` }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        <div
          className="preview__transform"
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <SceneRenderer
            ref={svgRef}
            scene={scene}
            rules={rules}
            displayFont={brandKit.displayFont}
            textFont={brandKit.textFont}
            brandInitials={brandKit.brandName}
            brandColor={brandKit.palette.accent}
            className="preview__svg"
          />
          <PreviewHotspots
            scene={scene}
            onPick={onPickElement}
            onImageShiftClick={
              onSetFocal
                ? (ev, imgBlock) => handleImageShiftClick(ev, imgBlock, formatKey, onSetFocal)
                : undefined
            }
            onTextDoubleClick={onSetBlockText ? (kind) => setEditing(kind) : undefined}
          />
          {showGuides ? <SafeAreaOverlay safeZone={rules.safeZone} /> : null}
          {editing && onSetBlockText ? (
            <InlineTextEditor
              kind={editing}
              block={scene[editing]}
              onCommit={(text) => {
                onSetBlockText(editing, text)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </div>
      </div>
    </article>
  )
})

export const FormatPreview = memo(
  FormatPreviewBase,
  (prev, next) =>
    prev.formatKey === next.formatKey &&
    prev.master === next.master &&
    prev.brandKit === next.brandKit &&
    prev.enabled === next.enabled &&
    prev.override === next.override &&
    prev.focal === next.focal &&
    prev.assetHint === next.assetHint &&
    prev.blockOverride === next.blockOverride &&
    prev.density === next.density &&
    prev.isCustom === next.isCustom &&
    prev.onEnableCustom === next.onEnableCustom &&
    prev.onDisableCustom === next.onDisableCustom &&
    prev.onPickElement === next.onPickElement &&
    prev.onFix === next.onFix &&
    prev.onSetFocal === next.onSetFocal &&
    prev.onSetBlockText === next.onSetBlockText &&
    prev.onCopyLayout === next.onCopyLayout &&
    prev.onPasteLayout === next.onPasteLayout &&
    prev.canPaste === next.canPaste &&
    prev.locale === next.locale &&
    prev.customFormats === next.customFormats,
)

function extractLayout(scene: Scene): Partial<Record<BlockKind, BlockOverride>> {
  const out: Partial<Record<BlockKind, BlockOverride>> = {}
  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const b = scene[k]
    if (!b) continue
    out[k] = blockToOverride(b)
  }
  return out
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

function clampNum(v: number, lo: number, hi: number): number {
  if (lo > hi) return lo
  return Math.max(lo, Math.min(hi, v))
}

// Dashed outline showing the safeZone rectangle — flips on with the Guides
// toggle. Percent-based so it stays accurate at every preview size; sits on
// top of the SVG + hotspots but stays non-interactive.
function SafeAreaOverlay({
  safeZone,
}: {
  safeZone: { top: number; right: number; bottom: number; left: number }
}) {
  return (
    <div
      className="preview__guides"
      style={{
        left: `${safeZone.left}%`,
        top: `${safeZone.top}%`,
        right: `${safeZone.right}%`,
        bottom: `${safeZone.bottom}%`,
      }}
      aria-hidden="true"
    />
  )
}

// Pill showing the count of layout issues with a tooltip listing them.
// Click toggles a popover (native <details>) so the user can actually read
// each warning without hover. Hidden entirely when there are zero issues.
function IssuesBadge({ issues }: { issues: LayoutIssue[] }) {
  if (issues.length === 0) return null
  const warnCount = issues.filter((i) => i.level === 'warn').length
  const cls = warnCount > 0 ? 'issues-badge issues-badge--warn' : 'issues-badge issues-badge--info'
  return (
    <details className="issues">
      <summary
        className={cls}
        title={issues.map((i) => `• ${i.message}`).join('\n')}
      >
        ⚠ {issues.length}
      </summary>
      <ul className="issues__list" role="list">
        {issues.map((i, idx) => (
          <li key={idx} className={`issues__item issues__item--${i.level}`}>
            {i.message}
          </li>
        ))}
      </ul>
    </details>
  )
}

function PreviewHotspots({
  scene,
  onPick,
  onImageShiftClick,
  onTextDoubleClick,
}: {
  scene: Scene
  onPick: (kind: BlockKind) => void
  onImageShiftClick?: (
    ev: MouseEvent<HTMLButtonElement>,
    imgBlock: { x: number; y: number; w: number; h?: number },
  ) => void
  onTextDoubleClick?: (kind: EditableTextKind) => void
}) {
  const targets: BlockKind[] = ['title', 'subtitle', 'cta', 'badge', 'logo', 'image']
  const editable = new Set<BlockKind>(['title', 'subtitle', 'cta', 'badge'])
  return (
    <div className="preview__hotspots">
      {targets.map((k) => {
        const b = scene[k]
        if (!b) return null
        const isImage = k === 'image'
        const isEditable = editable.has(k) && !!onTextDoubleClick
        const hint = isImage && onImageShiftClick
          ? `${labelForHotspot(k)} (Shift-click: задать фокус, Shift+Alt: сбросить)`
          : isEditable
            ? `${labelForHotspot(k)} (двойной клик: редактировать)`
            : labelForHotspot(k)
        return (
          <button
            key={k}
            type="button"
            className="hotspot"
            title={hint}
            onClick={(ev) => {
              if (isImage && ev.shiftKey && onImageShiftClick) {
                onImageShiftClick(ev, b)
                return
              }
              onPick(k)
            }}
            onDoubleClick={() => {
              if (isEditable) onTextDoubleClick!(k as EditableTextKind)
            }}
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h ?? 6}%`,
            }}
          />
        )
      })}
    </div>
  )
}

function labelForHotspot(kind: BlockKind | EditableTextKind): string {
  switch (kind) {
    case 'title':
      return 'Заголовок'
    case 'subtitle':
      return 'Подзаголовок'
    case 'cta':
      return 'Кнопка'
    case 'badge':
      return 'Бейдж'
    case 'logo':
      return 'Логотип'
    case 'image':
      return 'Изображение'
    default:
      return kind
  }
}

// Positioned textarea on top of the preview. Commits on Enter or blur,
// cancels on Escape. Shift+Enter inserts a literal newline.
function InlineTextEditor({
  kind,
  block,
  onCommit,
  onCancel,
}: {
  kind: EditableTextKind
  block: { x: number; y: number; w: number; h?: number; text?: string; fontSize?: number } | undefined
  onCommit: (text: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<string>(block?.text ?? '')
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])
  if (!block) return null
  return (
    <textarea
      ref={taRef}
      className="inline-edit"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onCommit(draft)
        }
      }}
      spellCheck={false}
      aria-label={`Редактировать текст: ${labelForHotspot(kind)}`}
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.w}%`,
        minHeight: `${block.h ?? 6}%`,
        fontSize: `${(block.fontSize ?? 4) * 0.9}cqw`,
      }}
    />
  )
}

// Compute image-local [0..1] focal from the click coordinates on the image
// hotspot. Shift+Alt resets to master (passes null).
function handleImageShiftClick(
  ev: MouseEvent<HTMLButtonElement>,
  _img: { x: number; y: number; w: number; h?: number },
  formatKey: FormatKey,
  setFocal: (formatKey: FormatKey, focal: { x: number; y: number } | null) => void,
) {
  if (ev.altKey) {
    setFocal(formatKey, null)
    return
  }
  const rect = ev.currentTarget.getBoundingClientRect()
  const fx = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0.5
  const fy = rect.height > 0 ? (ev.clientY - rect.top) / rect.height : 0.5
  setFocal(formatKey, {
    x: Math.max(0, Math.min(1, fx)),
    y: Math.max(0, Math.min(1, fy)),
  })
}
