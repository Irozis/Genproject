import type {
  FormatRecommendation,
  FormatRecommendationLevel,
  FormatRuleSet,
  RecommendedImageMode,
  SelectedFormatImageStrategy,
  UploadedImageAnalysis,
} from './types'

type Size = { width: number; height: number }

export async function analyzeUploadedImage(file: File): Promise<UploadedImageAnalysis> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    return analyzeImageDimensions(image.naturalWidth, image.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function analyzeImageDimensions(width: number, height: number): UploadedImageAnalysis {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const aspectRatio = safeWidth / safeHeight
  const orientation = aspectRatio > 1.15 ? 'horizontal' : aspectRatio < 0.87 ? 'vertical' : 'square'
  const subjectBounds = {
    x: safeWidth * 0.15,
    y: safeHeight * 0.15,
    width: safeWidth * 0.7,
    height: safeHeight * 0.7,
  }
  const minSide = Math.min(safeWidth, safeHeight)
  const qualityWarnings: string[] = []
  if (safeWidth < 600 || safeHeight < 600) qualityWarnings.push('Недостаточное разрешение для крупных форматов')
  if (minSide < 360) qualityWarnings.push('Изображение подходит только для небольших размещений')
  const hasEnoughResolution = safeWidth >= 600 && safeHeight >= 600
  const centerCropSafety = orientation === 'square' ? 0.9 : 0.72
  const recommendedUsage = minSide < 360
    ? 'thumbnail'
    : orientation === 'horizontal'
      ? 'background'
      : 'hero'

  return {
    width: safeWidth,
    height: safeHeight,
    aspectRatio,
    orientation,
    subjectBounds,
    dominantArea: subjectBounds,
    hasEnoughResolution,
    qualityWarnings,
    recommendedUsage,
    emptySpace: 0.3,
    centerCropSafety,
    canBeUsedAsBackground: orientation !== 'vertical' || aspectRatio > 0.55,
    canBeUsedAsHeroImage: hasEnoughResolution && minSide >= 600,
    recommendedObjectFit: orientation === 'square' ? 'cover' : 'smart-crop',
  }
}

export function recommendFormatsForImage(
  imageAnalysis: UploadedImageAnalysis,
  formatCatalog: FormatRuleSet[],
): FormatRecommendation[] {
  return formatCatalog.map((format) => recommendFormatForImage(imageAnalysis, format))
    .sort((a, b) => b.score - a.score || area(b) - area(a))
}

export function selectedStrategyFromRecommendation(
  recommendation: FormatRecommendation,
): SelectedFormatImageStrategy {
  return {
    formatId: recommendation.formatId,
    recommendedImageMode: recommendation.recommendedImageMode,
    cropRisk: recommendation.cropRisk,
    score: recommendation.score,
    warnings: recommendation.warnings,
  }
}

function recommendFormatForImage(image: UploadedImageAnalysis, format: FormatRuleSet): FormatRecommendation {
  const formatAspect = format.aspectRatio || format.width / format.height
  const diff = aspectRatioDiff(image.aspectRatio, formatAspect)
  const resolutionScore = resolutionFit(image, format)
  const orientationScore = orientationFits(image.orientation, formatAspect) ? 18 : -12
  const cropRisk = diff <= 0.18 ? 'low' : diff <= 0.45 ? 'medium' : 'high'
  const micro = format.height <= 90 || format.width <= 160
  const safeOverlay = safeAreaCoverage(format) >= 0.72
  let score = 100 - Math.min(62, diff * 92) + resolutionScore + orientationScore
  if (micro) score -= 14
  if (!safeOverlay) score -= 6
  if (image.qualityWarnings.length > 0) score -= 8
  if (format.device === 'marketplace' && image.orientation !== 'horizontal') score += 6
  score = clamp(Math.round(score), 0, 100)

  const recommendedImageMode = imageModeFor({ diff, cropRisk, micro, image, formatAspect })
  const warnings = warningsFor({ image, format, diff, cropRisk, micro, recommendedImageMode })
  const level = levelFor(score, cropRisk, warnings)
  return {
    formatId: format.key,
    platformName: format.platformName ?? 'Свой формат',
    placementName: format.placementName ?? format.label,
    width: format.width,
    height: format.height,
    aspectRatio: formatAspect,
    score,
    level,
    reason: reasonFor(level, cropRisk, recommendedImageMode),
    cropRisk,
    recommendedImageMode,
    warnings,
  }
}

function imageModeFor(input: {
  diff: number
  cropRisk: FormatRecommendation['cropRisk']
  micro: boolean
  image: UploadedImageAnalysis
  formatAspect: number
}): RecommendedImageMode {
  if (input.micro) return 'thumbnail'
  if (input.cropRisk === 'low') return 'cover'
  if (input.cropRisk === 'medium') return 'smart-crop'
  if (input.formatAspect > input.image.aspectRatio * 1.7 || input.formatAspect < input.image.aspectRatio / 1.7) {
    return 'background-blur'
  }
  return 'contain'
}

function warningsFor(input: {
  image: UploadedImageAnalysis
  format: FormatRuleSet
  diff: number
  cropRisk: FormatRecommendation['cropRisk']
  micro: boolean
  recommendedImageMode: RecommendedImageMode
}): string[] {
  const warnings = [...input.image.qualityWarnings]
  if (input.format.width > input.image.width || input.format.height > input.image.height) {
    warnings.push('Недостаточное разрешение для формата')
  }
  if (input.cropRisk === 'high') warnings.push('Возможна сильная обрезка объекта')
  if (input.image.orientation === 'vertical' && input.format.aspectRatio > 1.7) {
    warnings.push('Изображение слишком вертикальное для горизонтального баннера')
  }
  if (input.image.orientation === 'horizontal' && input.format.aspectRatio < 0.7) {
    warnings.push('Изображение слишком широкое для сторис')
  }
  if (input.micro) warnings.push('Малый формат: изображение лучше использовать как миниатюру или фон')
  if (input.recommendedImageMode === 'background-blur' || input.recommendedImageMode === 'contain') {
    warnings.push('Рекомендуется использовать contain или фон с размытием')
  }
  return [...new Set(warnings)]
}

function reasonFor(
  level: FormatRecommendationLevel,
  cropRisk: FormatRecommendation['cropRisk'],
  mode: RecommendedImageMode,
): string {
  if (level === 'excellent') return 'Подходит: пропорции изображения близки к формату, обрезка минимальна'
  if (level === 'good') return 'Подходит с небольшой обрезкой: важная область сохранится'
  if (mode === 'background-blur') return 'Лучше использовать с фоном: пропорции заметно отличаются'
  if (cropRisk === 'high') return 'Рискованно: формат может обрезать важную область изображения'
  return 'Можно использовать при аккуратном кадрировании'
}

function levelFor(
  score: number,
  cropRisk: FormatRecommendation['cropRisk'],
  warnings: string[],
): FormatRecommendationLevel {
  if (score >= 86 && cropRisk === 'low') return 'excellent'
  if (score >= 72 && cropRisk !== 'high') return 'good'
  if (score >= 56) return 'acceptable'
  if (score >= 38 || warnings.length <= 1) return 'risky'
  return 'not_recommended'
}

function aspectRatioDiff(a: number, b: number): number {
  return Math.abs(Math.log(Math.max(0.01, a) / Math.max(0.01, b)))
}

function orientationFits(orientation: UploadedImageAnalysis['orientation'], aspectRatio: number): boolean {
  if (orientation === 'square') return aspectRatio >= 0.75 && aspectRatio <= 1.35
  if (orientation === 'horizontal') return aspectRatio >= 1.15
  return aspectRatio <= 0.95
}

function resolutionFit(image: Size, format: Size): number {
  const scale = Math.min(image.width / format.width, image.height / format.height)
  if (scale >= 1) return 12
  if (scale >= 0.65) return 2
  if (scale >= 0.4) return -10
  return -22
}

function safeAreaCoverage(format: FormatRuleSet): number {
  const safe = format.safeZone
  const width = Math.max(0, 100 - safe.left - safe.right)
  const height = Math.max(0, 100 - safe.top - safe.bottom)
  return (width * height) / 10000
}

function area(item: Pick<FormatRecommendation, 'width' | 'height'>): number {
  return item.width * item.height
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}
