import { contrastRatio } from './color'
import { checkOverflow } from './fixLayout'
import type { BrandKit, FormatRuleSet, RuleSource, Scene } from './types'

export type Check = {
  rule: string
  status: 'pass' | 'warn' | 'fail'
  detail?: string
}

export type ComplianceEntry = {
  formatId: string
  locale: string
  checks: Check[]
  officialErrors: ValidationFinding[]
  layoutWarnings: ValidationFinding[]
  heuristicWarnings: ValidationFinding[]
}

export type ValidationCategory = 'official' | 'layout' | 'heuristic'
export type ValidationSeverity = 'error' | 'warning'

export type ValidationFindingCode =
  | 'invalidSize'
  | 'unsupportedFileType'
  | 'fileSizeExceeded'
  | 'officialSafeZoneViolation'
  | 'officialOverlayZoneViolation'
  | 'officialTextLimitViolation'
  | 'officialRequiredElementMissing'
  | 'imageTooSmall'
  | 'splitImageTooSmall'
  | 'splitImageNotFillingSlot'
  | 'largeEmptyAreaDetected'
  | 'textBlockTooWide'
  | 'ctaDetachedFromText'
  | 'subtitleOverflow'
  | 'bodyOverflow'
  | 'horizontalLayoutBroken'
  | 'verticalLayoutBroken'
  | 'ctaNotVisible'
  | 'textTooSmall'
  | 'imageCropRisk'
  | 'layoutFallbackApplied'
  | 'unexpectedGradient'
  | 'gradientAppliedWithoutTextOverlay'
  | 'imageShrunkByPostProcess'
  | 'horizontalTextOverflow'
  | 'horizontalHeadlineTooTall'
  | 'horizontalSubtitleOverflow'
  | 'horizontalCtaOverflow'
  | 'splitCollapsedToTextOnly'
  | 'horizontalModeUsingPortraitLogic'
  | 'horizontalModeNeedsCompactFallback'
  | 'heuristicRuleApplied'
  | 'derivedRuleApplied'
  | 'unknownRuleSource'
  | 'needsManualReview'
  | 'layoutNotOfficiallySpecified'
  | 'percentageRegionsAreInternalModel'
  | 'gradientRuleIsHeuristic'

export type ValidationFinding = {
  code: ValidationFindingCode
  category: ValidationCategory
  severity: ValidationSeverity
  message: string
  detail?: string
  source?: RuleSource
}

type SceneWithBlocks = Scene & {
  blocks?: Array<{ id?: string; x?: number; y?: number; w?: number; h?: number }>
  frame?: { x?: number; y?: number; w?: number; h?: number }
}

type LayoutBlock = { x: number; y: number; w: number; h?: number }

export function runCompliance(scene: Scene, format: FormatRuleSet, brand: BrandKit): ComplianceEntry {
  const sceneInput = scene as SceneWithBlocks
  const checks: Check[] = []
  const officialErrors: ValidationFinding[] = []
  const layoutWarnings: ValidationFinding[] = []
  const heuristicWarnings: ValidationFinding[] = []
  const overflowIssues = checkOverflow(scene, format)

  const safeZoneIssues = overflowIssues.filter((issue) => /safe area/.test(issue.message))
  checks.push({
    rule: 'safe zone',
    status: safeZoneIssues.length > 0 ? 'fail' : 'pass',
    detail: safeZoneIssues.length > 0 ? safeZoneIssues.map((issue) => issue.message).join('; ') : undefined,
  })
  if (safeZoneIssues.length > 0 && isOfficial(format.ruleSources?.safeArea)) {
    officialErrors.push(finding('officialSafeZoneViolation', 'official', 'error', 'Нарушена официальная safe zone формата.', {
      detail: safeZoneIssues.map((issue) => issue.message).join('; '),
      source: format.ruleSources?.safeArea,
    }))
  }

  const overlayIssues = overflowIssues.filter((issue) => /overlay zone/.test(issue.message))
  checks.push({
    rule: 'overlay zones',
    status: overlayIssues.length > 0 ? 'fail' : 'pass',
    detail: overlayIssues.length > 0 ? overlayIssues.map((issue) => issue.message).join('; ') : undefined,
  })
  if (overlayIssues.length > 0 && isOfficial(format.ruleSources?.overlayZones)) {
    officialErrors.push(finding('officialOverlayZoneViolation', 'official', 'error', 'Важный элемент попал в официальную overlay zone.', {
      detail: overlayIssues.map((issue) => issue.message).join('; '),
      source: format.ruleSources?.overlayZones,
    }))
  }

  const visibleIssues = overflowIssues.filter((issue) => /visible area/.test(issue.message))
  checks.push({
    rule: 'visible area',
    status: visibleIssues.length > 0 ? 'fail' : 'pass',
    detail: visibleIssues.length > 0 ? visibleIssues.map((issue) => issue.message).join('; ') : undefined,
  })

  const bg = approximateBackgroundColor(scene, brand)
  const textBlocks = [scene.title, scene.subtitle, scene.badge, scene.cta].filter(
    (block): block is NonNullable<typeof block> => !!block,
  )
  const ratios = textBlocks.map((block) => contrastRatio(block.fill, bg))
  const minRatio = ratios.length > 0 ? Math.min(...ratios) : 21
  checks.push({
    rule: 'WCAG AA contrast',
    status: minRatio < 3 ? 'fail' : minRatio < 4.5 ? 'warn' : 'pass',
    detail: `min ratio ${minRatio.toFixed(2)} (thresholds: fail < 3.0, warn < 4.5, pass >= 4.5)`,
  })

  const presentIds = collectPresentBlockIds(sceneInput)
  const missing = format.requiredElements.filter((required) => !presentIds.has(required))
  checks.push({
    rule: 'required elements',
    status: missing.length > 0 ? 'fail' : 'pass',
    detail: missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
  })
  if (missing.length > 0 && isOfficial(format.ruleSources?.layoutDefaults)) {
    officialErrors.push(finding('officialRequiredElementMissing', 'official', 'error', 'Отсутствует обязательный элемент, подтверждённый источником правила.', {
      detail: `missing: ${missing.join(', ')}`,
      source: format.ruleSources?.layoutDefaults,
    }))
  }

  const overflowBlocks = getOverflowingBlocks(sceneInput)
  checks.push({
    rule: 'overflow',
    status: overflowBlocks.length > 0 ? 'fail' : 'pass',
    detail: overflowBlocks.length > 0 ? `out of frame: ${overflowBlocks.join(', ')}` : undefined,
  })

  const textLimitIssues = overflowIssues.filter((issue) => /exceeds|Text area may exceed/.test(issue.message))
  checks.push({
    rule: 'platform text limits',
    status: textLimitIssues.some((issue) => issue.level === 'warn') ? 'fail' : textLimitIssues.length > 0 ? 'warn' : 'pass',
    detail: textLimitIssues.length > 0 ? textLimitIssues.map((issue) => issue.message).join('; ') : undefined,
  })
  if (textLimitIssues.length > 0 && isOfficial(format.ruleSources?.typographyLimits)) {
    officialErrors.push(finding('officialTextLimitViolation', 'official', 'error', 'Нарушено официальное текстовое ограничение формата.', {
      detail: textLimitIssues.map((issue) => issue.message).join('; '),
      source: format.ruleSources?.typographyLimits,
    }))
  }

  const estimatedKb = estimatePngExportKb(format.width, format.height)
  checks.push({
    rule: 'estimated export size',
    status: format.maxFileSizeKb && estimatedKb > format.maxFileSizeKb ? 'warn' : 'pass',
    detail: format.maxFileSizeKb ? `~${estimatedKb} KB PNG estimate, limit ${format.maxFileSizeKb} KB` : undefined,
  })
  if (format.maxFileSizeKb && estimatedKb > format.maxFileSizeKb && isOfficial(format.ruleSources?.fileConstraints)) {
    officialErrors.push(finding('fileSizeExceeded', 'official', 'error', 'Превышен официальный лимит размера файла.', {
      detail: `~${estimatedKb} KB PNG estimate, limit ${format.maxFileSizeKb} KB`,
      source: format.ruleSources?.fileConstraints,
    }))
  }

  layoutWarnings.push(...collectLayoutWarnings(sceneInput, format, overflowIssues))
  heuristicWarnings.push(...collectHeuristicWarnings(scene, format))

  return {
    formatId: format.key,
    locale: 'default',
    checks,
    officialErrors: dedupeFindings(officialErrors),
    layoutWarnings: dedupeFindings(layoutWarnings),
    heuristicWarnings: dedupeFindings(heuristicWarnings),
  }
}

function finding(
  code: ValidationFindingCode,
  category: ValidationCategory,
  severity: ValidationSeverity,
  message: string,
  options: { detail?: string; source?: RuleSource } = {},
): ValidationFinding {
  return { code, category, severity, message, ...options }
}

function isOfficial(source: RuleSource | undefined): boolean {
  return source?.type === 'official'
}

function collectLayoutWarnings(
  scene: SceneWithBlocks,
  format: FormatRuleSet,
  overflowIssues: Array<{ level: string; message: string }>,
): ValidationFinding[] {
  const warnings: ValidationFinding[] = []
  const family = layoutFamily(scene, format)
  const imageCoverage = blockCoverage(scene.image)
  const importantCoverage = importantBlocksCoverage(scene)
  const title = scene.title
  const subtitle = scene.subtitle
  const cta = scene.cta
  const horizontal = isHorizontalFamily(family)
  const titleH = title ? blockHeight(title, format) : 0
  const subtitleH = subtitle ? blockHeight(subtitle, format) : 0
  const ctaH = cta ? (cta.h ?? blockHeight(cta, format)) : 0
  const textStackH = titleH + subtitleH + ctaH
  const allowedTextH = 100 - format.safeZone.top - format.safeZone.bottom

  if (horizontal && scene.image && imageCoverage < 0.18) {
    warnings.push(finding('imageTooSmall', 'layout', 'warning', 'Изображение занимает слишком малую часть горизонтального формата.'))
  }

  if (horizontal && scene.image) {
    const slotW = expectedSplitImageSlotWidth(format)
    const slotH = 100 - format.safeZone.top - format.safeZone.bottom
    const slotCoverage = (slotW * slotH) / 10000
    if (imageCoverage < Math.min(0.30, slotCoverage * 0.78)) {
      warnings.push(finding('splitImageTooSmall', 'layout', 'warning', 'Split image coverage is below the expected image zone.'))
      warnings.push(finding('splitCollapsedToTextOnly', 'layout', 'warning', 'Horizontal split image zone collapsed toward a text-only layout.'))
    }
    if (scene.image.w < slotW * 0.70 || (scene.image.h ?? 0) < slotH * 0.70) {
      warnings.push(finding('splitImageNotFillingSlot', 'layout', 'warning', 'Split image is not filling its allocated image slot.'))
      warnings.push(finding('imageShrunkByPostProcess', 'layout', 'warning', 'Image appears to have been shrunk after split slot placement.'))
      warnings.push(finding('splitCollapsedToTextOnly', 'layout', 'warning', 'Horizontal split image zone collapsed toward a text-only layout.'))
    }
  }

  if (horizontal && textStackH > allowedTextH * 0.88) {
    warnings.push(finding('horizontalTextOverflow', 'layout', 'warning', 'Horizontal text stack consumes too much vertical space.'))
  }

  if (horizontal && title && titleH > allowedTextH * (format.aspectRatio >= 2.2 ? 0.72 : 0.58)) {
    warnings.push(finding('horizontalHeadlineTooTall', 'layout', 'warning', 'Horizontal headline is too tall for the available banner height.'))
  }

  if (horizontal && subtitle && subtitleH > allowedTextH * 0.24) {
    warnings.push(finding('horizontalSubtitleOverflow', 'layout', 'warning', 'Horizontal subtitle exceeds the compact subtitle band.'))
  }

  if (horizontal && cta && (cta.y < format.safeZone.top || cta.y + ctaH > 100 - format.safeZone.bottom)) {
    warnings.push(finding('horizontalCtaOverflow', 'layout', 'warning', 'Horizontal CTA is outside the text zone.'))
  }

  if (horizontal && scene.image && scene.image.w > 62 && (scene.image.h ?? 0) < 65) {
    warnings.push(finding('horizontalModeUsingPortraitLogic', 'layout', 'warning', 'Horizontal mode appears to reuse portrait/card image logic.'))
  }

  if (horizontal && scene.layoutPolicy?.needsManualReview) {
    warnings.push(finding('horizontalModeNeedsCompactFallback', 'layout', 'warning', 'Horizontal mode needs compact fallback or manual review.'))
  }

  if (horizontal && importantCoverage > 0 && (importantCoverage < 0.32 || imageCoverage < 0.12)) {
    warnings.push(finding('largeEmptyAreaDetected', 'layout', 'warning', 'Обнаружена большая пустая зона в горизонтальной композиции.'))
  }

  if (title && ((horizontal && title.w > 72) || title.w > 82)) {
    warnings.push(finding('textBlockTooWide', 'layout', 'warning', 'Текстовый блок слишком широкий для стабильной читаемости.'))
  }

  if (cta && title && blockDistance(cta, title) > (family === 'vertical' || family === 'tallVertical' ? 22 : 28)) {
    warnings.push(finding('ctaDetachedFromText', 'layout', 'warning', 'CTA расположен слишком далеко от текстового блока.'))
  }

  if (subtitle && overflowIssues.some((issue) => /subtitle|description|Text area may exceed/i.test(issue.message))) {
    warnings.push(finding('subtitleOverflow', 'layout', 'warning', 'Второстепенный текст может не помещаться в текущий блок.'))
    warnings.push(finding('bodyOverflow', 'layout', 'warning', 'Body-текст может не помещаться в текущий блок.'))
  }

  if (horizontal && scene.image && title && !blocksAreSideBySide(scene.image, title)) {
    warnings.push(finding('horizontalLayoutBroken', 'layout', 'warning', 'Горизонтальный формат выглядит не как split-композиция.'))
  }

  if ((family === 'vertical' || family === 'tallVertical') && scene.image && title && scene.image.y > title.y) {
    warnings.push(finding('verticalLayoutBroken', 'layout', 'warning', 'Вертикальная композиция нарушена: изображение не является верхней или фоновой областью.'))
  }

  if (!cta && format.requiredElements.includes('cta')) {
    warnings.push(finding('ctaNotVisible', 'layout', 'warning', 'CTA не виден в макете и требует проверки.'))
  }

  if ([scene.title, scene.subtitle, scene.cta, scene.badge].some((block) => block && block.fontSize < Math.max(3.2, format.minFontSize ?? 0))) {
    warnings.push(finding('textTooSmall', 'layout', 'warning', 'Текст может быть слишком мелким для чтения.'))
  }

  if (scene.image?.fit === 'cover' && scene.layoutPolicy?.needsManualReview) {
    warnings.push(finding('imageCropRisk', 'layout', 'warning', 'Есть риск неудачного кадрирования изображения, требуется ручная проверка.'))
  }

  if (scene.layoutPolicy?.appliedRules.includes('manual-review-fallback')) {
    warnings.push(finding('layoutFallbackApplied', 'layout', 'warning', 'Применён fallback компактной компоновки.'))
  }

  if (scene.background.kind === 'gradient' && scene.layoutPolicy?.formatKind !== 'vertical' && scene.layoutPolicy?.formatKind !== 'tallVertical') {
    warnings.push(finding('unexpectedGradient', 'layout', 'warning', 'Градиент применён вне heroOverlay-подобной вертикальной композиции и требует проверки.'))
  }

  if ((scene.background.kind === 'gradient' || scene.scrim) && scene.image && !textOverlapsImage(scene)) {
    warnings.push(finding('gradientAppliedWithoutTextOverlay', 'layout', 'warning', 'Gradient or overlay is applied without text over the image.'))
  }

  return dedupeFindings(warnings)
}

function collectHeuristicWarnings(scene: Scene, format: FormatRuleSet): ValidationFinding[] {
  const warnings: ValidationFinding[] = []
  const sources = format.ruleSources ? Object.values(format.ruleSources) : []
  const layoutSource = format.ruleSources?.layoutDefaults
  const percentageSource = firstSourceByType(sources, ['derived', 'heuristic', 'manual', 'unknown']) ?? layoutSource

  if (sources.some((source) => source.type === 'heuristic') || scene.layoutPolicy?.source.type === 'heuristic') {
    warnings.push(finding(
      'heuristicRuleApplied',
      'heuristic',
      'warning',
      'Правило компоновки для этого формата является эвристическим и требует ручной проверки перед реальной рекламной кампанией.',
      { source: firstSourceByType(sources, ['heuristic']) ?? scene.layoutPolicy?.source },
    ))
  }

  if (sources.some((source) => source.type === 'derived')) {
    warnings.push(finding(
      'derivedRuleApplied',
      'heuristic',
      'warning',
      'Размер формата подтверждён, но расположение элементов является внутренним правилом приложения.',
      { source: firstSourceByType(sources, ['derived']) },
    ))
  }

  if (sources.some((source) => source.type === 'unknown' || source.type === 'manual')) {
    warnings.push(finding(
      'unknownRuleSource',
      'heuristic',
      'warning',
      'Источник части правил не подтверждён официально и требует ручной проверки.',
      { source: firstSourceByType(sources, ['unknown', 'manual']) },
    ))
  }

  if (format.ruleConfidence === 'low' || scene.layoutPolicy?.needsManualReview || sources.some((source) => source.type === 'unknown' || source.type === 'manual')) {
    warnings.push(finding('needsManualReview', 'heuristic', 'warning', 'Спорные правила или результат layout требуют ручной проверки перед реальной рекламной кампанией.'))
  }

  if (!isOfficial(layoutSource)) {
    warnings.push(finding(
      'layoutNotOfficiallySpecified',
      'heuristic',
      'warning',
      'Композиция элементов является внутренним правилом приложения, а не официальным требованием площадки.',
      { source: layoutSource },
    ))
  }

  warnings.push(finding(
    'percentageRegionsAreInternalModel',
    'heuristic',
    'warning',
    'Процентные зоны image/text/CTA являются внутренней моделью приложения, а не официальным требованием площадки.',
    { source: percentageSource },
  ))

  if (scene.layoutPolicy || layoutSource?.type === 'heuristic') {
    warnings.push(finding(
      'gradientRuleIsHeuristic',
      'heuristic',
      'warning',
      'Градиент отключён по умолчанию как эвристика для предотвращения визуального шума.',
      { source: scene.layoutPolicy?.source ?? layoutSource },
    ))
  }

  return dedupeFindings(warnings)
}

function firstSourceByType(sources: RuleSource[], types: RuleSource['type'][]): RuleSource | undefined {
  return sources.find((source) => types.includes(source.type))
}

function layoutFamily(scene: Scene, format: FormatRuleSet): string {
  if (scene.layoutPolicy?.formatKind) return scene.layoutPolicy.formatKind
  if (format.aspectRatio < 0.55) return 'tallVertical'
  if (format.width < 400 || format.height < 180 || format.width * format.height < 90000) return 'tinySmall'
  if (format.aspectRatio >= 1.6) return 'horizontal'
  if (format.aspectRatio <= 0.75) return 'vertical'
  if (format.aspectRatio >= 0.85 && format.aspectRatio <= 1.2) return 'square'
  return 'landscape'
}

function blockCoverage(block: { w: number; h?: number } | undefined): number {
  if (!block?.h) return 0
  return (block.w * block.h) / 10000
}

function blockHeight(block: { h?: number; fontSize?: number; maxLines?: number; lineHeight?: number }, format: FormatRuleSet): number {
  return block.h ?? ((block.fontSize ?? 3) * (block.lineHeight ?? 1.2) * Math.max(1, block.maxLines ?? 1) * format.aspectRatio)
}

function isHorizontalFamily(family: string): boolean {
  return family === 'horizontal' || family === 'ultraWideHorizontal' || family === 'landscape'
}

function expectedSplitImageSlotWidth(format: FormatRuleSet): number {
  const innerW = 100 - format.safeZone.left - format.safeZone.right
  const ratio = format.aspectRatio >= 6 ? 0.28 : format.aspectRatio >= 4 ? 0.34 : 0.45
  const minW = format.aspectRatio >= 6 ? 24 : format.aspectRatio >= 4 ? 30 : 40
  const maxW = format.aspectRatio >= 6 ? 36 : 55
  return Math.min(maxW, Math.max(minW, innerW * ratio))
}

function importantBlocksCoverage(scene: SceneWithBlocks): number {
  const blocks: LayoutBlock[] = [scene.image, scene.title, scene.subtitle, scene.cta].flatMap((block) =>
    block ? [{ x: block.x, y: block.y, w: block.w, h: block.h }] : [],
  )
  if (blocks.length === 0) return 0
  const left = Math.min(...blocks.map((block) => block.x))
  const top = Math.min(...blocks.map((block) => block.y))
  const right = Math.max(...blocks.map((block) => block.x + block.w))
  const bottom = Math.max(...blocks.map((block) => block.y + (block.h ?? 0)))
  return ((right - left) * (bottom - top)) / 10000
}

function blockDistance(
  a: { x: number; y: number; w: number; h?: number },
  b: { x: number; y: number; w: number; h?: number },
): number {
  const ax = a.x + a.w / 2
  const ay = a.y + (a.h ?? 0) / 2
  const bx = b.x + b.w / 2
  const by = b.y + (b.h ?? 0) / 2
  return Math.hypot(ax - bx, ay - by)
}

function blocksAreSideBySide(
  image: { x: number; w: number },
  text: { x: number; w: number },
): boolean {
  const imageRight = image.x + image.w
  const textRight = text.x + text.w
  return imageRight <= text.x || textRight <= image.x
}

function textOverlapsImage(scene: Scene): boolean {
  if (!scene.image) return false
  return [scene.title, scene.subtitle, scene.cta, scene.badge].some((block) => block && blocksOverlap(block, scene.image!))
}

function blocksOverlap(
  a: { x: number; y: number; w: number; h?: number; fontSize?: number; maxLines?: number; lineHeight?: number },
  b: { x: number; y: number; w: number; h?: number },
): boolean {
  const aH = a.h ?? Math.max(4, (a.fontSize ?? 3) * (a.lineHeight ?? 1.15) * Math.max(1, a.maxLines ?? 1))
  const bH = b.h ?? 0
  return a.x + a.w > b.x && b.x + b.w > a.x && a.y + aH > b.y && b.y + bH > a.y
}

function dedupeFindings<T extends ValidationFinding>(findings: T[]): T[] {
  const seen = new Set<string>()
  return findings.filter((item) => {
    const key = `${item.category}:${item.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function estimatePngExportKb(width: number, height: number): number {
  return Math.round((width * height * 0.55) / 1024)
}

function approximateBackgroundColor(scene: Scene, brand: BrandKit): string {
  const bg = scene.background
  if (bg.kind === 'solid') return bg.color
  if (bg.kind === 'gradient') return bg.stops[1]
  if (bg.kind === 'tonal') return bg.base
  if (bg.kind === 'split') return bg.a
  return brand.palette.surface
}

function collectPresentBlockIds(scene: SceneWithBlocks): Set<string> {
  const ids = new Set<string>()

  for (const id of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    if (scene[id]) ids.add(id)
  }

  for (const block of scene.blocks ?? []) {
    if (block.id) ids.add(block.id)
  }

  return ids
}

function getOverflowingBlocks(scene: SceneWithBlocks): string[] {
  const frame = scene.frame ?? { x: 0, y: 0, w: 100, h: 100 }
  const fx = frame.x ?? 0
  const fy = frame.y ?? 0
  const fw = frame.w ?? 100
  const fh = frame.h ?? 100
  const right = fx + fw
  const bottom = fy + fh
  const overflow: string[] = []

  const namedBlocks: Array<{ id: string; x: number; y: number; w: number; h: number }> = []
  for (const id of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const block = scene[id]
    if (!block) continue
    namedBlocks.push({ id, x: block.x, y: block.y, w: block.w, h: block.h ?? 0 })
  }
  for (const block of scene.blocks ?? []) {
    if (!block.id) continue
    namedBlocks.push({
      id: block.id,
      x: block.x ?? 0,
      y: block.y ?? 0,
      w: block.w ?? 0,
      h: block.h ?? 0,
    })
  }

  for (const block of namedBlocks) {
    const blockRight = block.x + block.w
    const blockBottom = block.y + block.h
    if (block.x < fx || block.y < fy || blockRight > right || blockBottom > bottom) {
      overflow.push(block.id)
    }
  }

  return Array.from(new Set(overflow))
}
