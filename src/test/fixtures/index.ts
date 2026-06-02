import { DEFAULT_BRAND_KIT, DEFAULT_ENABLED, DEFAULT_MASTER } from '../../lib/defaults'
import type { AssetHint, BrandKit, FormatRuleSet, Scene, UploadedImageAnalysis } from '../../lib/types'

export const testBrandLight: BrandKit = {
  ...DEFAULT_BRAND_KIT,
  brandName: 'Fixture Light',
  palette: {
    ink: '#111827',
    inkMuted: '#4B5563',
    surface: '#FFFFFF',
    accent: '#2563EB',
    accentSoft: '#DBEAFE',
  },
  gradient: ['#FFFFFF', '#EFF6FF', '#DBEAFE'],
}

export const testBrandDark: BrandKit = {
  ...DEFAULT_BRAND_KIT,
  brandName: 'Fixture Dark',
  palette: {
    ink: '#F9FAFB',
    inkMuted: '#CBD5E1',
    surface: '#0F172A',
    accent: '#38BDF8',
    accentSoft: '#164E63',
  },
  gradient: ['#0F172A', '#111827', '#164E63'],
}

export const testBrandPremium: BrandKit = {
  ...DEFAULT_BRAND_KIT,
  brandName: 'Fixture Premium',
  palette: {
    ink: '#171717',
    inkMuted: '#57534E',
    surface: '#FAFAF9',
    accent: '#B45309',
    accentSoft: '#FDE68A',
  },
  gradient: ['#FAFAF9', '#FEF3C7', '#FCD34D'],
  toneOfVoice: 'editorial',
}

export const testContentShort: Scene = {
  ...DEFAULT_MASTER,
  title: DEFAULT_MASTER.title ? { ...DEFAULT_MASTER.title, text: 'Summer sale' } : undefined,
  subtitle: DEFAULT_MASTER.subtitle ? { ...DEFAULT_MASTER.subtitle, text: 'New arrivals' } : undefined,
  cta: DEFAULT_MASTER.cta ? { ...DEFAULT_MASTER.cta, text: 'Shop' } : undefined,
}

export const testContentLong: Scene = {
  ...DEFAULT_MASTER,
  title: DEFAULT_MASTER.title ? { ...DEFAULT_MASTER.title, text: 'Big seasonal campaign with a very long headline for narrow placements', maxLines: 3 } : undefined,
  subtitle: DEFAULT_MASTER.subtitle ? { ...DEFAULT_MASTER.subtitle, text: 'Detailed offer copy that should wrap, clamp, or hide gracefully when the format becomes too small.' } : undefined,
  cta: DEFAULT_MASTER.cta ? { ...DEFAULT_MASTER.cta, text: 'Get the offer today' } : undefined,
}

const imageSrc = (width: number, height: number) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#9CA3AF"/></svg>`)

export const testContentWithImageHorizontal: Scene = withImage(testContentShort, 1600, 900)
export const testContentWithImageVertical: Scene = withImage(testContentShort, 900, 1600)
export const testContentWithImageSquare: Scene = withImage(testContentShort, 1200, 1200)

export const testImageAnalysisHorizontal: UploadedImageAnalysis = imageAnalysis(1600, 900)
export const testImageAnalysisVertical: UploadedImageAnalysis = imageAnalysis(900, 1600)
export const testImageAnalysisSquare: UploadedImageAnalysis = imageAnalysis(1200, 1200)

export const testFormatSmallHorizontal = makeFormat('custom:test-320x50', 320, 50)
export const testFormatWideHorizontal = makeFormat('custom:test-728x90', 728, 90)
export const testFormatVertical = makeFormat('custom:test-1080x1920', 1080, 1920)
export const testFormatSquare = makeFormat('custom:test-1080x1080', 1080, 1080)
export const testFormatMarketplace = makeFormat('custom:test-600x750', 600, 750, 'marketplace')

const minimalTestFormatSizes = [
  [320, 50],
  [320, 100],
  [319, 57],
  [640, 100],
  [640, 200],
  [728, 90],
  [960, 150],
  [960, 300],
  [1000, 120],
  [1456, 180],
  [1706, 184],
  [2000, 240],
  [2184, 270],
  [2880, 300],
  [2880, 400],
  [2934, 456],
  [3000, 360],
  [2910, 750],
  [1960, 654],
  [1920, 640],
  [980, 325],
  [300, 250],
  [300, 600],
  [1080, 1080],
  [720, 1200],
  [720, 1280],
  [720, 1800],
  [810, 1440],
  [600, 1200],
  [600, 1000],
  [480, 1200],
  [320, 1200],
  [900, 1200],
  [1080, 1350],
  [1080, 1920],
  [1472, 600],
  [600, 750],
  [145, 165],
] as const

export const minimalTestFormats: FormatRuleSet[] = minimalTestFormatSizes.map(([width, height]) => makeFormat(`custom:test-${width}x${height}`, width, height))

export const testEnabled = { ...DEFAULT_ENABLED }

function withImage(scene: Scene, width: number, height: number): Scene {
  return {
    ...scene,
    image: scene.image ? { ...scene.image, src: imageSrc(width, height), fit: 'cover' } : undefined,
  }
}

function imageAnalysis(width: number, height: number): UploadedImageAnalysis {
  const aspectRatio = width / height
  const orientation = aspectRatio > 1.15 ? 'horizontal' : aspectRatio < 0.87 ? 'vertical' : 'square'
  const subjectBounds = { x: width * 0.15, y: height * 0.15, width: width * 0.7, height: height * 0.7 }
  return {
    width,
    height,
    aspectRatio,
    orientation,
    subjectBounds,
    dominantArea: subjectBounds,
    hasEnoughResolution: true,
    qualityWarnings: [],
    recommendedUsage: orientation === 'horizontal' ? 'background' : 'hero',
    emptySpace: 0.3,
    centerCropSafety: orientation === 'square' ? 0.9 : 0.72,
    canBeUsedAsBackground: true,
    canBeUsedAsHeroImage: true,
    recommendedObjectFit: orientation === 'square' ? 'cover' : 'smart-crop',
  }
}

function makeFormat(
  key: string,
  width: number,
  height: number,
  device: FormatRuleSet['device'] = 'desktop',
): FormatRuleSet {
  return {
    key,
    id: key,
    label: `${width}x${height}`,
    platformId: 'test',
    platformName: 'Test',
    placementName: `${width}x${height}`,
    placementGroup: 'fixtures',
    device,
    goal: device === 'marketplace' ? 'marketplace' : 'display',
    width,
    height,
    aspectRatio: width / height,
    safeZone: { top: 4, right: 4, bottom: 4, left: 4 },
    safeArea: { top: 4, right: 4, bottom: 4, left: 4, unit: 'percent', description: 'Fixture safe area' },
    overlayZones: [],
    recommendedWidth: width,
    recommendedHeight: height,
    minWidth: width,
    minHeight: height,
    maxWidth: width,
    maxHeight: height,
    allowedFileTypes: ['jpg', 'png'],
    maxFileSizeKb: 512,
    gutter: width / height > 3 ? 2 : 4,
    minTitleSize: width / height > 3 ? 2 : 5,
    minFontSize: height <= 100 ? 10 : 12,
    maxTitleLines: width / height > 3 ? 1 : 3,
    requiredElements: ['title', 'cta'],
  }
}

export function assetHintFromAnalysis(analysis: UploadedImageAnalysis): AssetHint {
  return {
    width: analysis.width,
    height: analysis.height,
    aspectRatio: analysis.aspectRatio,
    dominantColors: ['#2563EB', '#DBEAFE'],
    isDarkBackground: false,
    bottomBandBrightness: 0.74,
    brightnessGrid: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0.74)),
  }
}
