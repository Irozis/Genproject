import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { FormatPreview, type FormatPreviewHandle } from './FormatPreview'
import { sceneFromFormatDocument } from '../lib/formatDocuments'
import { groupFormatsByResolution } from '../lib/formatPlacements'
import type {
  AssetHint,
  BlockKind,
  BlockOverride,
  BrandKit,
  CompositionModel,
  EnabledMap,
  FormatKey,
  LayoutDensity,
  ProjectFormatDocument,
  Scene,
  FormatRuleSet,
} from '../lib/types'

type Props = {
  formats: FormatKey[]
  master: Scene
  imageSrcByFormat?: Partial<Record<FormatKey, string | null>>
  imageFitByFormat?: Partial<Record<FormatKey, 'cover' | 'contain'>>
  brandKit: BrandKit
  enabled: EnabledMap
  /** Per-format composition override (template preferredModels merged with user overrides). */
  overrides?: Partial<Record<FormatKey, CompositionModel>>
  formatDocuments?: Record<string, ProjectFormatDocument>
  /** Per-format image focal override. When a key is absent, master focal is used. */
  imageFocals?: Partial<Record<FormatKey, { x: number; y: number }>>
  /** Analyzed image stats. Forwarded to every preview so layouts can adapt. */
  assetHint?: AssetHint | null
  onPickElement: (kind: BlockKind, formatKey: FormatKey) => void
  onFix: (formatKey: FormatKey) => void
  /** Shift-click on image hotspot in a preview sets per-format focal. */
  onSetFocal?: (formatKey: FormatKey, focal: { x: number; y: number } | null) => void
  /** Double-click on a text hotspot opens an inline editor; committing
   *  calls this to patch master.<kind>.text. */
  onSetBlockText?: (formatKey: FormatKey, kind: 'title' | 'subtitle' | 'cta' | 'badge', text: string) => void
  blockOverrides?: Partial<Record<FormatKey, Partial<Record<BlockKind, BlockOverride>>>>
  layoutDensity?: LayoutDensity
  formatDensities?: Partial<Record<FormatKey, LayoutDensity>>
  layoutClipboard?: Partial<Record<BlockKind, BlockOverride>> | null
  onCopyLayout?: (layout: Partial<Record<BlockKind, BlockOverride>>) => void
  onPasteLayout?: (formatKey: FormatKey) => void
  onEnableCustom?: (formatKey: FormatKey, scene: Scene) => void
  onDisableCustom?: (formatKey: FormatKey) => void
  locale?: string
  customFormats?: FormatRuleSet[]
  /** `null` — для этого формата снять фиксированный макет (авто-подбор). */
  onFormatComposition?: (formatKey: FormatKey, model: CompositionModel | null) => void
  onOpenLayoutEditor?: (formatKey: FormatKey) => void
}

export type FormatGridHandle = {
  getSvg: (key: FormatKey) => SVGSVGElement | null
}

export function shouldUseFormatDocument(
  document: ProjectFormatDocument | undefined,
  _blockOverride: Partial<Record<BlockKind, BlockOverride>> | undefined,
): ProjectFormatDocument | undefined {
  return document?.isEdited ? document : undefined
}

export const FormatGrid = forwardRef<FormatGridHandle, Props>(function FormatGrid(
  {
    formats,
    master,
    imageSrcByFormat,
    imageFitByFormat,
    brandKit,
    enabled,
    overrides,
    formatDocuments,
    imageFocals,
    assetHint,
    onPickElement,
    onFix,
    onSetFocal,
    onSetBlockText,
    blockOverrides,
    layoutDensity,
    formatDensities,
    layoutClipboard,
    onCopyLayout,
    onPasteLayout,
    onEnableCustom,
    onDisableCustom,
    locale,
    customFormats,
    onFormatComposition,
    onOpenLayoutEditor,
  },
  ref,
) {
  const previewRefs = useRef<Partial<Record<FormatKey, FormatPreviewHandle | null>>>({})
  const separateFormatKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const key of Object.keys(blockOverrides ?? {})) keys.add(key)
    for (const [key, document] of Object.entries(formatDocuments ?? {})) {
      if (document.isEdited) keys.add(key)
    }
    return keys
  }, [blockOverrides, formatDocuments])
  const formatGroups = groupFormatsByResolution(formats, customFormats, { separateKeys: separateFormatKeys })

  useImperativeHandle(ref, () => ({
    getSvg: (key) => previewRefs.current[key]?.svgEl ?? null,
  }))

  if (formats.length === 0) {
    return (
      <div className="format-grid-empty" role="status">
        <div className="format-grid-empty__card">
          <div className="format-grid-empty__title">Форматы не выбраны</div>
          <div className="format-grid-empty__body">
            Выберите хотя бы один формат в сайдбаре, чтобы увидеть превью.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="format-grid"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))' }}
    >
      {formatGroups.map((group) => {
        const k = group.previewKey
        const imageSrc = imageSrcByFormat?.[k]
        const imageFit = imageFitByFormat?.[k]
        const previewMaster = imageSrc !== undefined && master.image
          ? { ...master, image: { ...master.image, src: imageSrc, fit: imageFit ?? master.image.fit } }
          : master
        const editedDocument = shouldUseFormatDocument(formatDocuments?.[k], blockOverrides?.[k])
        return (
          <FormatPreview
            key={group.key}
            ref={(el) => {
              previewRefs.current[k] = el
            }}
            formatKey={k}
            displayLabel={group.label}
            master={previewMaster}
            brandKit={brandKit}
            enabled={enabled}
            override={overrides?.[k]}
            sceneOverride={editedDocument ? sceneFromFormatDocument(editedDocument) : undefined}
            sceneObjects={editedDocument ? editedDocument.objects : undefined}
            blockOverride={blockOverrides?.[k]}
            density={formatDensities?.[k] ?? layoutDensity}
            focal={imageFocals?.[k]}
            assetHint={assetHint}
            isCustom={!!blockOverrides?.[k] || !!editedDocument?.isEdited}
            onEnableCustom={onEnableCustom}
            onDisableCustom={onDisableCustom}
            onPickElement={(kind) => onPickElement(kind, k)}
            onFix={onFix}
            onSetFocal={onSetFocal}
            onSetBlockText={onSetBlockText ? (kind, text) => onSetBlockText(k, kind, text) : undefined}
            onCopyLayout={onCopyLayout}
            onPasteLayout={layoutClipboard ? () => onPasteLayout?.(k) : undefined}
            canPaste={!!layoutClipboard}
            locale={locale}
            customFormats={customFormats}
            onCompositionChange={
              onFormatComposition ? (model) => onFormatComposition(k, model) : undefined
            }
            onOpenLayoutEditor={onOpenLayoutEditor}
          />
        )
      })}
    </div>
  )
})
