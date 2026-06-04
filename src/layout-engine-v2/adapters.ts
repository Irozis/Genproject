import type {
  FormatGroup,
  FormatSpecV2,
  LayoutElement,
  LayoutElementPriority,
  LayoutElementRole,
  LayoutRect,
  SourceMaterialV2,
} from './types'

type LegacyBlockLike = {
  x?: number
  y?: number
  w?: number
  h?: number
  width?: number
  height?: number
  visible?: boolean
  enabled?: boolean
  text?: string
  label?: string
  fontSize?: number
  minFontSize?: number
  minWidth?: number
  minHeight?: number
  canHide?: boolean
  canScale?: boolean
  canCrop?: boolean
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

type LegacySceneLike = {
  background?: LegacyBlockLike
  image?: LegacyBlockLike
  title?: LegacyBlockLike
  headline?: LegacyBlockLike
  subtitle?: LegacyBlockLike
  cta?: LegacyBlockLike
  logo?: LegacyBlockLike
  badge?: LegacyBlockLike
  decor?: LegacyBlockLike
  scrim?: LegacyBlockLike
  [key: string]: unknown
}

type LegacyProjectLike = {
  id?: string
  name?: string
  master?: LegacySceneLike
  masterScene?: LegacySceneLike
  scene?: LegacySceneLike
  brandKit?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
    [key: string]: unknown
  }
  brand?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

type LegacySafeAreaLike = {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

type LegacyFormatLike = {
  id?: string
  key?: string
  name?: string
  label?: string
  width?: number
  height?: number
  w?: number
  h?: number
  aspectRatio?: number
  aspect?: number
  group?: FormatGroup | string
  kind?: string
  type?: string
  safeArea?: LegacySafeAreaLike
  safe?: LegacySafeAreaLike
  safeZone?: LegacySafeAreaLike
  safeZones?: LegacySafeAreaLike
  [key: string]: unknown
}

export interface SceneAdapterOptions {
  sourceWidth?: number
  sourceHeight?: number
  id?: string
}

export interface FormatAdapterOptions {
  fallbackId?: string
  fallbackName?: string
}

const DEFAULT_SOURCE_WIDTH = 1080
const DEFAULT_SOURCE_HEIGHT = 1080

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function asPositiveNumber(value: unknown, fallback: number): number {
  return isNumber(value) && value > 0 ? value : fallback
}

function normalizeCoordinate(value: unknown, total: number, fallback: number): number {
  if (!isNumber(value)) {
    return fallback
  }

  if (value >= 0 && value <= 1) {
    return value * total
  }

  if (value >= 0 && value <= 100) {
    return (value / 100) * total
  }

  return value
}

function normalizeSize(value: unknown, total: number, fallback: number): number {
  if (!isNumber(value)) {
    return fallback
  }

  if (value >= 0 && value <= 1) {
    return value * total
  }

  if (value >= 0 && value <= 100) {
    return (value / 100) * total
  }

  return value
}

function normalizeFontSize(value: unknown, sourceWidth: number, fallback: number): number {
  if (!isNumber(value)) {
    return fallback
  }

  if (value > 0 && value <= 1) {
    return value * sourceWidth
  }

  if (value > 1 && value <= 100) {
    return (value / 100) * sourceWidth
  }

  return value
}

function clampRectToCanvas(rect: LayoutRect, width: number, height: number): LayoutRect {
  const x = Math.max(0, Math.min(rect.x, width))
  const y = Math.max(0, Math.min(rect.y, height))
  const maxWidth = Math.max(0, width - x)
  const maxHeight = Math.max(0, height - y)

  return {
    x,
    y,
    width: Math.max(1, Math.min(rect.width, maxWidth || 1)),
    height: Math.max(1, Math.min(rect.height, maxHeight || 1)),
  }
}

function fallbackRectForRole(role: LayoutElementRole, sourceWidth: number, sourceHeight: number): LayoutRect {
  if (role === 'background') {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
  }

  if (role === 'image') {
    return {
      x: sourceWidth * 0.52,
      y: sourceHeight * 0.16,
      width: sourceWidth * 0.4,
      height: sourceHeight * 0.58,
    }
  }

  if (role === 'headline') {
    return {
      x: sourceWidth * 0.08,
      y: sourceHeight * 0.16,
      width: sourceWidth * 0.48,
      height: sourceHeight * 0.18,
    }
  }

  if (role === 'subtitle') {
    return {
      x: sourceWidth * 0.08,
      y: sourceHeight * 0.38,
      width: sourceWidth * 0.46,
      height: sourceHeight * 0.1,
    }
  }

  if (role === 'cta') {
    return {
      x: sourceWidth * 0.08,
      y: sourceHeight * 0.54,
      width: sourceWidth * 0.24,
      height: sourceHeight * 0.08,
    }
  }

  if (role === 'logo') {
    return {
      x: sourceWidth * 0.08,
      y: sourceHeight * 0.82,
      width: sourceWidth * 0.16,
      height: sourceHeight * 0.07,
    }
  }

  if (role === 'badge') {
    return {
      x: sourceWidth * 0.08,
      y: sourceHeight * 0.08,
      width: sourceWidth * 0.16,
      height: sourceHeight * 0.06,
    }
  }

  return {
    x: sourceWidth * 0.9,
    y: sourceHeight * 0.9,
    width: sourceWidth * 0.05,
    height: sourceHeight * 0.05,
  }
}

function defaultPriorityForRole(role: LayoutElementRole): LayoutElementPriority {
  if (role === 'background' || role === 'headline') {
    return 'required'
  }

  if (role === 'image' || role === 'logo' || role === 'subtitle') {
    return 'important'
  }

  return 'optional'
}

function defaultMinFontSizeForRole(role: LayoutElementRole): number | undefined {
  if (role === 'headline') {
    return 14
  }

  if (role === 'subtitle') {
    return 10
  }

  if (role === 'cta') {
    return 10
  }

  if (role === 'badge') {
    return 9
  }

  return undefined
}

function defaultFontSizeForRole(role: LayoutElementRole, sourceWidth: number): number | undefined {
  if (role === 'headline') {
    return sourceWidth * 0.055
  }

  if (role === 'subtitle') {
    return sourceWidth * 0.028
  }

  if (role === 'cta') {
    return sourceWidth * 0.026
  }

  if (role === 'badge') {
    return sourceWidth * 0.022
  }

  return undefined
}

function defaultCanHide(role: LayoutElementRole, priority: LayoutElementPriority): boolean {
  if (priority === 'required') {
    return false
  }

  return role !== 'logo'
}

function blockToRect(
  block: LegacyBlockLike | undefined,
  role: LayoutElementRole,
  sourceWidth: number,
  sourceHeight: number,
): LayoutRect {
  const fallback = fallbackRectForRole(role, sourceWidth, sourceHeight)

  const x = normalizeCoordinate(block?.x, sourceWidth, fallback.x)
  const y = normalizeCoordinate(block?.y, sourceHeight, fallback.y)
  const width = normalizeSize(block?.w ?? block?.width, sourceWidth, fallback.width)
  const height = normalizeSize(block?.h ?? block?.height, sourceHeight, fallback.height)

  return clampRectToCanvas({ x, y, width, height }, sourceWidth, sourceHeight)
}

function blockIsVisible(block: LegacyBlockLike | undefined): boolean {
  if (!block) {
    return false
  }

  if (block.visible === false || block.enabled === false) {
    return false
  }

  return true
}

function blockToElement(params: {
  id: string
  role: LayoutElementRole
  block: LegacyBlockLike | undefined
  sourceWidth: number
  sourceHeight: number
  forceVisible?: boolean
}): LayoutElement {
  const priority = defaultPriorityForRole(params.role)
  const fontSize = defaultFontSizeForRole(params.role, params.sourceWidth)
  const minFontSize = defaultMinFontSizeForRole(params.role)

  return {
    id: params.id,
    role: params.role,
    priority,
    rect: blockToRect(params.block, params.role, params.sourceWidth, params.sourceHeight),
    visible: params.forceVisible ?? blockIsVisible(params.block),
    text: typeof params.block?.text === 'string' ? params.block.text : undefined,
    fontSize: normalizeFontSize(params.block?.fontSize, params.sourceWidth, fontSize ?? 0),
    minFontSize,
    minWidth: asPositiveNumber(params.block?.minWidth, undefined as unknown as number),
    minHeight: asPositiveNumber(params.block?.minHeight, undefined as unknown as number),
    canHide: defaultCanHide(params.role, priority),
    canScale: params.block?.canScale !== false,
    canCrop: params.role === 'image' || params.role === 'background' ? params.block?.canCrop !== false : false,
    metadata: {
      sourceRole: params.role,
      sourceBlock: params.block ? 'present' : 'fallback',
      ...params.block?.metadata,
    },
  }
}

function withoutUndefinedOptionalFields(element: LayoutElement): LayoutElement {
  return {
    ...element,
    minWidth: Number.isFinite(element.minWidth) ? element.minWidth : undefined,
    minHeight: Number.isFinite(element.minHeight) ? element.minHeight : undefined,
    fontSize: element.fontSize && element.fontSize > 0 ? element.fontSize : undefined,
  }
}

function getSceneFromProject(project: LegacyProjectLike): LegacySceneLike {
  const candidate = project.master ?? project.masterScene ?? project.scene

  if (!candidate) {
    throw new Error('Cannot adapt project: no master/masterScene/scene field found.')
  }

  return candidate
}

export function sceneToSourceMaterialV2(scene: LegacySceneLike, options: SceneAdapterOptions = {}): SourceMaterialV2 {
  const sourceWidth = options.sourceWidth ?? DEFAULT_SOURCE_WIDTH
  const sourceHeight = options.sourceHeight ?? DEFAULT_SOURCE_HEIGHT

  const elements = [
    blockToElement({
      id: 'background',
      role: 'background',
      block: scene.background,
      sourceWidth,
      sourceHeight,
      forceVisible: true,
    }),
    blockToElement({
      id: 'product-image',
      role: 'image',
      block: scene.image,
      sourceWidth,
      sourceHeight,
    }),
    blockToElement({
      id: 'headline',
      role: 'headline',
      block: scene.headline ?? scene.title,
      sourceWidth,
      sourceHeight,
      forceVisible: true,
    }),
    blockToElement({
      id: 'subtitle',
      role: 'subtitle',
      block: scene.subtitle,
      sourceWidth,
      sourceHeight,
    }),
    blockToElement({
      id: 'cta',
      role: 'cta',
      block: scene.cta,
      sourceWidth,
      sourceHeight,
    }),
    blockToElement({
      id: 'logo',
      role: 'logo',
      block: scene.logo,
      sourceWidth,
      sourceHeight,
    }),
    blockToElement({
      id: 'badge',
      role: 'badge',
      block: scene.badge,
      sourceWidth,
      sourceHeight,
    }),
    blockToElement({
      id: 'decor',
      role: 'decor',
      block: scene.decor,
      sourceWidth,
      sourceHeight,
    }),
  ].map(withoutUndefinedOptionalFields)

  return {
    id: options.id ?? 'adapted-source-material',
    elements,
    metadata: {
      adapter: 'sceneToSourceMaterialV2',
      sourceWidth,
      sourceHeight,
    },
  }
}

export function projectToSourceMaterialV2(project: LegacyProjectLike, options: SceneAdapterOptions = {}): SourceMaterialV2 {
  const source = sceneToSourceMaterialV2(getSceneFromProject(project), {
    ...options,
    id: options.id ?? project.id ?? project.name ?? 'adapted-project',
  })

  const brand = project.brandKit ?? project.brand

  return {
    ...source,
    brand: brand
      ? {
          primaryColor: brand.primaryColor,
          secondaryColor: brand.secondaryColor,
          fontFamily: brand.fontFamily,
        }
      : undefined,
  }
}

function deriveFormatGroup(width: number, height: number, explicitGroup?: string): FormatGroup {
  if (
    explicitGroup === 'square' ||
    explicitGroup === 'horizontal' ||
    explicitGroup === 'vertical' ||
    explicitGroup === 'small' ||
    explicitGroup === 'wide' ||
    explicitGroup === 'narrow' ||
    explicitGroup === 'logo'
  ) {
    return explicitGroup
  }

  const ratio = width / height

  if (width <= 240 && height <= 240 && ratio >= 0.75 && ratio <= 1.33) {
    return 'logo'
  }

  if (height <= 60) {
    return 'small'
  }

  if (height <= 120 && ratio >= 3) {
    return 'wide'
  }

  if (width <= 240 && height > width * 2) {
    return 'narrow'
  }

  if (ratio >= 1.25) {
    return 'horizontal'
  }

  if (ratio <= 0.8) {
    return 'vertical'
  }

  return 'square'
}

function normalizeSafeArea(format: LegacyFormatLike, width: number, height: number): {
  top: number
  right: number
  bottom: number
  left: number
} {
  const source = format.safeArea ?? format.safe ?? format.safeZone ?? format.safeZones

  if (source) {
    return {
      top: Math.max(0, source.top ?? 0),
      right: Math.max(0, source.right ?? 0),
      bottom: Math.max(0, source.bottom ?? 0),
      left: Math.max(0, source.left ?? 0),
    }
  }

  const marginX = Math.round(width * 0.04)
  const marginY = Math.round(height * 0.04)

  return {
    top: marginY,
    right: marginX,
    bottom: marginY,
    left: marginX,
  }
}

export function formatRuleSetToFormatSpecV2(
  format: LegacyFormatLike,
  options: FormatAdapterOptions = {},
): FormatSpecV2 {
  const width = asPositiveNumber(format.width ?? format.w, 1080)
  const height = asPositiveNumber(format.height ?? format.h, 1080)

  return {
    id: format.id ?? format.key ?? options.fallbackId ?? `${width}x${height}`,
    name: format.name ?? format.label ?? options.fallbackName ?? `${width}×${height}`,
    width,
    height,
    aspectRatio: isNumber(format.aspectRatio) ? format.aspectRatio : width / height,
    group: deriveFormatGroup(width, height, typeof format.group === 'string' ? format.group : undefined),
    safeArea: normalizeSafeArea(format, width, height),
  }
}