import { forwardRef, useImperativeHandle, useRef } from 'react'
import { FormatPreview, type FormatPreviewHandle } from './FormatPreview'
import type {
  AssetHint,
  Block,
  BlockKind,
  BrandKit,
  CompositionModel,
  EnabledMap,
  FormatKey,
  Scene,
  FormatRuleSet,
} from '../lib/types'

type Props = {
  formats: FormatKey[]
  master: Scene
  brandKit: BrandKit
  enabled: EnabledMap
  /** Per-format composition override (template preferredModels merged with user overrides). */
  overrides?: Partial<Record<FormatKey, CompositionModel>>
  /** Per-format image focal override. When a key is absent, master focal is used. */
  imageFocals?: Partial<Record<FormatKey, { x: number; y: number }>>
  /** Analyzed image stats. Forwarded to every preview so layouts can adapt. */
  assetHint?: AssetHint | null
  onPickElement: (kind: BlockKind) => void
  onFix: (formatKey: FormatKey) => void
  /** Shift-click on image hotspot in a preview sets per-format focal. */
  onSetFocal?: (formatKey: FormatKey, focal: { x: number; y: number } | null) => void
  /** Double-click on a text hotspot opens an inline editor; committing
   *  calls this to patch master.<kind>.text. */
  onSetBlockText?: (kind: 'title' | 'subtitle' | 'cta' | 'badge', text: string) => void
  blockOverrides?: Partial<Record<FormatKey, Partial<Record<BlockKind, Block>>>>
  layoutClipboard?: Partial<Record<BlockKind, Block>> | null
  onCopyLayout?: (layout: Partial<Record<BlockKind, Block>>) => void
  onPasteLayout?: (formatKey: FormatKey) => void
  locale?: string
  customFormats?: FormatRuleSet[]
}

export type FormatGridHandle = {
  getSvg: (key: FormatKey) => SVGSVGElement | null
}

export const FormatGrid = forwardRef<FormatGridHandle, Props>(function FormatGrid(
  {
    formats,
    master,
    brandKit,
    enabled,
    overrides,
    imageFocals,
    assetHint,
    onPickElement,
    onFix,
    onSetFocal,
    onSetBlockText,
    blockOverrides,
    layoutClipboard,
    onCopyLayout,
    onPasteLayout,
    locale,
    customFormats,
  },
  ref,
) {
  const previewRefs = useRef<Partial<Record<FormatKey, FormatPreviewHandle | null>>>({})

  useImperativeHandle(ref, () => ({
    getSvg: (key) => previewRefs.current[key]?.svgEl ?? null,
  }))

  if (formats.length === 0) {
    return (
      <div className="format-grid-empty" role="status">
        <div className="format-grid-empty__card">
          <div className="format-grid-empty__title">No formats selected</div>
          <div className="format-grid-empty__body">
            Pick at least one format in the sidebar (Formats section) to see live previews here.
          </div>
        </div>
      </div>
    )
  }

  // Hard-cap at 4 columns: wider grids start to make each preview unusable.
  // When there are fewer than 4 formats we shrink to match so the row fills
  // evenly instead of leaving empty cells.
  const cols = Math.min(4, formats.length)
  return (
    <div
      className="format-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {formats.map((k) => (
        <FormatPreview
          key={k}
          ref={(el) => {
            previewRefs.current[k] = el
          }}
          formatKey={k}
          master={master}
          brandKit={brandKit}
          enabled={enabled}
          override={overrides?.[k]}
          blockOverride={blockOverrides?.[k]}
          focal={imageFocals?.[k]}
          assetHint={assetHint}
          onPickElement={onPickElement}
          onFix={onFix}
          onSetFocal={onSetFocal}
          onSetBlockText={onSetBlockText}
          onCopyLayout={onCopyLayout}
          onPasteLayout={layoutClipboard ? () => onPasteLayout?.(k) : undefined}
          canPaste={!!layoutClipboard}
          locale={locale}
          customFormats={customFormats}
        />
      ))}
    </div>
  )
})
