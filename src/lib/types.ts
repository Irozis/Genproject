// All core types for Adaptive Graphics live in this single file.
// Keep flat. No deep nesting. No fallback/scoring/archetype shapes.

export type BuiltinFormatKey =
  | 'vk-square'
  | 'vk-vertical'
  | 'vk-landscape'
  | 'vk-stories'
  | 'telegram-story'
  | 'instagram-story'
  | 'wb-card'
  | 'wb-infographic'
  | 'ozon-card'
  | 'ozon-fresh-square'
  | 'yandex-market-card'
  | 'yandex-market-banner'
  | 'yandex-market-stretch'
  | 'yandex-market-vertical'
  | 'avito-listing'
  | 'avito-fullscreen'
  | 'avito-skyscraper'
  | 'yandex-rsy-240x400'
  | 'yandex-rsy-300x250'
  | 'yandex-rsy-728x90'
export type FormatKey = BuiltinFormatKey | `custom:${string}`

export type CompositionModel =
  | 'text-dominant'
  | 'split-right-image'
  | 'hero-overlay'
  | 'image-top-text-bottom'

export type CtaStyle = 'pill' | 'rounded' | 'sharp'

export type GoalKey = 'promo-pack' | 'product-highlight' | 'announcement'

export type VisualSystemKey = 'product-card' | 'minimal' | 'bold-editorial'

export type OnboardingMode = 'reference' | 'master' | 'template'

export type View = 'onboarding' | 'templates' | 'editor'

export type BlockKind = 'title' | 'subtitle' | 'cta' | 'badge' | 'logo' | 'image'

// Position & size in % of format dimensions (0..100).
export type Block = {
  x: number
  y: number
  w: number
  h?: number
}

export type TextAlign = 'left' | 'center' | 'right'

export type TextFitMode = 'auto' | 'clamp' | 'ellipsis' | 'overflow'

export type LayoutDensity = 'compact' | 'balanced' | 'spacious'

export type TextBlock = Block & {
  text: string
  textByLocale?: Record<string, string>
  fontSize: number        // % of format width
  charsPerLine: number    // legacy heuristic, retained for compatibility
  maxLines: number
  fitMode?: TextFitMode
  weight: number          // 400, 600, 800, 900
  fill: string
  opacity?: number
  letterSpacing?: number  // em units; title −0.02, subtitle 0, badge 0.08
  lineHeight?: number     // multiplier; title 1.02, subtitle 1.35
  /** Horizontal alignment within the block's width. Default 'left'. */
  align?: TextAlign
  transform?: 'none' | 'uppercase' | 'title-case' | 'sentence-case'
  /** Per-block CSS font-family override. When absent, the brand kit's
   *  display/text font is used (decided by the renderer per block role). */
  fontFamily?: string
  /** Optional text-shadow / halo for legibility on photographic backgrounds.
   *  Layouts add this automatically when local image brightness under the
   *  text bbox is high enough to wash out plain fills. */
  halo?: { color: string; opacity: number; blurPx: number }
}

export type CtaBlock = TextBlock & {
  bg: string
  rx: number            // corner radius in px
}

export type ImageBlock = Block & {
  src: string | null
  rx: number
  fit: 'cover' | 'contain'
  // Focal point in normalized [0..1] coords. Controls where the image gets
  // anchored when the block aspect differs from the source aspect (i.e. which
  // part stays in frame when cover-cropping). Default 0.5/0.5 = center.
  focalX?: number
  focalY?: number
  cropZoom?: number
  cropX?: number
  cropY?: number
}

export type LogoBlock = Block & {
  src: string | null
  bgOpacity: number
}

export type BlockOverride = Partial<Block & TextBlock & CtaBlock & ImageBlock & LogoBlock> & {
  /** Hide this block in the format(s) that own this override. Lets the user
   *  drop, say, a badge from a single format without disabling it project-wide
   *  via the master `enabled` map. Only meaningful inside `BlockOverrides`. */
  hidden?: boolean
}

export type BlockOverrides = Partial<Record<FormatKey, Partial<Record<BlockKind, BlockOverride>>>>

export type Scrim = {
  y: number          // top of scrim band, % of height
  h: number          // height of scrim band, %
  color: string      // base color (hex)
  opacity: number    // 0..1
  // Gradient direction. 'down' (default) = transparent at the top of the
  // band, opaque at the bottom — matches text anchored to the canvas
  // bottom (default hero-overlay). 'up' = opaque at the top, transparent
  // at the bottom — used when the text stack is anchored to the canvas
  // top instead.
  direction?: 'down' | 'up'
}

// -------- Background ----------------------------------------------------
// Four discrete "moods". No random; each template picks exactly one.

export type Background =
  | {
      kind: 'gradient'
      stops: [string, string, string]
      /** When set, render as a radial gradient centered on (cx,cy) in 0..1
       *  coords. Used for focal-aware backgrounds — the gradient emanates
       *  from wherever the image's subject sits. Absent = plain linear. */
      radial?: { cx: number; cy: number }
    }
  | { kind: 'solid'; color: string }
  | { kind: 'tonal'; base: string }                              // auto-generates 3 stops from one hex
  | { kind: 'split'; a: string; b: string; angle: 0 | 90 }       // 0=horizontal, 90=vertical

// -------- Decor (one per layout) ---------------------------------------

export type Decor =
  | { kind: 'corner-circle'; corner: 'tl' | 'tr' | 'bl' | 'br'; size: number; color: string; opacity: number }
  | { kind: 'diagonal-stripe'; color: string; opacity: number }
  | { kind: 'rule'; y: number; color: string; opacity: number }
  // Dotted grid — sparse array of dots filling the canvas. `density` is the
  // number of dots per 100% of width (6–12 typical).
  | { kind: 'dotted-grid'; density: number; color: string; opacity: number }
  // L-shaped corner bracket in the specified corner; size in %.
  | { kind: 'corner-bracket'; corner: 'tl' | 'tr' | 'bl' | 'br'; size: number; color: string; opacity: number }
  // Half-circle bleeding off one edge — good for bold, editorial moods.
  | { kind: 'half-circle'; edge: 'top' | 'right' | 'bottom' | 'left'; size: number; color: string; opacity: number }
  // Film-grain noise overlay via SVG feTurbulence. `seed` keeps the pattern
  // deterministic; `intensity` (0..1) scales the darken. No external assets.
  | { kind: 'grain'; seed: number; intensity: number }

export type Scene = {
  background: Background
  accent: string
  scrim?: Scrim
  decor?: Decor

  title?: TextBlock
  subtitle?: TextBlock
  cta?: CtaBlock
  badge?: TextBlock
  logo?: LogoBlock
  image?: ImageBlock
}

export type EnabledMap = Record<BlockKind, boolean>

// Semantic color tokens. Every template + user brand resolves to this shape.
// - ink        — primary text color
// - inkMuted   — secondary text, captions
// - surface    — a neutral color used for CTA fill when the accent itself is dark
// - accent     — brand accent, used for accent color + CTA background
// - accentSoft — a desaturated accent, used for decor fills and soft tints
export type Palette = {
  ink: string
  inkMuted: string
  surface: string
  accent: string
  accentSoft: string
}

export type BrandKit = {
  brandName: string
  // Font pair: display drives headlines & CTA; text drives subtitle & badge.
  displayFont: string
  textFont: string
  palette: Palette
  // Gradient kept as the default seed for backgrounds of type 'gradient'.
  gradient: [string, string, string]
  toneOfVoice: Tone
  ctaStyle: CtaStyle
}

export type Tone = 'neutral' | 'bold' | 'friendly' | 'minimal' | 'editorial'

export type BrandSnapshot = {
  id: string
  name: string
  brandKit: BrandKit
  createdAt: number
}

export type AssetHint = {
  width: number
  height: number
  aspectRatio: number
  dominantColors: string[]
  isDarkBackground: boolean
  /** Average luminance of the bottom 35% band (0..1). Drives scrim opacity
   *  in hero-overlay so white text stays readable regardless of photo. */
  bottomBandBrightness?: number
  /** Coarse 4×4 luminance grid of the image (row-major, rows top→bottom,
   *  cols left→right, values 0..1). Enables per-block "how bright is the
   *  patch behind this text" queries so halos / scrims can be local, not
   *  just rectangular bands. */
  brightnessGrid?: number[][]
}

export type Project = {
  id: string
  name: string
  master: Scene
  enabled: EnabledMap
  brandKit: BrandKit
  goal: GoalKey
  visualSystem: VisualSystemKey
  assetHint: AssetHint | null
  imageSrc: string | null
  logoSrc: string | null
  selectedFormats: FormatKey[]
  // Optional per-format override: force a specific composition model for a given
  // format key instead of the one chosen by the profile. Templates ship with
  // sensible defaults here; users can override manually.
  formatOverrides?: Partial<Record<FormatKey, CompositionModel>>
  // Per-format image focal point. When absent, the master image focal is used.
  // A square image doesn't need this; portrait-vs-landscape crops do.
  imageFocals?: Partial<Record<FormatKey, { x: number; y: number }>>
  // Per-format block geometry overrides copied/pasted between previews.
  // Only x/y/w/h are overridden; text + style still come from the layout.
  blockOverrides?: BlockOverrides
  layoutDensity?: LayoutDensity
  formatDensities?: Partial<Record<FormatKey, LayoutDensity>>
  // Prevent image analysis from rewriting brand palette + gradient.
  paletteLocked?: boolean
  activeLocale?: string
  availableLocales?: string[]
  customFormats?: FormatRuleSet[]
}

export type FormatRuleSet = {
  key: FormatKey
  label: string
  width: number
  height: number
  aspectRatio: number
  safeZone: { top: number; right: number; bottom: number; left: number }   // %
  gutter: number                // spacing unit, % of width — drives all vertical rhythm
  minTitleSize: number          // %
  maxTitleLines: number
  /** Multiplier on base title/subtitle font sizes. Tall/thin formats
   *  (story-vertical) read as having smaller type at the same %-of-width —
   *  a boost above 1.0 compensates. Absent or 1.0 = no change. */
  typescaleBoost?: number
  requiredElements: BlockKind[]
}
