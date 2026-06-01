// Pure renderer: takes a positioned Scene + format dimensions and outputs SVG.
// No state, no effects. Text wrapping uses canvas measureText for fidelity.

import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { tonalStops } from '../lib/color'
import { measureTextWidth, wrapText } from '../lib/textMeasure'
import type {
  Background,
  Decor,
  FormatRuleSet,
  ImageBlock,
  LogoBlock,
  Scene,
  SceneObject,
  Scrim,
  TextBlock,
} from '../lib/types'
import { sortObjectsForRender } from '../lib/formatDocuments'

type RenderImageBlock = Omit<ImageBlock, 'fit'> & { fit: 'cover' | 'contain' | 'fill' }

type Props = {
  scene: Scene
  rules: FormatRuleSet
  /** Display family — used for headlines and CTA. */
  displayFont: string
  /** Text family — used for subtitle and badge. */
  textFont: string
  brandInitials?: string
  brandColor?: string
  className?: string
  style?: CSSProperties
  /** Source-image aspect ratio (intrinsic width / intrinsic height). When
   *  provided, ImageNode uses it to compute *continuous* focal alignment in
   *  cover mode — every change of focalX/focalY produces a smooth visual
   *  shift instead of snapping to Min/Mid/Max thresholds.
   *  When absent, falls back to SVG's discretized `preserveAspectRatio`. */
  imageAspectRatio?: number | null
  objects?: SceneObject[]
}

export const SceneRenderer = forwardRef<SVGSVGElement, Props>(function SceneRenderer(
  { scene, rules, displayFont, textFont, brandInitials, brandColor, className, style, imageAspectRatio, objects },
  ref,
) {
  const { width: W, height: H, key } = rules
  const bgId = `bg-${key}`
  const scrimId = `scrim-${key}`
  const imgClipId = `img-clip-${key}`
  const imgShadowId = `img-shadow-${key}`

  const renderObjects = objects ? sortObjectsForRender(objects).filter((object) => object.visible) : null

  return (
    <svg
      ref={ref}
      className={className}
      style={style}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="format-preview-svg"
      data-format-key={key}
    >
      <defs>
        <BackgroundDefs bg={scene.background} id={bgId} />
        {renderObjects?.map((object) => <ObjectDefs key={object.id} object={object} W={W} H={H} imageAspectRatio={imageAspectRatio ?? null} />)}
        {scene.scrim ? (
          <linearGradient id={scrimId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={scene.scrim.color}
              stopOpacity={scene.scrim.direction === 'up' ? scene.scrim.opacity : 0}
            />
            <stop
              offset="100%"
              stopColor={scene.scrim.color}
              stopOpacity={scene.scrim.direction === 'up' ? 0 : scene.scrim.opacity}
            />
          </linearGradient>
        ) : null}
        {scene.image && scene.image.src && needsImageClipPath(scene.image, imageAspectRatio) ? (
          <clipPath id={imgClipId}>
            <rect
              x={pct(scene.image.x, W)}
              y={pct(scene.image.y, H)}
              width={pct(scene.image.w, W)}
              height={pct(scene.image.h ?? 50, H)}
              rx={scene.image.rx}
              ry={scene.image.rx}
            />
          </clipPath>
        ) : null}
        <filter id={imgShadowId} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy={H * 0.006} stdDeviation={W * 0.008} floodOpacity="0.18" />
        </filter>
      </defs>

      {renderObjects ? (
        renderObjects.map((object) => (
          <ObjectNode
            key={object.id}
            object={object}
            scene={scene}
            W={W}
            H={H}
            bgId={bgId}
            displayFont={displayFont}
            textFont={textFont}
            brandInitials={brandInitials ?? ''}
            brandColor={brandColor ?? scene.accent ?? '#111827'}
            imageAspectRatio={imageAspectRatio ?? null}
          />
        ))
      ) : (
        <>
          <BackgroundFill bg={scene.background} W={W} H={H} id={bgId} />

          {scene.decor ? <DecorNode decor={scene.decor} W={W} H={H} /> : null}

          {scene.image ? (
            <ImageNode
              role="image"
              block={scene.image}
              W={W}
              H={H}
              clipId={imgClipId}
              shadowId={imgShadowId}
              imageAspectRatio={imageAspectRatio ?? null}
            />
          ) : null}

          {scene.scrim ? <ScrimNode scrim={scene.scrim} W={W} H={H} gradientId={scrimId} /> : null}

          {scene.badge ? (
            <BadgeNode role="badge" block={scene.badge} W={W} H={H} fontFamily={scene.badge.fontFamily ?? textFont} />
          ) : null}

          {scene.title ? (
            <TextNode
              role="title"
              block={scene.title}
              W={W}
              H={H}
              fontFamily={scene.title.fontFamily ?? displayFont}
              accent={scene.accent}
            />
          ) : null}

          {scene.subtitle ? (
            <TextNode
              role="subtitle"
              block={scene.subtitle}
              W={W}
              H={H}
              fontFamily={scene.subtitle.fontFamily ?? textFont}
              accent={scene.accent}
            />
          ) : null}

          {scene.cta ? <CtaNode role="cta" block={scene.cta} W={W} H={H} fontFamily={scene.cta.fontFamily ?? displayFont} /> : null}

          {scene.logo ? (
            <LogoNode
              role="logo"
              block={scene.logo}
              W={W}
              H={H}
              fontFamily={displayFont}
              initials={brandInitials ?? ''}
              color={brandColor ?? scene.accent ?? '#111827'}
            />
          ) : null}
        </>
      )}
    </svg>
  )
})

function ObjectDefs({
  object,
  W,
  H,
  imageAspectRatio,
}: {
  object: SceneObject
  W: number
  H: number
  imageAspectRatio: number | null
}) {
  const image = objectToImageBlock(object)
  if (!image || !needsImageClipPath(image, imageAspectRatio)) return null
  return (
    <clipPath id={objectClipId(object.id)}>
      <rect
        x={pct(image.x, W)}
        y={pct(image.y, H)}
        width={pct(image.w, W)}
        height={pct(image.h ?? 50, H)}
        rx={image.rx}
        ry={image.rx}
      />
    </clipPath>
  )
}

function ObjectNode({
  object,
  scene,
  W,
  H,
  bgId,
  displayFont,
  textFont,
  brandInitials,
  brandColor,
  imageAspectRatio,
}: {
  object: SceneObject
  scene: Scene
  W: number
  H: number
  bgId: string
  displayFont: string
  textFont: string
  brandInitials: string
  brandColor: string
  imageAspectRatio: number | null
}) {
  if (object.type === 'background') {
    const saved = object.metadata?.background
    if (isBackground(saved)) return <BackgroundFill bg={saved} W={W} H={H} id={bgId} />
    return <rect data-role="background" x={0} y={0} width={W} height={H} fill={object.fill ?? '#FFFFFF'} />
  }

  if (object.type === 'image' || object.type === 'custom-image') {
    const block = objectToImageBlock(object)
    if (!block) return null
    return (
      <ImageNode
        role={object.type}
        block={block}
        W={W}
        H={H}
        clipId={objectClipId(object.id)}
        shadowId=""
        imageAspectRatio={imageAspectRatio}
      />
    )
  }

  if (object.type === 'logo') {
    return (
      <LogoNode
        role="logo"
        block={objectToLogoBlock(object)}
        W={W}
        H={H}
        fontFamily={displayFont}
        initials={brandInitials}
        color={brandColor}
      />
    )
  }

  if (object.type === 'cta') {
    return (
      <CtaNode
        role="cta"
        block={objectToCtaBlock(object)}
        W={W}
        H={H}
        fontFamily={object.fontFamily ?? displayFont}
      />
    )
  }

  if (object.type === 'title' || object.type === 'subtitle' || object.type === 'badge' || object.type === 'text') {
    const block = objectToTextBlock(object)
    if (object.type === 'badge') return <BadgeNode role="badge" block={block} W={W} H={H} fontFamily={object.fontFamily ?? textFont} />
    return (
      <TextNode
        role={object.type}
        block={block}
        W={W}
        H={H}
        fontFamily={object.fontFamily ?? (object.type === 'subtitle' ? textFont : displayFont)}
        accent={scene.accent}
      />
    )
  }

  if (object.type === 'shape' || object.type === 'decor') {
    return (
      <rect
        data-role={object.type}
        x={pct(object.x, W)}
        y={pct(object.y, H)}
        width={pct(object.width, W)}
        height={pct(object.height, H)}
        rx={object.borderRadius ?? 0}
        ry={object.borderRadius ?? 0}
        fill={object.fill ?? 'transparent'}
        stroke={object.stroke}
        opacity={object.opacity ?? 1}
        transform={object.rotation ? `rotate(${object.rotation} ${pct(object.x + object.width / 2, W)} ${pct(object.y + object.height / 2, H)})` : undefined}
      />
    )
  }

  return null
}

function objectToImageBlock(object: SceneObject): RenderImageBlock | null {
  if (object.type !== 'image' && object.type !== 'custom-image') return null
  return {
    x: object.x,
    y: object.y,
    w: object.width,
    h: object.height,
    src: object.imageSrc ?? null,
    rx: object.borderRadius ?? 0,
    fit: object.fit === 'contain' ? 'contain' : object.fit === 'fill' ? 'fill' : 'cover',
    opacity: object.opacity,
    focalX: object.focalX,
    focalY: object.focalY,
    cropZoom: object.cropZoom,
    cropX: object.cropX,
    cropY: object.cropY,
  }
}

function objectToLogoBlock(object: SceneObject): LogoBlock {
  return {
    x: object.x,
    y: object.y,
    w: object.width,
    h: object.height,
    src: object.imageSrc ?? null,
    bgOpacity: typeof object.metadata?.bgOpacity === 'number' ? object.metadata.bgOpacity : 0,
    opacity: object.opacity,
  }
}

function objectToTextBlock(object: SceneObject): TextBlock {
  return {
    x: object.x,
    y: object.y,
    w: object.width,
    h: object.height,
    text: object.text ?? object.name,
    fontSize: object.fontSize ?? 4,
    charsPerLine: Math.max(8, Math.round(object.width / 2)),
    maxLines: Math.max(1, Math.round((object.height || 8) / Math.max(1, object.fontSize ?? 4))),
    weight: object.fontWeight ?? 600,
    fill: object.fill ?? '#111827',
    opacity: object.opacity,
    letterSpacing: object.letterSpacing,
    lineHeight: object.lineHeight,
    align: object.textAlign,
  }
}

function objectToCtaBlock(object: SceneObject): TextBlock & { bg: string; rx: number } {
  return {
    ...objectToTextBlock(object),
    bg: typeof object.metadata?.bg === 'string' ? object.metadata.bg : object.fill ?? '#111827',
    fill: object.fill && object.metadata?.bg ? object.fill : '#FFFFFF',
    rx: object.borderRadius ?? 999,
  }
}

function objectClipId(id: string): string {
  return `obj-clip-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function isBackground(value: unknown): value is Background {
  if (!value || typeof value !== 'object') return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'gradient' || kind === 'solid' || kind === 'tonal' || kind === 'split'
}

function pct(v: number, total: number): number {
  return (v / 100) * total
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function resolveFontSizePx(fontSize: number, frameWidth: number): number {
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0
  // Scene stores typography as percentage (0..100). Larger values are treated
  // as already-pixel font sizes for compatibility with direct px overrides.
  if (fontSize <= 100) return (fontSize / 100) * frameWidth
  return fontSize
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

function BackgroundDefs({ bg, id }: { bg: Background; id: string }) {
  if (bg.kind === 'gradient') {
    if (bg.radial) {
      // Radial sits centered on focal and expands to fill — r=0.9 ensures the
      // last stop covers the far corner comfortably.
      return (
        <radialGradient
          id={id}
          cx={bg.radial.cx}
          cy={bg.radial.cy}
          r="0.95"
          fx={bg.radial.cx}
          fy={bg.radial.cy}
        >
          <stop offset="0%" stopColor={bg.stops[0]} />
          <stop offset="55%" stopColor={bg.stops[1]} />
          <stop offset="100%" stopColor={bg.stops[2]} />
        </radialGradient>
      )
    }
    return (
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={bg.stops[0]} />
        <stop offset="50%" stopColor={bg.stops[1]} />
        <stop offset="100%" stopColor={bg.stops[2]} />
      </linearGradient>
    )
  }
  if (bg.kind === 'tonal') {
    const [a, b, c] = tonalStops(bg.base)
    return (
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={a} />
        <stop offset="50%" stopColor={b} />
        <stop offset="100%" stopColor={c} />
      </linearGradient>
    )
  }
  return null
}

function BackgroundFill({
  bg,
  W,
  H,
  id,
}: {
  bg: Background
  W: number
  H: number
  id: string
}) {
  if (bg.kind === 'solid') {
    return <rect x={0} y={0} width={W} height={H} fill={bg.color} />
  }
  if (bg.kind === 'split') {
    if (bg.angle === 90) {
      // vertical split: left = a, right = b
      return (
        <g>
          <rect x={0} y={0} width={W / 2} height={H} fill={bg.a} />
          <rect x={W / 2} y={0} width={W / 2} height={H} fill={bg.b} />
        </g>
      )
    }
    // angle === 0 → horizontal split: top = a, bottom = b
    return (
      <g>
        <rect x={0} y={0} width={W} height={H / 2} fill={bg.a} />
        <rect x={0} y={H / 2} width={W} height={H / 2} fill={bg.b} />
      </g>
    )
  }
  // gradient or tonal → consume gradient def
  return <rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
}

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------

function DecorNode({ decor, W, H }: { decor: Decor; W: number; H: number }) {
  if (decor.kind === 'corner-circle') {
    const r = pct(decor.size, W)
    const { cx, cy } = cornerAnchor(decor.corner, W, H, r)
    return <circle cx={cx} cy={cy} r={r} fill={decor.color} opacity={decor.opacity} />
  }
  if (decor.kind === 'diagonal-stripe') {
    // Thick diagonal stripe from top-right to bottom-left.
    const stripeW = Math.max(W, H) * 0.12
    const d = `
      M ${W + stripeW} ${-stripeW}
      L ${W + stripeW} ${stripeW}
      L ${-stripeW} ${H + stripeW}
      L ${-stripeW} ${H - stripeW}
      Z
    `
    return <path d={d} fill={decor.color} opacity={decor.opacity} />
  }
  if (decor.kind === 'dotted-grid') {
    const density = Math.max(3, Math.min(24, decor.density))
    const step = W / density
    const dotR = Math.max(1, step * 0.08)
    const dots: { cx: number; cy: number }[] = []
    // Offset by half-step so dots don't kiss the edges of the canvas.
    for (let gy = step / 2; gy < H; gy += step) {
      for (let gx = step / 2; gx < W; gx += step) {
        dots.push({ cx: gx, cy: gy })
      }
    }
    return (
      <g opacity={decor.opacity}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={dotR} fill={decor.color} />
        ))}
      </g>
    )
  }
  if (decor.kind === 'corner-bracket') {
    const size = pct(decor.size, W)
    const strokeW = Math.max(2, W * 0.006)
    const { x, y, dx, dy } = bracketAnchor(decor.corner, W, H, size)
    // Two perpendicular strokes forming an L. `dx/dy` dictate which way the
    // arms extend away from the corner.
    const d = `M ${x + dx * size} ${y} L ${x} ${y} L ${x} ${y + dy * size}`
    return (
      <path
        d={d}
        stroke={decor.color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="square"
        opacity={decor.opacity}
      />
    )
  }
  if (decor.kind === 'half-circle') {
    const r = pct(decor.size, Math.max(W, H))
    const { cx, cy } = edgeAnchor(decor.edge, W, H)
    return <circle cx={cx} cy={cy} r={r} fill={decor.color} opacity={decor.opacity} />
  }
  if (decor.kind === 'grain') {
    // Film-grain via feTurbulence + feColorMatrix. Deterministic seed means
    // two identical-seed grains render pixel-for-pixel the same. Opacity
    // scales with `intensity` — kept low so grain stays a texture, not noise.
    const filterId = `grain-${decor.seed}`
    const clamped = Math.max(0, Math.min(1, decor.intensity))
    return (
      <g opacity={clamped * 0.35}>
        <defs>
          <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.8"
              numOctaves={2}
              seed={decor.seed}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"
            />
          </filter>
        </defs>
        <rect x={0} y={0} width={W} height={H} filter={`url(#${filterId})`} />
      </g>
    )
  }
  // rule: thin horizontal line
  const strokeW = Math.max(1, H * 0.002)
  return (
    <line
      x1={pct(6, W)}
      y1={pct(decor.y, H)}
      x2={pct(94, W)}
      y2={pct(decor.y, H)}
      stroke={decor.color}
      strokeWidth={strokeW}
      opacity={decor.opacity}
    />
  )
}

function bracketAnchor(
  corner: 'tl' | 'tr' | 'bl' | 'br',
  W: number,
  H: number,
  size: number,
): { x: number; y: number; dx: number; dy: number } {
  const m = size * 0.25 // inset from the actual canvas edge
  switch (corner) {
    case 'tl':
      return { x: m, y: m, dx: 1, dy: 1 }
    case 'tr':
      return { x: W - m, y: m, dx: -1, dy: 1 }
    case 'bl':
      return { x: m, y: H - m, dx: 1, dy: -1 }
    case 'br':
      return { x: W - m, y: H - m, dx: -1, dy: -1 }
  }
}

function edgeAnchor(
  edge: 'top' | 'right' | 'bottom' | 'left',
  W: number,
  H: number,
): { cx: number; cy: number } {
  switch (edge) {
    case 'top':
      return { cx: W / 2, cy: 0 }
    case 'right':
      return { cx: W, cy: H / 2 }
    case 'bottom':
      return { cx: W / 2, cy: H }
    case 'left':
      return { cx: 0, cy: H / 2 }
  }
}

function cornerAnchor(
  corner: 'tl' | 'tr' | 'bl' | 'br',
  W: number,
  H: number,
  r: number,
): { cx: number; cy: number } {
  const offset = r * 0.3 // nudge off-canvas slightly for bleed
  switch (corner) {
    case 'tl':
      return { cx: -offset, cy: -offset }
    case 'tr':
      return { cx: W + offset, cy: -offset }
    case 'bl':
      return { cx: -offset, cy: H + offset }
    case 'br':
      return { cx: W + offset, cy: H + offset }
  }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

function ImageNode({
  role,
  block,
  W,
  H,
  clipId,
  shadowId,
  imageAspectRatio,
}: {
  role: string
  block: RenderImageBlock
  W: number
  H: number
  clipId: string
  shadowId: string
  imageAspectRatio: number | null
}) {
  if (!block.src) {
    return (
      <rect
        data-role={role}
        x={pct(block.x, W)}
        y={pct(block.y, H)}
        width={pct(block.w, W)}
        height={pct(block.h ?? 50, H)}
        rx={block.rx}
        ry={block.rx}
        fill="rgba(0,0,0,0.06)"
        stroke="rgba(0,0,0,0.12)"
        strokeDasharray="8 8"
        opacity={block.opacity}
      />
    )
  }
  const zoom = Math.max(1, block.cropZoom ?? 1)
  const cropX = clamp(block.cropX ?? 0, -50, 50)
  const cropY = clamp(block.cropY ?? 0, -50, 50)
  // Block bbox (crop-zoom expanded) in canvas % coords. With zoom > 1 the
  // image extends outside the block; clipPath crops it back to the block.
  const blockX = block.x - ((zoom - 1) * block.w) / 2 + (cropX / 100) * block.w
  const blockY = block.y - ((zoom - 1) * (block.h ?? 50)) / 2 + (cropY / 100) * (block.h ?? 50)
  const blockW = block.w * zoom
  const blockH = (block.h ?? 50) * zoom

  const focalX = clamp(block.focalX ?? 0.5, 0, 1)
  const focalY = clamp(block.focalY ?? 0.5, 0, 1)
  const fit = block.fit ?? 'cover'

  // Continuous-focal path: when we know the source's intrinsic aspect, we
  // can size and position the image manually so focalX/focalY produce
  // smooth shifts instead of SVG `preserveAspectRatio`'s 3-step snap. This
  // matches what HTML's `object-fit:cover; object-position:X% Y%` does.
  if (imageAspectRatio && imageAspectRatio > 0 && fit === 'cover') {
    // All math in user-units (the SVG viewBox is 0..W × 0..H).
    const bx = (blockX / 100) * W
    const by = (blockY / 100) * H
    const bw = (blockW / 100) * W
    const bh = (blockH / 100) * H
    const blockAspect = bw > 0 && bh > 0 ? bw / bh : 1
    let dispW: number
    let dispH: number
    if (imageAspectRatio >= blockAspect) {
      // Source is wider (or equal) — fit height, overhang horizontally.
      dispH = bh
      dispW = bh * imageAspectRatio
    } else {
      // Source is taller — fit width, overhang vertically.
      dispW = bw
      dispH = bw / imageAspectRatio
    }
    const offsetX = -(dispW - bw) * focalX
    const offsetY = -(dispH - bh) * focalY
    // Clip is required: the image element is bigger than the block bbox in
    // one dimension and would otherwise paint outside it.
    return (
      <image
        data-role={role}
        href={block.src}
        crossOrigin="anonymous"
        x={bx + offsetX}
        y={by + offsetY}
        width={dispW}
        height={dispH}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
        filter={block.rx > 0 && shadowId ? `url(#${shadowId})` : undefined}
        opacity={block.opacity}
      />
    )
  }

  // Fallback: discretized focal via SVG's preserveAspectRatio. Used for
  // 'contain' (where focal isn't really meaningful inside letterbox bars
  // anyway) and when intrinsic aspect isn't known.
  const isClipped = shouldClipImage(block)
  const par =
    fit === 'fill'
      ? 'none'
      : fit === 'contain'
      ? 'xMidYMid meet'
      : `${focalAlign(focalX, 'x')}${focalAlign(focalY, 'y')} slice`
  return (
    <image
      data-role={role}
      href={block.src}
      crossOrigin="anonymous"
      x={pct(blockX, W)}
      y={pct(blockY, H)}
      width={pct(blockW, W)}
      height={pct(blockH, H)}
      preserveAspectRatio={par}
      clipPath={isClipped ? `url(#${clipId})` : undefined}
      filter={block.rx > 0 && shadowId ? `url(#${shadowId})` : undefined}
      opacity={block.opacity}
    />
  )
}

function shouldClipImage(block: RenderImageBlock): boolean {
  return block.rx > 0 || (block.cropZoom ?? 1) > 1 || !!block.cropX || !!block.cropY
}

// Whether the SVG render path will need the block's clipPath. Same triggers
// as `shouldClipImage` *plus* the smooth-cover branch — that path always
// renders the source bigger than the block and relies on the clipPath to
// trim the overhang back to the block bounds.
function needsImageClipPath(block: RenderImageBlock, imageAspectRatio: number | null | undefined): boolean {
  if (shouldClipImage(block)) return true
  const fit = block.fit ?? 'cover'
  return fit === 'cover' && !!imageAspectRatio && imageAspectRatio > 0
}

// Map a normalized focal [0..1] coord to the SVG preserveAspectRatio alignment
// token. Discretized to Min/Mid/Max — enough for a visible shift, no sub-pixel
// tweaking that SVG can't honour anyway.
function focalAlign(v: number, axis: 'x' | 'y'): string {
  const pos = v < 1 / 3 ? 'Min' : v > 2 / 3 ? 'Max' : 'Mid'
  return axis === 'x' ? `x${pos}` : `Y${pos}`
}

function ScrimNode({
  scrim,
  W,
  H,
  gradientId,
}: {
  scrim: Scrim
  W: number
  H: number
  gradientId: string
}) {
  return (
    <rect
      x={0}
      y={pct(scrim.y, H)}
      width={W}
      height={pct(scrim.h, H)}
      fill={`url(#${gradientId})`}
    />
  )
}

// ---------------------------------------------------------------------------
// Text / badge / cta / logo
// ---------------------------------------------------------------------------

function LogoNode({
  role,
  block,
  W,
  H,
  fontFamily,
  initials,
  color,
}: {
  role: string
  block: LogoBlock
  W: number
  H: number
  fontFamily: string
  initials: string
  color: string
}) {
  const x = pct(block.x, W)
  const y = pct(block.y, H)
  const w = pct(block.w, W)
  const h = pct(block.h ?? 6, H)

  if (block.src) {
    return (
      <image
        data-role={role}
        href={block.src}
        crossOrigin="anonymous"
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid meet"
        opacity={block.opacity}
      />
    )
  }

  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) * 0.28
  const label = extractInitials(initials)
  const fontSize = Math.min(w, h) * 0.34

  return (
    <g data-role={role} opacity={block.opacity}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill={color}
        fillOpacity={Math.max(0.88, block.bgOpacity || 0.92)}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={Math.max(1, Math.min(w, h) * 0.035)}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={800}
        fill="#FFFFFF"
        letterSpacing={fontSize * 0.02}
      >
        {label}
      </text>
    </g>
  )
}

function extractInitials(name: string): string {
  if (!name) return '•'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '•'
  const first = parts[0] ?? ''
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const second = parts[1] ?? ''
  return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase() || '•'
}

// ---------------------------------------------------------------------------
// Keyword highlighting — `**word**` becomes accent-colored inside a TextBlock.
// Tokens preserve accent flags across wrap boundaries; the rendered line is
// split into per-word tspans so highlighted words can take a different fill.
// ---------------------------------------------------------------------------

type TextToken = { text: string; accent: boolean }

function parseHighlightTokens(raw: string): TextToken[] {
  const tokens: TextToken[] = []
  const re = /\*\*([^*]+)\*\*|\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const inner = m[1]
    if (inner !== undefined) {
      for (const w of inner.split(/\s+/).filter(Boolean)) {
        tokens.push({ text: w, accent: true })
      }
    } else {
      tokens.push({ text: m[0], accent: false })
    }
  }
  return tokens
}

/** Strip markers so wrapText sees plain text. */
function stripMarkers(raw: string): string {
  return parseHighlightTokens(raw)
    .map((t) => t.text)
    .join(' ')
}

/** Split a wrapped line back into tokens (word + accent flag). Tolerates
 *  an ellipsis suffix on the final word — the tail after the matched stem
 *  renders as non-accented. */
function splitLineIntoTokens(line: string, allTokens: TextToken[], cursor: number): {
  tokens: TextToken[]
  nextCursor: number
} {
  const words = line.split(/\s+/).filter(Boolean)
  const out: TextToken[] = []
  for (const word of words) {
    const tok = allTokens[cursor]
    if (!tok) {
      // Unmatched trailing word (e.g. pure ellipsis): emit as-is, non-accent.
      out.push({ text: word, accent: false })
      continue
    }
    if (word === tok.text) {
      out.push({ text: word, accent: tok.accent })
      cursor++
    } else if (word.endsWith('…') && tok.text.startsWith(word.slice(0, -1))) {
      // Truncated original word — keep accent flag.
      out.push({ text: word, accent: tok.accent })
      cursor++
    } else {
      // Best-effort: emit without accent.
      out.push({ text: word, accent: false })
      cursor++
    }
  }
  return { tokens: out, nextCursor: cursor }
}

function TextNode({
  role,
  block,
  W,
  H,
  fontFamily,
  accent,
}: {
  role: string
  block: TextBlock
  W: number
  H: number
  fontFamily: string
  accent: string
}) {
  const xLeft = pct(block.x, W)
  const yTop = pct(block.y, H)
  const wPx = pct(block.w, W)
  const align = block.align ?? 'left'
  const rawText = applyCase(block.text, block.transform)
  const hasHighlight = rawText.includes('**')
  const plain = hasHighlight ? stripMarkers(rawText) : rawText
  const fitMode = block.fitMode ?? 'auto'
  const wrapMaxLines = fitMode === 'overflow' ? 99 : block.maxLines
  const baseFontSizePx = resolveFontSizePx(block.fontSize, W)
  const fontSizePx = fitMode === 'auto'
    ? fitTextFontSize({
        text: plain,
        basePx: baseFontSizePx,
        minPx: Math.max(8, baseFontSizePx * 0.62),
        fontWeight: block.weight,
        fontFamily,
        maxWidthPx: wPx,
        maxLines: wrapMaxLines,
      })
    : baseFontSizePx
  // Halo filter id is stable per bbox so hot-reload doesn't churn DOM.
  const haloId = block.halo
    ? `halo-${Math.round(xLeft)}-${Math.round(yTop)}-${Math.round(fontSizePx)}`
    : undefined
  // Anchor-point translation: SVG `text-anchor` attaches relative to the same
  // x coordinate for every tspan, so centering / right-aligning is a matter of
  // moving the anchor rather than computing per-line offsets.
  const anchorX = align === 'center' ? xLeft + wPx / 2 : align === 'right' ? xLeft + wPx : xLeft
  const textAnchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  const clipId = block.h && fitMode !== 'overflow'
    ? `text-clip-${Math.round(xLeft)}-${Math.round(yTop)}-${Math.round(wPx)}-${Math.round(pct(block.h, H))}`
    : undefined
  const lines = wrapText({
    text: plain,
    fontSizePx,
    fontWeight: block.weight,
    fontFamily,
    maxWidthPx: wPx,
    maxLines: wrapMaxLines,
    overflow: fitMode === 'clamp' || fitMode === 'overflow' ? 'clip' : 'ellipsis',
  })
  const lineHeight = fontSizePx * (block.lineHeight ?? 1.12)
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0)

  const allTokens = hasHighlight ? parseHighlightTokens(rawText) : null
  const textNode = (
    <text
      data-role={role}
      x={anchorX}
      y={yTop + fontSizePx}
      fill={block.fill}
      fontFamily={fontFamily}
      fontSize={fontSizePx}
      fontWeight={block.weight}
      opacity={block.opacity ?? 1}
      letterSpacing={letterSpacingPx || undefined}
      textAnchor={textAnchor}
      filter={haloId ? `url(#${haloId})` : undefined}
    >
      {lines.map((line, i) => {
        const dy = i === 0 ? 0 : lineHeight
        if (!allTokens) {
          return (
            <tspan key={i} x={anchorX} dy={dy}>
              {line}
            </tspan>
          )
        }
        // Build per-word tspans with accent color when flagged.
        const { tokens } = splitLineIntoTokens(line, allTokens, cursorFor(lines, allTokens, i))
        return (
          <tspan key={i} x={anchorX} dy={dy}>
            {tokens.map((t, j) => (
              <tspan
                key={j}
                fill={t.accent ? accent : undefined}
              >
                {(j === 0 ? '' : ' ') + t.text}
              </tspan>
            ))}
          </tspan>
        )
      })}
    </text>
  )

  return (
    <>
      {clipId ? (
        <defs>
          <clipPath id={clipId}>
            <rect x={xLeft} y={yTop} width={wPx} height={pct(block.h ?? 0, H)} />
          </clipPath>
        </defs>
      ) : null}
      {block.halo && haloId ? (
        <defs>
          <filter id={haloId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation={block.halo.blurPx} />
            <feComponentTransfer>
              <feFuncA type="linear" slope={block.halo.opacity * 1.8} />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      ) : null}
      {clipId ? <g clipPath={`url(#${clipId})`}>{textNode}</g> : textNode}
    </>
  )
}

function fitTextFontSize({
  text,
  basePx,
  minPx,
  fontWeight,
  fontFamily,
  maxWidthPx,
  maxLines,
}: {
  text: string
  basePx: number
  minPx: number
  fontWeight: number
  fontFamily: string
  maxWidthPx: number
  maxLines: number
}): number {
  if (!text || maxLines <= 0 || maxWidthPx <= 0) return basePx
  let size = basePx
  const safeWidth = maxWidthPx * 0.96
  while (size > minPx) {
    const lines = wrapText({
      text,
      fontSizePx: size,
      fontWeight,
      fontFamily,
      maxWidthPx: safeWidth,
      maxLines,
      overflow: 'ellipsis',
    })
    if (!lines.some((line) => line.includes('…'))) return size
    size = Math.max(minPx, size - 0.5)
  }
  return minPx
}

// Compute the starting token index for line `i` by replaying earlier lines.
// Cheap — only called when highlights are present.
function cursorFor(lines: string[], allTokens: TextToken[], i: number): number {
  let cursor = 0
  for (let k = 0; k < i; k++) {
    const l = lines[k] ?? ''
    const words = l.split(/\s+/).filter(Boolean)
    for (const w of words) {
      const tok = allTokens[cursor]
      if (!tok) break
      if (w === tok.text || (w.endsWith('…') && tok.text.startsWith(w.slice(0, -1)))) {
        cursor++
      } else {
        cursor++
      }
    }
  }
  return cursor
}

function BadgeNode({
  role,
  block,
  W,
  H,
  fontFamily,
}: {
  role: string
  block: TextBlock
  W: number
  H: number
  fontFamily: string
}) {
  const fontSizePx = resolveFontSizePx(block.fontSize, W)
  // Slightly more breathing room than 0.7 — uppercase Cyrillic glyphs
  // (Ф, Ж, Щ) sit visually wider than the canvas measurement suggests, so
  // a hair of extra horizontal pad prevents the right side from touching
  // the stroke.
  const padX = fontSizePx * 0.85
  const padY = fontSizePx * 0.4
  const x = pct(block.x, W)
  const y = pct(block.y, H)
  const text = applyCase(block.text, block.transform ?? 'uppercase')
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0.1)
  // Real glyph width via canvas measureText, plus tracking applied to every
  // glyph (browsers add letter-spacing after the last character too — using
  // (length - 1) under-estimated and was the root cause of "ФЕРМА" peeking
  // past the pill border). The 1.02× safety multiplier absorbs sub-pixel
  // shaping differences across Chrome / Safari / Firefox.
  const baseTextWidth = measureTextWidth(text, fontSizePx, block.weight, fontFamily)
  const trackedTextWidth = (baseTextWidth + letterSpacingPx * text.length) * 1.02
  const w = trackedTextWidth + padX * 2
  const h = fontSizePx + padY * 2
  return (
    <g data-role={role} opacity={block.opacity}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        ry={h / 2}
        fill="rgba(255,255,255,0.92)"
        stroke={block.fill}
        strokeWidth={Math.max(1, fontSizePx * 0.05)}
      />
      <text
        x={x + w / 2}
        y={y + h / 2}
        fill={block.fill}
        fontFamily={fontFamily}
        fontSize={fontSizePx}
        fontWeight={block.weight}
        letterSpacing={letterSpacingPx || undefined}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    </g>
  )
}

function CtaNode({
  role,
  block,
  W,
  H,
  fontFamily,
}: {
  role: string
  block: TextBlock & { bg: string; rx: number }
  W: number
  H: number
  fontFamily: string
}) {
  const x = pct(block.x, W)
  const y = pct(block.y, H)
  const w = pct(block.w, W)
  const h = pct(block.h ?? 7, H)
  const baseFontSizePx = resolveFontSizePx(block.fontSize, W)
  const rx = Math.min(block.rx, h / 2)
  const label = applyCase(block.text, block.transform)
  const minFontSizePx = Math.max(8, baseFontSizePx * 0.72)
  const labelMaxWidth = Math.max(0, w - baseFontSizePx * 1.7)
  const fontSizePx = fitCtaFontSize(label, baseFontSizePx, minFontSizePx, labelMaxWidth, block.weight, fontFamily)
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0.02)
  const renderRx = Math.min(block.rx, h / 2, w / 2)
  return (
    <g data-role={role} opacity={block.opacity}>
      <rect x={x} y={y} width={w} height={h} rx={renderRx || rx} ry={renderRx || rx} fill={block.bg} />
      <text
        x={x + w / 2}
        y={y + h / 2}
        fill={block.fill}
        fontFamily={fontFamily}
        fontSize={fontSizePx}
        fontWeight={block.weight}
        textAnchor="middle"
        dominantBaseline="central"
        letterSpacing={letterSpacingPx || undefined}
      >
        {label}
      </text>
    </g>
  )
}

function fitCtaFontSize(
  text: string,
  basePx: number,
  minPx: number,
  maxWidthPx: number,
  weight: number,
  fontFamily: string,
): number {
  if (!text || maxWidthPx <= 0) return basePx
  let size = basePx
  while (size > minPx) {
    const line = wrapText({
      text,
      fontSizePx: size,
      fontWeight: weight,
      fontFamily,
      maxWidthPx,
      maxLines: 1,
      overflow: 'clip',
      balance: false,
      avoidOrphans: false,
    })[0] ?? ''
    if (line === text) return size
    size = Math.max(minPx, size - 0.5)
  }
  return minPx
}

function applyCase(s: string, t?: TextBlock['transform']): string {
  if (t === 'uppercase') return s.toLocaleUpperCase()
  if (t === 'title-case') return s.replace(/\w\S*/g, (w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
  if (t === 'sentence-case') return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
  return s
}
