// Figma-like modal editor for one format. The user opens it with a button on
// any preview, drags + resizes blocks freely, optionally edits text inline,
// and saves back into the project's per-format `blockOverrides`. From the
// modal they can also push the result to other formats — that part is
// delegated up via `onPropagate`.
//
// Coordinate system everywhere here is the same as the rest of the app:
// percentages of the format's canvas (0..100). Mouse deltas are converted
// using the rendered stage rect, so the editor works at any zoom / window
// size without doing math in pixels internally.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { SceneRenderer } from '../renderers/SceneRenderer'
import { buildScene } from '../lib/buildScene'
import { applyLayoutDensity } from '../lib/layoutDensity'
import { getFormat } from '../lib/formats'
import { FONT_PAIRS } from '../lib/fontPairs'
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
  TextAlign,
} from '../lib/types'

type EditableBlocks = Partial<Record<BlockKind, BlockOverride>>

type Props = {
  formatKey: FormatKey
  master: Scene
  brandKit: BrandKit
  enabled: EnabledMap
  override?: CompositionModel
  focal?: { x: number; y: number }
  density?: LayoutDensity
  customFormats?: FormatRuleSet[]
  assetHint?: AssetHint | null
  blockOverride?: EditableBlocks
  locale?: string
  /** Сохранить — записать новый набор overrides в проект. */
  onSave: (overrides: EditableBlocks) => void
  /** Закрыть без сохранения. */
  onCancel: () => void
  /** «Применить к другим форматам» — открыть диалог выбора целей. */
  onPropagate: (overrides: EditableBlocks) => void
}

const EDITABLE_KINDS: BlockKind[] = ['title', 'subtitle', 'cta', 'badge', 'logo', 'image']
const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type HandleDir = (typeof HANDLE_DIRS)[number]

type DragState =
  | { kind: 'move'; startMouseX: number; startMouseY: number; startBlock: { x: number; y: number; w: number; h: number } }
  | { kind: 'resize'; dir: HandleDir; startMouseX: number; startMouseY: number; startBlock: { x: number; y: number; w: number; h: number }; aspect: number; preserveAspect: boolean }
  | { kind: 'pan'; startMouseX: number; startMouseY: number; startBlock: { x: number; y: number; w: number; h: number }; startCropX: number; startCropY: number }
  | null

const SNAP_TOLERANCE = 1.0 // % — snap to safe-zone edges within this distance
const MIN_W = 4
const MIN_H = 2
// cropX / cropY are stored as % of block width/height. The renderer clamps
// them to ±50% — beyond that the image's edge would pull inside the frame
// and the user would see a transparent gap. Same range is enforced here so
// the slider and the visual drag can't disagree.
const CROP_PAN_LIMIT = 50
const CROP_ZOOM_MIN = 1
const CROP_ZOOM_MAX = 3

export function LayoutEditor({
  formatKey,
  master,
  brandKit,
  enabled,
  override,
  focal,
  density,
  customFormats,
  assetHint,
  blockOverride,
  locale,
  onSave,
  onCancel,
  onPropagate,
}: Props) {
  const rules = useMemo(
    () => applyLayoutDensity(getFormat(formatKey, customFormats), density),
    [formatKey, customFormats, density],
  )

  const effectiveMaster = useMemo<Scene>(() => {
    if (!focal || !master.image) return master
    return { ...master, image: { ...master.image, focalX: focal.x, focalY: focal.y } }
  }, [master, focal])

  // "Skeleton" scene: what the layout would produce *without* any per-format
  // overrides. Used by the layers list to enumerate every block the format
  // supports — even blocks the user previously hid via override stay
  // listed (with the eye icon off) so they can be turned back on.
  const baselineScene = useMemo(
    () =>
      buildScene(effectiveMaster, formatKey, brandKit, enabled, {
        ...(override ? { override } : {}),
        assetHint,
        locale,
        customFormats,
        density,
      }),
    [effectiveMaster, formatKey, brandKit, enabled, override, assetHint, locale, customFormats, density],
  )

  // Initial draft = whatever was already overridden + the geometry of any
  // currently-rendered block that the user might want to grab. Pulling from
  // the rendered scene means the user can drag a block that was never
  // explicitly overridden before and the editor shows its current position.
  const [draft, setDraft] = useState<EditableBlocks>(() => seedDraft(baselineScene, blockOverride))
  const [history, setHistory] = useState<EditableBlocks[]>([])
  const [redoStack, setRedoStack] = useState<EditableBlocks[]>([])
  const [selected, setSelected] = useState<BlockKind | null>(null)
  const [dragState, setDragState] = useState<DragState>(null)
  const [snapping, setSnapping] = useState(true)
  const [editingText, setEditingText] = useState<BlockKind | null>(null)
  // Visual crop tool for the image block. When on, dragging inside the image
  // pans (cropX/cropY) and the wheel zooms (cropZoom). The regular move/resize
  // affordances on the image hide so the two interaction models don't fight.
  const [cropMode, setCropMode] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)

  // Re-render the scene every time draft changes, keeping all the same
  // composition + brand pipeline. The editor is just a "set overrides"
  // stage; visual fidelity comes from the same renderer the previews use.
  const scene = useMemo(
    () =>
      buildScene(effectiveMaster, formatKey, brandKit, enabled, {
        ...(override ? { override } : {}),
        assetHint,
        blockOverrides: draft,
        locale,
        customFormats,
        density,
      }),
    [effectiveMaster, formatKey, brandKit, enabled, override, assetHint, draft, locale, customFormats, density],
  )

  const pushHistory = useCallback((prev: EditableBlocks) => {
    setHistory((h) => [...h.slice(-49), prev])
    setRedoStack([])
  }, [])

  const updateBlock = useCallback(
    (kind: BlockKind, patch: Partial<BlockOverride>) => {
      setDraft((d) => {
        const current = d[kind] ?? {}
        const next: BlockOverride = { ...current, ...patch }
        return { ...d, [kind]: next }
      })
    },
    [],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const last = h[h.length - 1]!
      setRedoStack((r) => [...r, draft])
      setDraft(last)
      return h.slice(0, -1)
    })
  }, [draft])

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r
      const last = r[r.length - 1]!
      setHistory((h) => [...h, draft])
      setDraft(last)
      return r.slice(0, -1)
    })
  }, [draft])

  // --- Pointer interaction --------------------------------------------------
  const onBlockPointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLDivElement>, kind: BlockKind) => {
      if (editingText) return
      ev.stopPropagation()
      setSelected(kind)
      const block = blockGeometry(scene, kind)
      if (!block) return
      pushHistory(draft)
      ev.currentTarget.setPointerCapture(ev.pointerId)
      // Image block in crop mode + Alt: drag pans the image *inside* the
      // frame (changes cropX/cropY). Without Alt, drag moves the frame on
      // the canvas — that's what users intuitively expect: "the orange
      // rectangle is the slot, I drag it where I want".
      if (kind === 'image' && cropMode && ev.altKey) {
        const imgBlock = scene.image as { cropX?: number; cropY?: number } | undefined
        setDragState({
          kind: 'pan',
          startMouseX: ev.clientX,
          startMouseY: ev.clientY,
          startBlock: block,
          startCropX: imgBlock?.cropX ?? 0,
          startCropY: imgBlock?.cropY ?? 0,
        })
        return
      }
      setDragState({
        kind: 'move',
        startMouseX: ev.clientX,
        startMouseY: ev.clientY,
        startBlock: block,
      })
    },
    [cropMode, draft, editingText, pushHistory, scene],
  )

  const onHandlePointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLButtonElement>, kind: BlockKind, dir: HandleDir) => {
      ev.stopPropagation()
      ev.preventDefault()
      setSelected(kind)
      const block = blockGeometry(scene, kind)
      if (!block) return
      pushHistory(draft)
      ev.currentTarget.setPointerCapture(ev.pointerId)
      setDragState({
        kind: 'resize',
        dir,
        startMouseX: ev.clientX,
        startMouseY: ev.clientY,
        startBlock: block,
        aspect: block.h > 0 ? block.w / block.h : 1,
        preserveAspect: kind === 'image' || kind === 'logo',
      })
    },
    [draft, pushHistory, scene],
  )

  const onPointerMove = useCallback(
    (ev: globalThis.PointerEvent) => {
      if (!dragState || !selected || !stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const dxPct = ((ev.clientX - dragState.startMouseX) / rect.width) * 100
      const dyPct = ((ev.clientY - dragState.startMouseY) / rect.height) * 100

      if (dragState.kind === 'move') {
        const sb = dragState.startBlock
        let nx = sb.x + dxPct
        let ny = sb.y + dyPct
        if (snapping) {
          ;({ x: nx, y: ny } = snapBox({ x: nx, y: ny, w: sb.w, h: sb.h }, rules))
        }
        nx = clamp(nx, -10, 100 - sb.w + 10)
        ny = clamp(ny, -10, 100 - sb.h + 10)
        // Move only updates x/y — crop offsets, fit, focal etc. are kept so
        // user crop work isn't silently destroyed by a small reposition.
        // If the user wants a clean cover-fit at the new spot, the
        // "⤢ Заполнить рамку" button in the side panel does that explicitly.
        updateBlock(selected, { x: round(nx), y: round(ny) })
        return
      }

      if (dragState.kind === 'pan') {
        // Convert stage % delta into block-local % delta. cropX/cropY are
        // stored as % of block width/height — moving the cursor 1% of the
        // stage right shifts the image inside a 50%-wide block by 2% of
        // the block's width, hence the divide.
        const sb = dragState.startBlock
        if (sb.w <= 0 || sb.h <= 0) return
        const dCropX = (dxPct / sb.w) * 100
        const dCropY = (dyPct / sb.h) * 100
        const nextX = clamp(dragState.startCropX + dCropX, -CROP_PAN_LIMIT, CROP_PAN_LIMIT)
        const nextY = clamp(dragState.startCropY + dCropY, -CROP_PAN_LIMIT, CROP_PAN_LIMIT)
        updateBlock(selected, { cropX: round(nextX), cropY: round(nextY) })
        return
      }

      if (dragState.kind === 'resize') {
        const sb = dragState.startBlock
        const dir = dragState.dir
        let { x, y, w, h } = sb
        const preserveAspect = dragState.preserveAspect || ev.shiftKey
        const ratio = dragState.aspect

        if (dir.includes('e')) w = Math.max(MIN_W, sb.w + dxPct)
        if (dir.includes('w')) {
          w = Math.max(MIN_W, sb.w - dxPct)
          x = sb.x + (sb.w - w)
        }
        if (dir.includes('s')) h = Math.max(MIN_H, sb.h + dyPct)
        if (dir.includes('n')) {
          h = Math.max(MIN_H, sb.h - dyPct)
          y = sb.y + (sb.h - h)
        }

        if (preserveAspect && ratio > 0) {
          // For corner handles, follow the dominant axis; for edge handles,
          // adjust the other axis directly off the changed one.
          if (dir === 'n' || dir === 's') {
            const newW = h * ratio
            x = x + (w - newW) / 2
            w = newW
          } else if (dir === 'e' || dir === 'w') {
            const newH = w / ratio
            y = y + (h - newH) / 2
            h = newH
          } else {
            const wFromH = h * ratio
            const hFromW = w / ratio
            if (Math.abs(wFromH - w) < Math.abs(hFromW - h)) {
              if (dir.includes('w')) x = x + (w - wFromH)
              w = wFromH
            } else {
              if (dir.includes('n')) y = y + (h - hFromW)
              h = hFromW
            }
          }
        }

        updateBlock(selected, {
          x: round(x),
          y: round(y),
          w: round(w),
          h: round(h),
        })
        return
      }
    },
    [dragState, rules, selected, snapping, updateBlock],
  )

  const onPointerUp = useCallback(() => {
    setDragState(null)
  }, [])

  // Wheel inside the cropping image block adjusts cropZoom. Step is small so
  // a single notch (≈ 100 px deltaY on a typical mouse) feels like a 5 %
  // zoom change — enough to be useful, slow enough to be controllable.
  const onCropWheel = useCallback(
    (ev: ReactWheelEvent<HTMLDivElement>) => {
      if (!cropMode || selected !== 'image') return
      ev.preventDefault()
      const block = scene.image as { cropZoom?: number; cropX?: number; cropY?: number } | undefined
      if (!block) return
      // Negative deltaY = scroll up = "zoom in" (the macOS/Figma convention).
      const step = -ev.deltaY * 0.0015
      const next = clamp((block.cropZoom ?? 1) + step, CROP_ZOOM_MIN, CROP_ZOOM_MAX)
      // Zooming back to 1× has no panning room — clear stale crop offsets so
      // the image isn't mysteriously off-center after the user "un-zooms".
      const patch: Partial<BlockOverride> = { cropZoom: round(next) }
      if (next <= CROP_ZOOM_MIN + 0.001) {
        patch.cropX = 0
        patch.cropY = 0
      } else {
        // Re-clamp existing offsets to the new zoom's pan range.
        const limit = (next - 1) * 50
        patch.cropX = clamp(block.cropX ?? 0, -limit, limit)
        patch.cropY = clamp(block.cropY ?? 0, -limit, limit)
      }
      updateBlock('image', patch)
    },
    [cropMode, scene.image, selected, updateBlock],
  )

  useEffect(() => {
    if (!dragState) return
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, onPointerMove, onPointerUp])

  // Crop mode is meaningful only while the image block is the active one.
  // If the user picks another layer (or deselects), turn it off automatically
  // so the next selection's normal interactions kick in.
  useEffect(() => {
    if (cropMode && selected !== 'image') setCropMode(false)
  }, [cropMode, selected])

  // --- Keyboard -------------------------------------------------------------
  // Esc closes the modal, Enter saves. Arrow keys nudge the selected block
  // (1% per press, 0.1% with Shift+Alt for fine, 5% with Shift). Ctrl+Z/Y
  // undo/redo. Skips when an inline editor is focused.
  const onKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      if (editingText) return
      const target = ev.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (ev.key === 'Escape') {
        ev.preventDefault()
        onCancel()
        return
      }
      const mod = ev.ctrlKey || ev.metaKey
      if (mod && ev.key.toLowerCase() === 'z') {
        ev.preventDefault()
        if (ev.shiftKey) redo()
        else undo()
        return
      }
      if (mod && ev.key.toLowerCase() === 'y') {
        ev.preventDefault()
        redo()
        return
      }
      if (!selected) return
      const block = blockGeometry(scene, selected)
      if (!block) return
      const step = ev.shiftKey ? 5 : ev.altKey ? 0.1 : 1
      let dx = 0
      let dy = 0
      if (ev.key === 'ArrowLeft') dx = -step
      else if (ev.key === 'ArrowRight') dx = step
      else if (ev.key === 'ArrowUp') dy = -step
      else if (ev.key === 'ArrowDown') dy = step
      else return
      ev.preventDefault()
      pushHistory(draft)
      updateBlock(selected, {
        x: round(block.x + dx),
        y: round(block.y + dy),
      })
    },
    [draft, editingText, onCancel, pushHistory, redo, scene, selected, undo, updateBlock],
  )

  return (
    <div
      className="layout-editor"
      role="dialog"
      aria-modal="true"
      aria-label={`Редактор макета: ${rules.label}`}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <div className="layout-editor__backdrop" onClick={onCancel} aria-hidden="true" />
      <div className="layout-editor__panel">
        <header className="layout-editor__header">
          <div className="layout-editor__title">
            <strong>{rules.label}</strong>
            <span className="layout-editor__dim">{rules.width}×{rules.height}</span>
          </div>
          <div className="layout-editor__toolbar">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={undo}
              disabled={history.length === 0}
              title="Отменить (Ctrl+Z)"
            >
              Назад
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Повторить (Ctrl+Shift+Z)"
            >
              Вперёд
            </button>
            <label className="layout-editor__snap">
              <input
                type="checkbox"
                checked={snapping}
                onChange={(e) => setSnapping(e.target.checked)}
              />
              <span>Прилипать к safe-zone</span>
            </label>
            <div className="layout-editor__spacer" />
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onPropagate(draft)}
              title="Применить эту раскладку к другим форматам"
            >
              Применить к другим…
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={onCancel}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={() => onSave(draft)}
            >
              Сохранить
            </button>
          </div>
        </header>

        <div className="layout-editor__body">
          <div className="layout-editor__stage-wrap">
            <div
              ref={stageRef}
              className="layout-editor__stage"
              style={{ aspectRatio: `${rules.width} / ${rules.height}` }}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) setSelected(null)
              }}
            >
              <SceneRenderer
                scene={scene}
                rules={rules}
                displayFont={brandKit.displayFont}
                textFont={brandKit.textFont}
                brandInitials={brandKit.brandName}
                brandColor={brandKit.palette.accent}
                imageAspectRatio={assetHint?.aspectRatio ?? null}
                className="layout-editor__svg"
              />
              <SafeZoneOverlay safeZone={rules.safeZone} />
              {selected === 'image' && scene.image?.src ? (
                <CropPreview
                  imageBlock={scene.image}
                  block={blockGeometry(scene, 'image')}
                  cropMode={cropMode}
                />
              ) : null}
              <BlockOverlays
                scene={scene}
                selected={selected}
                cropMode={cropMode}
                onSelect={(k) => {
                  setSelected(k)
                  if (k !== 'image') setCropMode(false)
                }}
                onPointerDown={onBlockPointerDown}
                onResizePointerDown={onHandlePointerDown}
                onDoubleClick={(k) => {
                  if (k === 'title' || k === 'subtitle' || k === 'cta' || k === 'badge') {
                    setEditingText(k)
                  }
                }}
                onCropWheel={onCropWheel}
              />
              {editingText ? (
                <InlineTextField
                  block={blockGeometry(scene, editingText)}
                  initialText={readText(scene, editingText) ?? ''}
                  onCommit={(text) => {
                    pushHistory(draft)
                    setDraft((d) => {
                      const current = d[editingText] ?? {}
                      return { ...d, [editingText]: { ...current, text } }
                    })
                    setEditingText(null)
                  }}
                  onCancel={() => setEditingText(null)}
                />
              ) : null}
            </div>
          </div>

          <aside className="layout-editor__side">
            <LayersList
              baseline={baselineScene}
              scene={scene}
              draft={draft}
              selected={selected}
              onSelect={setSelected}
              onToggleVisibility={(kind, visible) => {
                pushHistory(draft)
                setDraft((d) => {
                  const current = d[kind] ?? {}
                  const next: BlockOverride = visible
                    ? { ...current, hidden: false }
                    : { ...current, hidden: true }
                  return { ...d, [kind]: next }
                })
              }}
            />
            <SidePanel
              selected={selected}
              scene={scene}
              baseline={baselineScene}
              brandKit={brandKit}
              draft={draft}
              cropMode={cropMode}
              onToggleCropMode={(next) => setCropMode(next)}
              onChange={(kind, patch) => {
                pushHistory(draft)
                updateBlock(kind, patch)
              }}
              onReset={(kind) => {
                pushHistory(draft)
                setDraft((d) => {
                  const next = { ...d }
                  delete next[kind]
                  return next
                })
              }}
              onToggleVisibility={(kind, visible) => {
                pushHistory(draft)
                setDraft((d) => {
                  const current = d[kind] ?? {}
                  const next: BlockOverride = visible
                    ? { ...current, hidden: false }
                    : { ...current, hidden: true }
                  return { ...d, [kind]: next }
                })
              }}
            />
            <div className="layout-editor__hint">
              <strong>Подсказки</strong>
              <ul>
                <li>Клик — выбрать. Перетащить — переместить.</li>
                <li>Ручки по углам и краям меняют размер. Shift — пропорции.</li>
                <li>Двойной клик по тексту — редактировать.</li>
                <li>Стрелки сдвигают на 1%, Shift — на 5%, Alt — на 0,1%.</li>
                <li>Ctrl+Z / Ctrl+Shift+Z — отменить / повторить.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ----- Helpers ------------------------------------------------------------

function seedDraft(scene: Scene, existing: EditableBlocks | undefined): EditableBlocks {
  const out: EditableBlocks = { ...(existing ?? {}) }
  for (const k of EDITABLE_KINDS) {
    const b = scene[k]
    if (!b) continue
    if (out[k]) continue
    out[k] = {
      x: b.x,
      y: b.y,
      w: b.w,
      ...(b.h !== undefined ? { h: b.h } : {}),
    }
  }
  return out
}

function blockGeometry(scene: Scene, kind: BlockKind): { x: number; y: number; w: number; h: number } | null {
  const b = scene[kind]
  if (!b) return null
  return { x: b.x, y: b.y, w: b.w, h: b.h ?? defaultH(kind) }
}

function readText(scene: Scene, kind: BlockKind): string | undefined {
  const b = scene[kind]
  if (!b) return undefined
  if ('text' in b) return b.text
  return undefined
}

function defaultH(kind: BlockKind): number {
  if (kind === 'image') return 50
  if (kind === 'logo') return 6
  if (kind === 'cta') return 7
  return 12
}

function snapBox(
  box: { x: number; y: number; w: number; h: number },
  rules: FormatRuleSet,
): { x: number; y: number } {
  const safeLeft = rules.safeZone.left
  const safeRight = 100 - rules.safeZone.right
  const safeTop = rules.safeZone.top
  const safeBottom = 100 - rules.safeZone.bottom
  let x = box.x
  let y = box.y
  if (Math.abs(x - safeLeft) <= SNAP_TOLERANCE) x = safeLeft
  else if (Math.abs(x + box.w - safeRight) <= SNAP_TOLERANCE) x = safeRight - box.w
  else if (Math.abs(x + box.w / 2 - 50) <= SNAP_TOLERANCE) x = 50 - box.w / 2
  if (Math.abs(y - safeTop) <= SNAP_TOLERANCE) y = safeTop
  else if (Math.abs(y + box.h - safeBottom) <= SNAP_TOLERANCE) y = safeBottom - box.h
  else if (Math.abs(y + box.h / 2 - 50) <= SNAP_TOLERANCE) y = 50 - box.h / 2
  return { x, y }
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo
  return Math.max(lo, Math.min(hi, v))
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}

function labelFor(kind: BlockKind): string {
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

// ----- Sub-components ------------------------------------------------------

const SafeZoneOverlay = memo(function SafeZoneOverlay({
  safeZone,
}: {
  safeZone: { top: number; right: number; bottom: number; left: number }
}) {
  return (
    <div
      className="layout-editor__safe-zone"
      style={{
        left: `${safeZone.left}%`,
        top: `${safeZone.top}%`,
        right: `${safeZone.right}%`,
        bottom: `${safeZone.bottom}%`,
      }}
      aria-hidden="true"
    />
  )
})

function BlockOverlays({
  scene,
  selected,
  cropMode,
  onSelect,
  onPointerDown,
  onResizePointerDown,
  onDoubleClick,
  onCropWheel,
}: {
  scene: Scene
  selected: BlockKind | null
  /** Image-block crop tool is active — disables resize handles and shows a
   *  crop frame instead so the user can pan/zoom inside the image. */
  cropMode: boolean
  onSelect: (kind: BlockKind) => void
  onPointerDown: (ev: ReactPointerEvent<HTMLDivElement>, kind: BlockKind) => void
  onResizePointerDown: (ev: ReactPointerEvent<HTMLButtonElement>, kind: BlockKind, dir: HandleDir) => void
  onDoubleClick: (kind: BlockKind) => void
  onCropWheel: (ev: ReactWheelEvent<HTMLDivElement>) => void
}) {
  return (
    <div className="layout-editor__overlays">
      {EDITABLE_KINDS.map((k) => {
        const box = blockGeometry(scene, k)
        if (!box) return null
        const isSelected = selected === k
        const isCropping = k === 'image' && cropMode && isSelected
        const style: CSSProperties = {
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.w}%`,
          height: `${box.h}%`,
          zIndex: isSelected ? 20 : zIndex(k),
        }
        return (
          <div
            key={k}
            className={
              `layout-editor__block layout-editor__block--${k}` +
              `${isSelected ? ' is-selected' : ''}` +
              `${isCropping ? ' is-cropping' : ''}`
            }
            style={style}
            onPointerDown={(ev) => onPointerDown(ev, k)}
            onClick={() => onSelect(k)}
            onDoubleClick={() => onDoubleClick(k)}
            onWheel={isCropping ? onCropWheel : undefined}
            role="button"
            aria-label={labelFor(k)}
            tabIndex={0}
          >
            <span className="layout-editor__block-label" aria-hidden="true">
              {isCropping ? 'Кадрирование' : labelFor(k)}
            </span>
            {isCropping ? <CropGuides /> : null}
            {isSelected
              ? HANDLE_DIRS.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    className={`layout-editor__handle layout-editor__handle--${dir}`}
                    onPointerDown={(ev) => onResizePointerDown(ev, k, dir)}
                    aria-label={`Изменить размер ${dir}`}
                    title={
                      isCropping
                        ? 'Потяните, чтобы изменить рамку обрезки'
                        : 'Перетащите для изменения размера. Shift — сохранить пропорции'
                    }
                  />
                ))
              : null}
          </div>
        )
      })}
    </div>
  )
}

// Decorative thirds grid for the crop tool — same visual language as
// camera viewfinders and Figma's cropping mode, helps users compose.
function CropGuides() {
  return (
    <div className="layout-editor__crop-guides" aria-hidden="true">
      <span className="layout-editor__crop-guide layout-editor__crop-guide--v1" />
      <span className="layout-editor__crop-guide layout-editor__crop-guide--v2" />
      <span className="layout-editor__crop-guide layout-editor__crop-guide--h1" />
      <span className="layout-editor__crop-guide layout-editor__crop-guide--h2" />
    </div>
  )
}

// Source-image preview rendered *over* the SVG so the user can clearly see
// the actual photo while editing — even in dark themes where dark image
// content (black speakers, shadows, etc.) tends to blend with the canvas
// background and the SVG `<image>` becomes visually invisible. Coordinates
// MUST stay in sync with `ImageNode` in SceneRenderer; every formula change
// there has to be mirrored here, otherwise the preview drifts from what
// gets exported.
//
// Two modes:
//  • normal (cropMode = false): full opacity, clipped exactly to the block.
//    Acts as a guaranteed-visible duplicate of the SVG image, plus a thin
//    accent border so the bounds are unmistakable.
//  • crop (cropMode = true): the in-block region is *clipped out* via an
//    even-odd SVG path (so the SVG shows through there) and the source
//    extension *outside* the block is dimmed/desaturated to read as
//    "this part will be trimmed".
function CropPreview({
  imageBlock,
  block,
  cropMode,
}: {
  imageBlock: { src: string | null; cropZoom?: number; cropX?: number; cropY?: number; fit?: 'cover' | 'contain'; focalX?: number; focalY?: number; rx?: number }
  block: { x: number; y: number; w: number; h: number } | null
  cropMode: boolean
}) {
  if (!block || !imageBlock.src) return null
  const zoom = Math.max(1, imageBlock.cropZoom ?? 1)
  const cropX = clamp(imageBlock.cropX ?? 0, -50, 50)
  const cropY = clamp(imageBlock.cropY ?? 0, -50, 50)
  const imageX = block.x - ((zoom - 1) * block.w) / 2 + (cropX / 100) * block.w
  const imageY = block.y - ((zoom - 1) * block.h) / 2 + (cropY / 100) * block.h
  const imageW = block.w * zoom
  const imageH = block.h * zoom
  if (imageW <= 0 || imageH <= 0) return null
  // Block coordinates expressed as fractions of the overlay (0..1).
  const lRel = (block.x - imageX) / imageW
  const tRel = (block.y - imageY) / imageH
  const rRel = lRel + block.w / imageW
  const bRel = tRel + block.h / imageH
  const clipId = `crop-mask-${Math.round(imageX * 10)}-${Math.round(imageY * 10)}-${Math.round(imageW * 10)}-${Math.round(imageH * 10)}-${cropMode ? 't' : 'b'}`
  const fit = imageBlock.fit ?? 'cover'
  // Continuous focal — SceneRenderer's smooth-cover branch uses the same
  // raw [0..1] value, so HTML `object-position: X% Y%` and the SVG image
  // shift in lockstep when the user drags the focal slider.
  const focalX = clamp(imageBlock.focalX ?? 0.5, 0, 1)
  const focalY = clamp(imageBlock.focalY ?? 0.5, 0, 1)
  const rx = imageBlock.rx ?? 0
  // In normal mode the clip is the *block* rectangle — overlay is visible
  // only where the saved image will show. In crop mode it's the inverted
  // rectangle (everything *except* the block).
  const clipPathD = cropMode
    ? `M 0 0 H 1 V 1 H 0 Z M ${lRel} ${tRel} H ${rRel} V ${bRel} H ${lRel} Z`
    : `M ${lRel} ${tRel} H ${rRel} V ${bRel} H ${lRel} Z`
  return (
    <>
      <svg width={0} height={0} className="layout-editor__crop-defs" aria-hidden="true">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d={clipPathD} fillRule="evenodd" />
          </clipPath>
        </defs>
      </svg>
      <img
        className={
          'layout-editor__crop-preview' +
          (cropMode ? ' is-crop-mode' : ' is-content-preview')
        }
        src={imageBlock.src}
        alt=""
        draggable={false}
        crossOrigin="anonymous"
        style={{
          left: `${imageX}%`,
          top: `${imageY}%`,
          width: `${imageW}%`,
          height: `${imageH}%`,
          objectFit: fit,
          objectPosition: `${focalX * 100}% ${focalY * 100}%`,
          clipPath: `url(#${clipId})`,
          // Mirror the exported image's rounded corners so the preview
          // doesn't have visibly different edge geometry than the SVG.
          borderRadius: rx > 0 ? `${rx}px` : undefined,
        }}
      />
    </>
  )
}

function zIndex(kind: BlockKind): number {
  switch (kind) {
    case 'image':
      return 1
    case 'logo':
      return 4
    case 'badge':
      return 6
    case 'subtitle':
      return 7
    case 'title':
      return 8
    case 'cta':
      return 9
    default:
      return 5
  }
}

// Vertical list of all blocks the master scene contains. Click anywhere on
// the row selects (mirrors clicking on the canvas); the eye button toggles
// per-format visibility without disabling the block project-wide.
//
// Hidden blocks stay in the list (greyed out) so the user can turn them
// back on — once a row disappears entirely from the list, there's no
// obvious place to revive it from.
function LayersList({
  baseline,
  scene,
  draft,
  selected,
  onSelect,
  onToggleVisibility,
}: {
  baseline: Scene
  scene: Scene
  draft: EditableBlocks
  selected: BlockKind | null
  onSelect: (kind: BlockKind) => void
  onToggleVisibility: (kind: BlockKind, visible: boolean) => void
}) {
  // List every block the baseline scene knew about, even if it's currently
  // hidden via override — that way the eye button can bring it back.
  const present = EDITABLE_KINDS.filter((k) => !!baseline[k])
  if (present.length === 0) return null
  return (
    <div className="layout-editor__layers" role="listbox" aria-label="Объекты на формате">
      <div className="layout-editor__layers-head">Объекты</div>
      {present.map((k) => {
        const isSelected = selected === k
        const isOverridden = !!draft[k]
        const visible = !!scene[k]
        return (
          <div
            key={k}
            className={`layout-editor__layer${isSelected ? ' is-selected' : ''}${visible ? '' : ' is-hidden'}`}
          >
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onToggleVisibility(k, !visible)}
              aria-pressed={visible}
              title={visible ? 'Скрыть в этом формате' : 'Показать в этом формате'}
            >
              {visible ? '👁' : '⊘'}
            </button>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className="layout-editor__layer-pick"
              onClick={() => onSelect(k)}
              title={`Выбрать «${labelFor(k)}»`}
            >
              <span className="layout-editor__layer-icon" aria-hidden="true">
                {layerGlyph(k)}
              </span>
              <span className="layout-editor__layer-label">{labelFor(k)}</span>
              {isOverridden ? (
                <span
                  className="layout-editor__layer-dot"
                  title="У объекта есть свои настройки в этом формате"
                  aria-label="Переопределён"
                />
              ) : null}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function layerGlyph(kind: BlockKind): string {
  switch (kind) {
    case 'title':
      return 'T'
    case 'subtitle':
      return 'a'
    case 'cta':
      return '▭'
    case 'badge':
      return '•'
    case 'logo':
      return 'L'
    case 'image':
      return '◧'
    default:
      return '·'
  }
}

// Properties panel for the selected block. Shows position + size for any
// block, plus block-specific fields (text/typography for text blocks, fit /
// crop / focal for image, etc.). All edits flow into the per-format
// `blockOverride[kind]` so the master scene stays untouched.
function SidePanel({
  selected,
  scene,
  baseline,
  brandKit,
  draft,
  cropMode,
  onChange,
  onReset,
  onToggleVisibility,
  onToggleCropMode,
}: {
  selected: BlockKind | null
  scene: Scene
  baseline: Scene
  brandKit: BrandKit
  draft: EditableBlocks
  cropMode: boolean
  onChange: (kind: BlockKind, patch: Partial<BlockOverride>) => void
  onReset: (kind: BlockKind) => void
  onToggleVisibility: (kind: BlockKind, visible: boolean) => void
  onToggleCropMode: (next: boolean) => void
}) {
  if (!selected) {
    return (
      <div className="layout-editor__empty">
        Выберите элемент на холсте или в списке слева, чтобы увидеть его настройки.
      </div>
    )
  }
  // Read geometry from the live scene if visible, otherwise fall back to the
  // baseline so size fields stay populated even when the block is hidden.
  const box = blockGeometry(scene, selected) ?? blockGeometry(baseline, selected)
  if (!box) return null
  const isOverridden = !!draft[selected]
  const visible = !!scene[selected]
  // For property editors prefer the live block, but fall back to baseline
  // when the user has hidden the block — they should still see/edit its
  // settings (and re-enable visibility) without losing context.
  const block = (scene[selected] ?? baseline[selected]) as Record<string, unknown> | undefined

  return (
    <div className="layout-editor__props">
      <div className="layout-editor__props-head">
        <span>{labelFor(selected)}</span>
        <div className="layout-editor__props-head-actions">
          <label
            className="layout-editor__visibility"
            title={visible ? 'Скрыть в этом формате' : 'Показать в этом формате'}
          >
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => onToggleVisibility(selected, e.target.checked)}
            />
            <span>{visible ? 'Виден' : 'Скрыт'}</span>
          </label>
          {isOverridden ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onReset(selected)}
              title="Вернуть автоматические настройки для этого блока в этом формате"
            >
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      <PropsSection title="Положение и размер">
        <div className="layout-editor__props-grid">
          <NumField label="Слева" unit="%" value={box.x} min={-20} max={120} onChange={(x) => onChange(selected, { x })} />
          <NumField label="Сверху" unit="%" value={box.y} min={-20} max={120} onChange={(y) => onChange(selected, { y })} />
          <NumField label="Ширина" unit="%" value={box.w} min={MIN_W} max={120} onChange={(w) => onChange(selected, { w })} />
          <NumField label="Высота" unit="%" value={box.h} min={MIN_H} max={120} onChange={(h) => onChange(selected, { h })} />
        </div>
      </PropsSection>

      {selected === 'title' || selected === 'subtitle' || selected === 'badge' ? (
        <TextBlockProps
          kind={selected}
          block={block}
          brandKit={brandKit}
          onChange={(patch) => onChange(selected, patch)}
        />
      ) : null}

      {selected === 'cta' ? (
        <CtaBlockProps block={block} brandKit={brandKit} onChange={(patch) => onChange('cta', patch)} />
      ) : null}

      {selected === 'image' ? (
        <ImageBlockProps
          block={block}
          cropMode={cropMode}
          onChange={(patch) => onChange('image', patch)}
          onToggleCropMode={onToggleCropMode}
        />
      ) : null}

      {selected === 'logo' ? (
        <LogoBlockProps block={block} onChange={(patch) => onChange('logo', patch)} />
      ) : null}
    </div>
  )
}

function PropsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="layout-editor__section">
      <header className="layout-editor__section-head">{title}</header>
      <div className="layout-editor__section-body">{children}</div>
    </section>
  )
}

function TextBlockProps({
  kind,
  block,
  brandKit,
  onChange,
}: {
  kind: 'title' | 'subtitle' | 'badge'
  block: Record<string, unknown> | undefined
  brandKit: BrandKit
  onChange: (patch: Partial<BlockOverride>) => void
}) {
  if (!block) return null
  const text = readString(block, 'text', '')
  const fontSize = readNumber(block, 'fontSize', 4)
  const maxLines = readNumber(block, 'maxLines', 2)
  const fill = readString(block, 'fill', '#0E1014')
  const opacity = readNumber(block, 'opacity', 1)
  const align = (readString(block, 'align', 'left') as TextAlign) ?? 'left'
  const transform = (readString(block, 'transform', 'none') as
    | 'none'
    | 'uppercase'
    | 'title-case'
    | 'sentence-case'
    | undefined) ?? 'none'
  // Title uses the brand display font by default; subtitle/badge use text font.
  // We expose this as the dropdown's "default" entry rather than baking it
  // into the override — keeps the brand kit the single source of truth.
  const brandDefault = kind === 'title' ? brandKit.displayFont : brandKit.textFont
  const fontFamily = readString(block, 'fontFamily', '')
  const fontMin = kind === 'badge' ? 1.5 : 2
  const fontMax = kind === 'badge' ? 6 : 14
  return (
    <>
      <PropsSection title="Текст">
        <label className="layout-editor__row">
          <span>Содержимое</span>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
      </PropsSection>
      <PropsSection title="Типографика">
        <FontFamilyRow
          value={fontFamily}
          brandDefault={brandDefault}
          onChange={(v) => onChange({ fontFamily: v === '' ? undefined : v })}
        />
        <RangeRow
          label="Размер шрифта"
          unit="%"
          value={fontSize}
          min={fontMin}
          max={fontMax}
          step={0.1}
          onChange={(v) => onChange({ fontSize: v })}
        />
        {kind !== 'badge' ? (
          <RangeRow
            label="Макс. строк"
            unit=""
            value={maxLines}
            min={1}
            max={4}
            step={1}
            onChange={(v) => onChange({ maxLines: v })}
          />
        ) : null}
        <RangeRow
          label="Прозрачность"
          unit=""
          value={opacity}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ opacity: v })}
        />
        <ColorRow label="Цвет" value={fill} onChange={(v) => onChange({ fill: v })} />
        {kind !== 'badge' ? (
          <SelectRow
            label="Выравнивание"
            value={align}
            onChange={(v) => onChange({ align: v as TextAlign })}
            options={[
              { value: 'left', label: 'По левому' },
              { value: 'center', label: 'По центру' },
              { value: 'right', label: 'По правому' },
            ]}
          />
        ) : null}
        <SelectRow
          label="Регистр"
          value={transform}
          onChange={(v) =>
            onChange({ transform: v as 'none' | 'uppercase' | 'title-case' | 'sentence-case' })
          }
          options={[
            { value: 'none', label: 'Как есть' },
            { value: 'uppercase', label: 'ВЕРХНИЙ' },
            { value: 'title-case', label: 'С Заглавных' },
            { value: 'sentence-case', label: 'Как предложение' },
          ]}
        />
      </PropsSection>
    </>
  )
}

function CtaBlockProps({
  block,
  brandKit,
  onChange,
}: {
  block: Record<string, unknown> | undefined
  brandKit: BrandKit
  onChange: (patch: Partial<BlockOverride>) => void
}) {
  if (!block) return null
  const text = readString(block, 'text', '')
  const fontSize = readNumber(block, 'fontSize', 2.6)
  const fill = readString(block, 'fill', '#FFFFFF')
  const bg = readString(block, 'bg', '#FF5A1F')
  const rx = readNumber(block, 'rx', 999)
  const fontFamily = readString(block, 'fontFamily', '')
  const transform = (readString(block, 'transform', 'none') as
    | 'none'
    | 'uppercase'
    | 'title-case'
    | 'sentence-case'
    | undefined) ?? 'none'
  return (
    <>
      <PropsSection title="Текст кнопки">
        <label className="layout-editor__row">
          <span>Содержимое</span>
          <input
            type="text"
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
      </PropsSection>
      <PropsSection title="Оформление">
        <FontFamilyRow
          value={fontFamily}
          brandDefault={brandKit.displayFont}
          onChange={(v) => onChange({ fontFamily: v === '' ? undefined : v })}
        />
        <RangeRow
          label="Размер шрифта"
          unit="%"
          value={fontSize}
          min={1.5}
          max={5}
          step={0.1}
          onChange={(v) => onChange({ fontSize: v })}
        />
        <ColorRow label="Цвет фона" value={bg} onChange={(v) => onChange({ bg: v })} />
        <ColorRow label="Цвет текста" value={fill} onChange={(v) => onChange({ fill: v })} />
        <RangeRow
          label="Скругление"
          unit="px"
          value={rx}
          min={0}
          max={999}
          step={1}
          format={(v) => (v >= 999 ? '∞' : `${Math.round(v)}px`)}
          onChange={(v) => onChange({ rx: v })}
        />
        <SelectRow
          label="Регистр"
          value={transform}
          onChange={(v) =>
            onChange({ transform: v as 'none' | 'uppercase' | 'title-case' | 'sentence-case' })
          }
          options={[
            { value: 'none', label: 'Как есть' },
            { value: 'uppercase', label: 'ВЕРХНИЙ' },
            { value: 'title-case', label: 'С Заглавных' },
            { value: 'sentence-case', label: 'Как предложение' },
          ]}
        />
      </PropsSection>
    </>
  )
}

function ImageBlockProps({
  block,
  cropMode,
  onChange,
  onToggleCropMode,
}: {
  block: Record<string, unknown> | undefined
  cropMode: boolean
  onChange: (patch: Partial<BlockOverride>) => void
  onToggleCropMode: (next: boolean) => void
}) {
  if (!block) return null
  const fit = (readString(block, 'fit', 'cover') as 'cover' | 'contain') ?? 'cover'
  const rx = readNumber(block, 'rx', 0)
  const focalX = readNumber(block, 'focalX', 0.5)
  const focalY = readNumber(block, 'focalY', 0.5)
  const cropZoom = readNumber(block, 'cropZoom', 1)
  const cropX = readNumber(block, 'cropX', 0)
  const cropY = readNumber(block, 'cropY', 0)
  const panLimit = Math.max(0, (cropZoom - 1) * 50)
  return (
    <>
      <PropsSection title="Заполнение">
        <SelectRow
          label="Режим"
          value={fit}
          onChange={(v) => onChange({ fit: v as 'cover' | 'contain' })}
          options={[
            { value: 'cover', label: 'Обрезать по рамке' },
            { value: 'contain', label: 'Вместить целиком' },
          ]}
        />
        <RangeRow
          label="Скругление углов"
          unit="px"
          value={rx}
          min={0}
          max={48}
          step={1}
          onChange={(v) => onChange({ rx: v })}
        />
      </PropsSection>
      <PropsSection title="Кадр">
        <div className="layout-editor__crop-actions">
          <button
            type="button"
            className={`btn btn-xs${cropMode ? ' btn-primary' : ' btn-ghost'} layout-editor__crop-toggle`}
            onClick={() => onToggleCropMode(!cropMode)}
            title="Перетаскивание — двигает рамку, Alt+перетаскивание — сдвигает картинку, колёсико — масштаб"
          >
            {cropMode ? '✓ Кадрирую на холсте' : '✂ Кадрировать на холсте'}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() =>
              onChange({
                cropX: 0,
                cropY: 0,
                cropZoom: 1,
                fit: 'cover',
                focalX: 0.5,
                focalY: 0.5,
              })
            }
            title="Сбросить кадрирование, чтобы картинка чисто заполнила рамку"
            disabled={
              cropZoom === 1 &&
              cropX === 0 &&
              cropY === 0 &&
              fit === 'cover' &&
              focalX === 0.5 &&
              focalY === 0.5
            }
          >
            ⤢ Заполнить рамку
          </button>
        </div>
        {cropMode ? (
          <p className="layout-editor__note">
            Перетащите рамку, чтобы поставить её в любое место холста. Углы рамки
            меняют её размер. <b>Alt + перетаскивание</b> внутри рамки сдвигает
            картинку, чтобы выбрать видимую часть. Колёсико — масштаб.
          </p>
        ) : null}
        <RangeRow
          label="Масштаб"
          unit=""
          value={cropZoom}
          min={CROP_ZOOM_MIN}
          max={CROP_ZOOM_MAX}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => {
            // Re-clamp pan offsets so the image can't end up outside the
            // shrinking pan range when the user dials zoom back down.
            const limit = Math.max(0, (v - 1) * 50)
            onChange({
              cropZoom: v,
              cropX: clamp(cropX, -limit, limit),
              cropY: clamp(cropY, -limit, limit),
            })
          }}
        />
        {cropZoom > CROP_ZOOM_MIN ? (
          <>
            <RangeRow
              label="Сдвиг по горизонтали"
              unit=""
              value={cropX}
              min={-panLimit}
              max={panLimit}
              step={1}
              format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
              onChange={(v) => onChange({ cropX: v })}
            />
            <RangeRow
              label="Сдвиг по вертикали"
              unit=""
              value={cropY}
              min={-panLimit}
              max={panLimit}
              step={1}
              format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
              onChange={(v) => onChange({ cropY: v })}
            />
            {cropX !== 0 || cropY !== 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onChange({ cropX: 0, cropY: 0 })}
                title="Вернуть картинку в центр кадра"
              >
                Сбросить сдвиг
              </button>
            ) : null}
          </>
        ) : null}
        <RangeRow
          label="Фокус по горизонтали"
          unit=""
          value={focalX}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ focalX: v })}
        />
        <RangeRow
          label="Фокус по вертикали"
          unit=""
          value={focalY}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ focalY: v })}
        />
      </PropsSection>
    </>
  )
}

function LogoBlockProps({
  block,
  onChange,
}: {
  block: Record<string, unknown> | undefined
  onChange: (patch: Partial<BlockOverride>) => void
}) {
  if (!block) return null
  const bgOpacity = readNumber(block, 'bgOpacity', 0)
  return (
    <PropsSection title="Подложка">
      <RangeRow
        label="Прозрачность фона"
        unit=""
        value={bgOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => onChange({ bgOpacity: v })}
      />
      <p className="layout-editor__note">
        Сам логотип загружается в боковой панели редактора во вкладке «Медиа».
      </p>
    </PropsSection>
  )
}

function readString(block: Record<string, unknown>, key: string, fallback: string): string {
  const v = block[key]
  return typeof v === 'string' ? v : fallback
}

function readNumber(block: Record<string, unknown>, key: string, fallback: number): number {
  const v = block[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function NumField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="layout-editor__field">
      <span>{label}</span>
      <span className="layout-editor__field-input">
        <input
          type="number"
          step={0.25}
          min={min}
          max={max}
          value={round(value)}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        />
        <small>{unit}</small>
      </span>
    </label>
  )
}

function RangeRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const display = format ? format(value) : `${round(value)}${unit ? ` ${unit}` : ''}`
  return (
    <label className="layout-editor__row layout-editor__row--range">
      <span className="layout-editor__row-label">
        <span>{label}</span>
        <small>{display}</small>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="layout-editor__row layout-editor__row--inline">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="layout-editor__row layout-editor__row--inline">
      <span>{label}</span>
      <span className="layout-editor__color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </span>
    </label>
  )
}

// Font picker. Empty `value` means "inherit from brand kit". Each option's
// label is rendered in its own font so the user gets a live preview without
// loading any web fonts (the stacks fall back to system fonts).
function FontFamilyRow({
  value,
  brandDefault,
  onChange,
}: {
  value: string
  brandDefault: string
  onChange: (v: string) => void
}) {
  const options = useMemo(() => buildFontOptions(brandDefault), [brandDefault])
  // Echo whatever's actually rendered next to the dropdown so the user can
  // see the effective font even when "Бренда" is selected.
  const effective = value || brandDefault
  return (
    <label className="layout-editor__row layout-editor__row--inline">
      <span>Шрифт</span>
      <span className="layout-editor__font">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value || 'default'} value={o.value} style={{ fontFamily: o.preview }}>
              {o.label}
            </option>
          ))}
        </select>
        <small className="layout-editor__font-preview" style={{ fontFamily: effective }}>
          Aa Бб 123
        </small>
      </span>
    </label>
  )
}

type FontOption = { value: string; label: string; preview: string }

// Flatten FONT_PAIRS into a unique list of font-family stacks. The first
// option resets to the brand default; subsequent options are sorted by the
// human-readable label so the dropdown reads naturally.
function buildFontOptions(brandDefault: string): FontOption[] {
  const seen = new Set<string>()
  const out: FontOption[] = [
    {
      value: '',
      label: `По умолчанию (${stackDisplayName(brandDefault)})`,
      preview: brandDefault,
    },
  ]
  const stacks: string[] = []
  for (const p of FONT_PAIRS) {
    for (const stack of [p.displayFont, p.textFont]) {
      if (!seen.has(stack)) {
        seen.add(stack)
        stacks.push(stack)
      }
    }
  }
  stacks.sort((a, b) => stackDisplayName(a).localeCompare(stackDisplayName(b), 'ru'))
  for (const stack of stacks) {
    out.push({ value: stack, label: stackDisplayName(stack), preview: stack })
  }
  return out
}

// Pull the first family name out of a CSS font-family stack and strip wrapping
// quotes — that's the friendly name shown in the picker (e.g. "Inter Display"
// out of `"Inter Display", Inter, system-ui, sans-serif`).
function stackDisplayName(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? stack
  return first.replace(/^['"]|['"]$/g, '')
}

function InlineTextField({
  block,
  initialText,
  onCommit,
  onCancel,
}: {
  block: { x: number; y: number; w: number; h: number } | null
  initialText: string
  onCommit: (text: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initialText)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  if (!block) return null
  return (
    <textarea
      ref={ref}
      className="layout-editor__inline-edit"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onClick={(e: MouseEvent<HTMLTextAreaElement>) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onCommit(draft)
        }
      }}
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.w}%`,
        minHeight: `${block.h}%`,
      }}
    />
  )
}
