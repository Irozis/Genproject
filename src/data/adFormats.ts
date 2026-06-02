import type {
  AdConfidence,
  AdFileType,
  AdFormatDevice,
  AdFormatGoal,
  AdLogoRules,
  AdOverlayZone,
  AdSafeArea,
  AdSourceType,
  AdTextLimits,
  AdVisibleArea,
  BlockKind,
  CompositionModel,
  FormatRuleSet,
  RuleConfidence,
  RuleSource,
} from '../lib/types'

export type AdFormatCatalogEntry = FormatRuleSet & {
  id: string
  key: string
  platformId: string
  platformName: string
  placementName: string
  placementGroup: string
  device: AdFormatDevice
  goal: AdFormatGoal
  recommendedWidth: number
  recommendedHeight: number
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
  exportScaleOptions: number[]
  allowedFileTypes: AdFileType[]
  maxFileSizeKb: number
  supportsSvg: boolean
  supportsPng: boolean
  supportsJpeg: boolean
  supportsHtml5: boolean
  animationAllowed: boolean
  safeArea: AdSafeArea
  overlayZones: AdOverlayZone[]
  textLimits: AdTextLimits
  logoRules: AdLogoRules
  moderationRules: string[]
  notes: string
  sourceName: string
  sourceType: AdSourceType
  verifiedAt: string
  confidence: AdConfidence
  defaultComposition?: CompositionModel
}

type EntryInput = {
  id: string
  label?: string
  platformId: string
  platformName: string
  placementName: string
  placementGroup: string
  device: AdFormatDevice
  goal: AdFormatGoal
  width: number
  height: number
  safeArea?: Partial<AdSafeArea>
  visibleArea?: AdVisibleArea
  overlayZones?: AdOverlayZone[]
  allowedFileTypes?: AdFileType[]
  maxFileSizeKb?: number
  supportsHtml5?: boolean
  supportsSvg?: boolean
  supportsPng?: boolean
  supportsJpeg?: boolean
  animationAllowed?: boolean
  textLimits?: AdTextLimits
  logoRules?: AdLogoRules
  moderationRules?: string[]
  notes?: string
  sourceName?: string
  sourceType?: AdSourceType
  confidence?: AdConfidence
  exportScaleOptions?: number[]
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  recommendedWidth?: number
  recommendedHeight?: number
  requiredElements?: BlockKind[]
  gutter?: number
  minTitleSize?: number
  minFontSize?: number
  maxTitleLines?: number
  typescaleBoost?: number
  defaultComposition?: CompositionModel
}

const VERIFIED_AT = '2026-06-01'

const emptySafe: AdSafeArea = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  unit: 'percent',
  description: 'Без дополнительной безопасной зоны сверх границ холста.',
}

function pxSafe(top: number, right: number, bottom: number, left: number, description: string): AdSafeArea {
  return { top, right, bottom, left, unit: 'px', description }
}

function pctSafe(top: number, right: number, bottom: number, left: number, description: string): AdSafeArea {
  return { top, right, bottom, left, unit: 'percent', description }
}

function bottomAdLabel(heightPx: number): AdOverlayZone {
  return {
    name: 'ad_label',
    x: 0,
    y: 100,
    width: 100,
    height: heightPx,
    position: 'bottom',
    unit: 'px',
    description: 'Нижняя плашка маркировки рекламы: не ставить важный текст и логотип.',
  }
}

function topRightAdLabel(width: number, height: number): AdOverlayZone {
  return {
    name: 'ad_label',
    x: 100,
    y: 0,
    width,
    height,
    position: 'top-right',
    unit: 'px',
    description: 'Зона маркировки "Реклама" в правом верхнем углу.',
  }
}

function visibleArea(width: number, height: number, description: string): AdVisibleArea {
  return { x: 0, y: 0, width, height, unit: 'px', description }
}

function ratioLabel(width: number, height: number): string {
  const d = gcd(width, height)
  return `${width / d}:${height / d}`
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x || 1
}

function safeZoneFromSafeArea(safeArea: AdSafeArea, width: number, height: number): FormatRuleSet['safeZone'] {
  if (safeArea.unit === 'percent') {
    return {
      top: safeArea.top,
      right: safeArea.right,
      bottom: safeArea.bottom,
      left: safeArea.left,
    }
  }
  return {
    top: (safeArea.top / height) * 100,
    right: (safeArea.right / width) * 100,
    bottom: (safeArea.bottom / height) * 100,
    left: (safeArea.left / width) * 100,
  }
}

function entry(input: EntryInput): AdFormatCatalogEntry {
  const safeArea: AdSafeArea = { ...emptySafe, ...input.safeArea }
  const safeZone = safeZoneFromSafeArea(safeArea, input.width, input.height)
  const supportsHtml5 = input.supportsHtml5 ?? false
  const allowedFileTypes = input.allowedFileTypes ?? ['jpg', 'jpeg', 'png']
  const supportsPng = input.supportsPng ?? allowedFileTypes.includes('png')
  const supportsJpeg = input.supportsJpeg ?? (allowedFileTypes.includes('jpg') || allowedFileTypes.includes('jpeg'))
  const supportsSvg = input.supportsSvg ?? allowedFileTypes.includes('svg')
  const isTall = input.width / input.height < 0.75
  const isWide = input.width / input.height > 2.4
  const sourceName = input.sourceName ?? 'Каталог форматов приложения'
  const sourceType = input.sourceType ?? 'manual'
  const confidence = input.confidence ?? 'medium'
  const ruleConfidence = confidenceForRuleSource(sourceType, confidence)
  return {
    ...input,
    key: input.id,
    label: input.label ?? `${input.platformName} ${input.placementName}`,
    aspectRatio: input.width / input.height,
    safeZone,
    safeArea,
    overlayZones: input.overlayZones ?? [],
    recommendedWidth: input.recommendedWidth ?? input.width,
    recommendedHeight: input.recommendedHeight ?? input.height,
    minWidth: input.minWidth ?? input.width,
    minHeight: input.minHeight ?? input.height,
    maxWidth: input.maxWidth ?? input.width,
    maxHeight: input.maxHeight ?? input.height,
    exportScaleOptions: input.exportScaleOptions ?? [1],
    allowedFileTypes,
    maxFileSizeKb: input.maxFileSizeKb ?? 512,
    supportsSvg,
    supportsPng,
    supportsJpeg,
    supportsHtml5,
    animationAllowed: input.animationAllowed ?? allowedFileTypes.includes('gif'),
    textLimits: input.textLimits ?? {},
    logoRules: input.logoRules ?? {},
    moderationRules: input.moderationRules ?? [],
    notes: input.notes ?? '',
    sourceName,
    sourceType,
    verifiedAt: VERIFIED_AT,
    confidence,
    gutter: input.gutter ?? (isWide ? 2 : isTall ? 3 : 4),
    minTitleSize: input.minTitleSize ?? (isWide ? 2 : 5),
    minFontSize: input.minFontSize,
    maxTitleLines: input.maxTitleLines ?? (isWide ? 1 : isTall ? 4 : 3),
    requiredElements: input.requiredElements ?? ['title', 'image'],
    typescaleBoost: input.typescaleBoost ?? (isTall ? 1.15 : undefined),
    ruleSources: ruleSourcesForEntry({
      sourceName,
      sourceType,
      safeAreaProvided: Boolean(input.safeArea),
      overlayZonesProvided: Boolean(input.overlayZones?.length),
      textLimitsProvided: Boolean(input.textLimits && Object.keys(input.textLimits).length > 0),
      moderationRulesProvided: Boolean(input.moderationRules?.length),
    }),
    ruleConfidence,
  }
}

function ruleSourcesForEntry(input: {
  sourceName: string
  sourceType: AdSourceType
  safeAreaProvided: boolean
  overlayZonesProvided: boolean
  textLimitsProvided: boolean
  moderationRulesProvided: boolean
}): NonNullable<FormatRuleSet['ruleSources']> {
  const catalogSource = catalogRuleSource(input.sourceType, input.sourceName)
  const normalizedSource = catalogRuleSource(
    input.sourceType === 'official' ? 'industry_reference' : input.sourceType,
    input.sourceName,
    'Catalog metadata is normalized by the application; review unless a field is explicitly sourced as official.',
  )
  return {
    size: catalogSource,
    fileConstraints: catalogSource,
    safeArea: input.safeAreaProvided
      ? derivedRuleSource('Safe area is an application guard derived from placement geometry and readable margins.')
      : normalizedSource,
    overlayZones: input.overlayZonesProvided
      ? derivedRuleSource('Overlay zones are internal preview/validation guards and are not treated as official composition rules.')
      : unknownRuleSource('No explicit overlay-zone source is stored for this format.'),
    layoutDefaults: heuristicRuleSource('Default composition and layout mode are application heuristics, not platform requirements.'),
    typographyLimits: input.textLimitsProvided && input.sourceType === 'official'
      ? catalogSource
      : derivedRuleSource('Typography limits are derived from canvas size, readability, and stored text-limit hints.'),
    ctaLimits: heuristicRuleSource('CTA visibility and sizing are internal stability/readability rules.'),
    moderationRules: input.moderationRulesProvided
      ? normalizedSource
      : unknownRuleSource('No moderation-rule source is stored for this format.'),
  }
}

function catalogRuleSource(type: AdSourceType, name: string, note?: string): RuleSource {
  return { type, name, verifiedAt: VERIFIED_AT, note }
}

function derivedRuleSource(note: string): RuleSource {
  return { type: 'derived', name: 'Application layout geometry', note, verifiedAt: VERIFIED_AT }
}

function heuristicRuleSource(note: string): RuleSource {
  return { type: 'heuristic', name: 'Application layout heuristic', note, verifiedAt: VERIFIED_AT }
}

function unknownRuleSource(note: string): RuleSource {
  return { type: 'unknown', name: 'No explicit project source', note, verifiedAt: VERIFIED_AT }
}

function confidenceForRuleSource(sourceType: AdSourceType, confidence: RuleConfidence): RuleConfidence {
  if (sourceType === 'official' && confidence === 'high') return 'high'
  if (sourceType === 'industry_reference' && confidence !== 'low') return 'medium'
  return 'low'
}

const yandexBannerRules = [
  'JPG, PNG и GIF для графических креативов; ZIP для HTML5.',
  'HTML5-баннер должен совпадать с размером рекламного блока.',
  'Лимит файла для большинства графических баннеров: 512 КБ.',
]

const yandexBaseSizes = [
  [160, 600],
  [240, 400],
  [240, 600],
  [300, 250],
  [300, 300],
  [300, 500],
  [300, 600],
  [320, 50],
  [320, 100],
  [320, 480],
  [336, 280],
  [480, 320],
  [728, 90],
  [970, 250],
  [1000, 120],
] as const

function yandexDisplayEntries(): AdFormatCatalogEntry[] {
  return yandexBaseSizes.flatMap(([width, height]) =>
    [1, 2, 3].map((scale) => {
      const w = width * scale
      const h = height * scale
      const suffix = scale === 1 ? '' : `-${scale}x`
      return entry({
        id: `yandex-rsy-${w}x${h}${suffix}`,
        platformId: 'yandex-direct',
        platformName: 'Яндекс Директ / РСЯ',
        placementName: `Медийный баннер ${w}x${h}${scale > 1 ? ` (${scale}x)` : ''}`,
        placementGroup: 'display-banner',
        device: width <= 480 ? 'mobile' : 'desktop',
        goal: 'display',
        width: w,
        height: h,
        safeArea: yandexSafeArea(width, height),
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'zip'],
        maxFileSizeKb: 512,
        supportsHtml5: true,
        animationAllowed: true,
        moderationRules: yandexBannerRules,
        sourceName: 'Yandex Direct display banner requirements, normalized manually',
        sourceType: 'industry_reference',
        confidence: 'medium',
        exportScaleOptions: scale === 1 ? [1, 2, 3] : [1],
        requiredElements: ['title', 'cta'],
        defaultComposition: width / height > 2 ? 'split-right-image' : width / height < 0.8 ? 'image-top-text-bottom' : 'split-right-image',
      })
    }),
  )
}

function yandexSafeArea(width: number, height: number): AdSafeArea {
  if (width === 240 && height === 400) return pctSafe(7, 7, 8, 7, 'Legacy safe zone for compact vertical RСЯ banner.')
  if (width === 300 && height === 250) return pctSafe(6, 6, 6, 6, 'Legacy safe zone for medium rectangle RСЯ banner.')
  if (width === 728 && height === 90) return pctSafe(4, 4, 4, 4, 'Legacy safe zone for leaderboard RСЯ banner.')
  return pctSafe(4, 4, 4, 4, 'Универсальный технический отступ от краев баннера.')
}

const socialTextRules = [
  'Текст на изображении не должен занимать слишком большую часть площади.',
  'Перед запуском нужна проверка актуальных требований и модерации площадки.',
]

const vkEntries = [
  ['vk-square', 'Пост 1:1', 1080, 1080, 'social', pctSafe(6, 6, 6, 6, 'Legacy safe zone for saved projects.'), []],
  ['vk-universal-square-600x600', 'Универсальный квадрат', 600, 600, 'social', pctSafe(6, 6, 6, 6, 'Базовая безопасная зона для универсального изображения.'), []],
  ['vk-vertical', 'Универсальный вертикальный 4:5', 1080, 1350, 'social', pctSafe(7, 6, 8, 6, 'Безопасная зона под элементы интерфейса и подпись.'), []],
  ['vk-landscape', 'Универсальный горизонтальный 16:9', 1080, 607, 'social', pctSafe(6, 6, 6, 6, 'Базовая безопасная зона.'), []],
  ['vk-stories-720x1280', 'Сторис / клипы', 720, 1280, 'social', pctSafe(12, 6, 12, 6, 'Верх и низ защищены от интерфейса сторис.'), [{ name: 'ui_controls', position: 'bottom', x: 0, y: 88, width: 100, height: 12, unit: 'percent', description: 'Нижние элементы управления сторис.' }]],
  ['vk-stories', 'История', 1080, 1920, 'social', pctSafe(12, 6, 10, 6, 'Верх и низ защищены от интерфейса сторис.'), [{ name: 'ui_controls', position: 'bottom', x: 0, y: 88, width: 100, height: 12, unit: 'percent', description: 'Нижние элементы управления сторис.' }]],
  ['vk-carousel-600x600', 'Карусель', 600, 600, 'social', pctSafe(6, 6, 6, 6, 'Базовая безопасная зона.'), []],
  ['vk-teaser-image-text-145x85', 'Тизер изображение и текст', 145, 85, 'social', pctSafe(4, 4, 4, 4, 'Минимальный отступ для малых тизеров.'), []],
  ['vk-teaser-large-145x165', 'Тизер большое изображение', 145, 165, 'social', pctSafe(5, 5, 5, 5, 'Минимальный отступ для малых тизеров.'), []],
  ['vk-community-145x145', 'Продвижение сообщества', 145, 145, 'social', pctSafe(5, 5, 5, 5, 'Минимальный отступ для малых тизеров.'), []],
  ['vk-wb-social-1000x700', 'Баннер WB для соцсетей', 1000, 700, 'social', pctSafe(6, 6, 6, 6, 'Базовая безопасная зона.'), []],
] as const

function vkCatalogEntries(): AdFormatCatalogEntry[] {
  return vkEntries.map(([id, placementName, width, height, device, safeArea, overlayZones]) =>
    entry({
      id,
      label: id === 'vk-stories' ? 'VK История' : id === 'vk-square' ? 'VK Пост 1:1' : undefined,
      platformId: 'vk',
      platformName: 'VK Реклама / ВКонтакте',
      placementName,
      placementGroup: placementName.includes('Тизер') ? 'teaser' : placementName.includes('Сторис') ? 'stories' : 'social-image',
      device: device as AdFormatDevice,
      goal: 'social-post',
      width,
      height,
      safeArea,
      overlayZones: [...overlayZones],
      allowedFileTypes: ['jpg', 'jpeg', 'png'],
      maxFileSizeKb: 5120,
      textLimits: { imageTextMaxAreaPercent: 20 },
      moderationRules: socialTextRules,
      sourceName: 'VK advertising image formats, normalized manually',
      sourceType: 'industry_reference',
      confidence: 'medium',
      defaultComposition: width / height < 0.75 ? 'hero-overlay' : width / height > 1.2 ? 'split-right-image' : 'hero-overlay',
      typescaleBoost: id === 'vk-stories' ? 1.18 : undefined,
    }),
  )
}

const okEntries = [
  ['ok-square-1080x1080', 'Социальный квадрат 1:1', 1080, 1080],
  ['ok-vertical-1080x1350', 'Социальный вертикальный 4:5', 1080, 1350],
  ['ok-horizontal-1200x628', 'Horizontal social', 1200, 628],
  ['ok-stories-1080x1920', 'Stories 9:16', 1080, 1920],
] as const

const avitoCommonRules = ['Нельзя размещать QR-коды, ссылки и контактные данные на изображении.']
const avitoNativeRules = [
  ...avitoCommonRules,
  'Заголовок до 30 символов, описание до 45 символов.',
  'Логотип 50x50, максимум 250 КБ.',
  'Текст на изображении не больше 20%.',
]

function simpleEntries(
  platformId: string,
  platformName: string,
  placementGroup: string,
  device: AdFormatDevice,
  goal: AdFormatGoal,
  rows: readonly (readonly [string, string, number, number])[],
  defaults: Omit<Partial<EntryInput>, 'id' | 'placementName' | 'width' | 'height'>,
): AdFormatCatalogEntry[] {
  return rows.map(([id, placementName, width, height]) =>
    entry({
      id,
      platformId,
      platformName,
      placementName,
      placementGroup,
      device,
      goal,
      width,
      height,
      ...defaults,
    }),
  )
}

const avitoEntries = [
  ...simpleEntries('avito', 'Авито Реклама', 'native-banner', 'marketplace', 'marketplace', [
    ['avito-native-600x750', 'Нативный баннер 4:5', 600, 750],
    ['avito-native-720x540', 'Нативный баннер 4:3', 720, 540],
    ['avito-native-472x472', 'Нативный баннер 1:1', 472, 472],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Безопасная зона нативного баннера.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 2048,
    textLimits: { titleMaxChars: 30, descriptionMaxChars: 45, imageTextMaxAreaPercent: 20 },
    logoRules: { recommendedWidth: 50, recommendedHeight: 50, maxFileSizeKb: 250 },
    moderationRules: avitoNativeRules,
    sourceName: 'Avito native ad requirements, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
  }),
  ...simpleEntries('avito', 'Авито Реклама', 'homepage-banner', 'desktop', 'display', [
    ['avito-home-2934x456', 'Баннер на главной 13:2', 2934, 456],
    ['avito-home-1320x492', 'Баннер на главной 8:3', 1320, 492],
  ], {
    safeArea: pxSafe(0, 16, 0, 16, 'Safe zone 16 px слева и справа.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 500,
    moderationRules: ['Нельзя QR-код.', ...avitoCommonRules],
    sourceName: 'Avito homepage banner requirements, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
    requiredElements: ['title', 'cta'],
  }),
  ...simpleEntries('avito', 'Авито Реклама', 'display-standard', 'responsive', 'display', [
    ['avito-display-600x1200', 'Медийный стандарт 1:2', 600, 1200],
    ['avito-display-472x628', 'Медийный стандарт 3:4', 472, 628],
    ['avito-display-720x240', 'Медийный стандарт 3:1', 720, 240],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Безопасная зона медийного баннера.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 500,
    moderationRules: avitoCommonRules,
    sourceName: 'Avito display requirements, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
    requiredElements: ['title', 'cta'],
  }),
  ...simpleEntries('avito', 'Авито Реклама', 'display-premium', 'desktop', 'display', [
    ['avito-premium-750x564', 'Медийный премиум 4:3', 750, 564],
    ['avito-premium-1960x654', 'Медийный премиум 3:1', 1960, 654],
    ['avito-premium-600x1200', 'Медийный премиум 1:2', 600, 1200],
    ['avito-skyscraper', 'Медийный премиум 1:3', 300, 900],
  ], {
    safeArea: pctSafe(6, 6, 7, 6, 'Безопасная зона премиального баннера.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 500,
    moderationRules: avitoCommonRules,
    sourceName: 'Avito premium display requirements, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
    requiredElements: ['title', 'cta'],
  }),
  ...simpleEntries('avito', 'Авито Реклама', 'html5', 'responsive', 'display', [
    ['avito-html5-300x600', 'HTML5 300x600', 300, 600],
    ['avito-html5-320x240', 'HTML5 320x240', 320, 240],
    ['avito-html5-980x325', 'HTML5 980x325', 980, 325],
    ['avito-html5-300x900', 'HTML5 premium 300x900', 300, 900],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Безопасная зона HTML5-баннера.'),
    allowedFileTypes: ['zip', 'html'],
    maxFileSizeKb: 500,
    supportsHtml5: true,
    supportsPng: false,
    supportsJpeg: false,
    moderationRules: ['index.html обязателен.', 'Внешние ресурсы запрещены.', 'Адаптивность под 1:2, 4:3, 3:1.'],
    sourceName: 'Avito HTML5 requirements, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
    requiredElements: ['title', 'cta'],
  }),
]

const ozonEntries = simpleEntries('ozon', 'Ozon Performance', 'media', 'marketplace', 'marketplace', [
  ['ozon-native-768x1024', 'Нативный баннер 3:4', 768, 1024],
  ['ozon-card', 'Мобильный / товарный 3:4', 900, 1200],
  ['ozon-fresh-square', 'Квадратный 1:1', 1080, 1080],
  ['ozon-horizontal-1200x628', 'Горизонтальный', 1200, 628],
  ['ozon-wide-1920x640', 'Широкоформатный', 1920, 640],
  ['ozon-showcase-1440x400', 'Баннер главной / витрины', 1440, 400],
  ['ozon-showcase-1440x600', 'Баннер главной / витрины высокий', 1440, 600],
], {
  safeArea: pctSafe(6, 6, 6, 6, 'Безопасная зона маркетплейс-баннера.'),
  overlayZones: [topRightAdLabel(295, 105)],
  allowedFileTypes: ['jpg', 'jpeg', 'png'],
  maxFileSizeKb: 150,
  moderationRules: ['Для сайта ориентировочно max 150 КБ, для мобильной версии ориентировочно max 120 КБ.', 'Важные элементы не размещать в зоне маркировки.'],
  sourceName: 'Ozon media formats, normalized manually',
  sourceType: 'industry_reference',
  confidence: 'low',
})

const wbRows = [
  ['wb-home-site-1472x600', 'Главная, сайт', 1472, 600],
  ['wb-home-app-720x400', 'Главная, приложение', 720, 400],
  ['wb-orders-site-2880x300', 'ЛК / заказы, сайт', 2880, 300],
  ['wb-orders-mobile-720x300', 'ЛК / заказы, мобильная версия', 720, 300],
  ['wb-orders-app-1074x276', 'ЛК / заказы, приложение', 1074, 276],
  ['wb-checkout-site-2880x400', 'Страница обработки заказа, сайт', 2880, 400],
  ['wb-checkout-mobile-720x400', 'Страница обработки заказа, мобильная версия', 720, 400],
  ['wb-checkout-app-960x412', 'Страница обработки заказа, приложение', 960, 412],
  ['wb-context-site-2880x300', 'Контекстный баннер, сайт', 2880, 300],
  ['wb-context-app-960x412', 'Контекстный баннер, приложение', 960, 412],
  ['wb-context-mobile-656x300', 'Контекстный баннер, мобильная версия сайта', 656, 300],
  ['wb-push-500x350', 'Push-уведомление', 500, 350],
  ['wb-vk-social-1000x700', 'Баннер в соцсетях ВКонтакте', 1000, 700],
  ['wb-ok-social-1080x1080', 'Баннер в соцсетях Одноклассники', 1080, 1080],
] as const

const wbEntries = wbRows.map(([id, placementName, width, height]) =>
  entry({
    id,
    platformId: 'wildberries',
    platformName: 'Wildberries / WB Media',
    placementName,
    placementGroup: placementName.includes('соцсетях') ? 'social' : 'media',
    device: placementName.includes('приложение') ? 'app' : placementName.includes('мобиль') ? 'mobile' : 'desktop',
    goal: placementName.includes('соцсетях') ? 'social-post' : 'marketplace',
    width,
    height,
    safeArea: pctSafe(4, 4, 6, 4, 'Важная информация внутри видимой области, отступ от текста до края не меньше 20 px.'),
    visibleArea: placementName.includes('мобиль') || placementName.includes('приложение')
      ? visibleArea(width, Math.max(1, height - 28), 'Практическая видимая область: часть макета может обрезаться интерфейсом.')
      : undefined,
    overlayZones: [bottomAdLabel(height <= 300 ? 16 : 28)],
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'psd'],
    maxFileSizeKb: placementName.includes('соцсетях') ? 5120 : 300,
    moderationRules: [
      'RGB, 72 dpi.',
      'PSD может использоваться как исходник для ручной передачи.',
      'Минимальный размер шрифта для маркировки - 11 pt.',
      'Расстояние от края баннера до текста не меньше 20 px.',
      'Рекомендуемый шрифт Proxima Nova; в приложении используются системные и web-safe альтернативы.',
    ],
    sourceName: 'WB Media placement specs, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
    requiredElements: width / height > 2 ? ['title', 'cta'] : ['title', 'image'],
  }),
)

const gisEntries = [
  entry({
    id: '2gis-logo-range',
    platformId: '2gis',
    platformName: '2ГИС',
    placementName: 'Логотип компании 132-3000',
    placementGroup: 'company-assets',
    device: 'map',
    goal: 'map',
    width: 200,
    height: 200,
    minWidth: 132,
    minHeight: 132,
    maxWidth: 3000,
    maxHeight: 3000,
    safeArea: pctSafe(10, 10, 10, 10, 'Логотип должен вписываться в круглую область.'),
    allowedFileTypes: ['png', 'jpg', 'jpeg', 'gif'],
    maxFileSizeKb: 10240,
    animationAllowed: false,
    logoRules: { circularSafeArea: true, minWidth: 132, minHeight: 132, maxFileSizeKb: 10240 },
    moderationRules: ['GIF допускается для части логотипов, но анимация запрещена.', 'Логотип должен вписываться в круг.'],
    sourceName: '2GIS advertising and company asset requirements, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
    requiredElements: ['logo'],
  }),
  ...simpleEntries('2gis', '2ГИС', 'map-assets', 'map', 'map', [
    ['2gis-logo-200x200', 'Логотип 200x200', 200, 200],
    ['2gis-card-bg-800x400', 'Фоновое изображение карточки', 800, 400],
    ['2gis-story-720x1280', 'Сторис 9:16', 720, 1280],
    ['2gis-story-810x1440', 'Сторис 9:16', 810, 1440],
    ['2gis-story-900x1600', 'Сторис 9:16', 900, 1600],
    ['2gis-story-1080x1920', 'Сторис 9:16', 1080, 1920],
    ['2gis-search-bg-500x600', 'Рекламный блок в поисковой выдаче: фон', 500, 600],
    ['2gis-partner-desktop-800x320', 'Баннер в профиле партнера desktop', 800, 320],
    ['2gis-partner-mobile-800x800', 'Баннер в профиле партнера mobile', 800, 800],
    ['2gis-search-banner-319x57', 'Баннер в поисковой выдаче', 319, 57],
    ['2gis-directory-banner-319x57', 'Баннер под окном справочника', 319, 57],
    ['2gis-bg-1440x800', 'Фон рекламного блока', 1440, 800],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Важный контент внутри безопасной области.'),
    minWidth: 800,
    minHeight: 400,
    maxWidth: 3000,
    maxHeight: 3000,
    allowedFileTypes: ['png', 'jpg', 'jpeg'],
    maxFileSizeKb: 10240,
    textLimits: { titleMaxChars: 80, descriptionMaxChars: 70, ctaMaxChars: 28 },
    moderationRules: ['Текстовые ограничения: 35, 70 или 80 символов в зависимости от размещения; CTA обычно до 28 символов.', 'Для некоторых контекстных блоков лимит может достигать 25 МБ.'],
    sourceName: '2GIS ad formats, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'low',
  }),
]

const telegramEntries = [
  entry({
    id: 'telegram-official-sponsored-message',
    platformId: 'telegram',
    platformName: 'Telegram Ads',
    placementName: 'Official sponsored message text-only',
    placementGroup: 'official-text-ad',
    device: 'social',
    goal: 'reach',
    width: 800,
    height: 400,
    safeArea: pctSafe(8, 8, 8, 8, 'Карточка-превью для планирования; официальный формат текстовый.'),
    allowedFileTypes: [],
    maxFileSizeKb: 0,
    supportsPng: false,
    supportsJpeg: false,
    textLimits: { sponsoredMessageMaxChars: 160 },
    moderationRules: ['Официальный Telegram Ads - text-only sponsored message до 160 символов.', 'Баннер по умолчанию не требуется; карточка используется для планирования.'],
    notes: 'Это не официальный баннерный формат.',
    sourceName: 'Telegram Ads sponsored message requirements',
    sourceType: 'official',
    confidence: 'high',
    requiredElements: ['title'],
  }),
  entry({
    id: 'telegram-story',
    label: 'Telegram История',
    platformId: 'telegram-post',
    platformName: 'Telegram channel post',
    placementName: 'Native post / story 9:16',
    placementGroup: 'social-post',
    device: 'social',
    goal: 'social-post',
    width: 1080,
    height: 1920,
    safeArea: pctSafe(12, 6, 10, 6, 'Legacy safe zone for story-like Telegram placement.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 5120,
    moderationRules: ['Помечено как social-post, не official ad.'],
    sourceName: 'Telegram channel post practical sizes',
    sourceType: 'manual',
    confidence: 'medium',
    typescaleBoost: 1.18,
  }),
  ...simpleEntries('telegram-post', 'Telegram channel post', 'social-post', 'social', 'social-post', [
    ['telegram-post-1080x1080', 'Native post 1:1', 1080, 1080],
    ['telegram-post-1080x1350', 'Native post 4:5', 1080, 1350],
    ['telegram-post-1200x628', 'Native post horizontal', 1200, 628],
    ['telegram-post-1920x1080', 'Native post 16:9', 1920, 1080],
    ['telegram-post-800x400', 'Практический горизонтальный баннер для поста', 800, 400],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Практическая безопасная зона для поста канала.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 5120,
    moderationRules: ['Помечено как social-post, не official ad.'],
    sourceName: 'Telegram channel post practical sizes',
    sourceType: 'manual',
    confidence: 'medium',
  }),
]

const legacyEntries = [
  entry({
    id: 'instagram-story',
    platformId: 'instagram',
    platformName: 'Instagram',
    placementName: 'Story 9:16',
    placementGroup: 'legacy-social',
    device: 'social',
    goal: 'social-post',
    width: 1080,
    height: 1920,
    safeArea: pctSafe(14, 6, 12, 6, 'Legacy safe zone for story-like placement.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 5120,
    moderationRules: ['Legacy format retained for saved projects.'],
    sourceName: 'Legacy application preset',
    sourceType: 'manual',
    confidence: 'medium',
    defaultComposition: 'hero-overlay',
    typescaleBoost: 1.18,
  }),
  entry({
    id: 'yandex-market-banner',
    platformId: 'yandex-market',
    platformName: 'Yandex Market',
    placementName: 'Banner',
    placementGroup: 'legacy-marketplace',
    device: 'marketplace',
    goal: 'marketplace',
    width: 1080,
    height: 450,
    safeArea: pctSafe(5, 5, 5, 5, 'Legacy safe zone retained for saved projects.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 512,
    sourceName: 'Legacy application preset',
    sourceType: 'manual',
    confidence: 'medium',
    requiredElements: ['title', 'cta'],
    defaultComposition: 'split-right-image',
  }),
  ...simpleEntries('yandex-market', 'Яндекс Маркет', 'legacy-marketplace', 'marketplace', 'marketplace', [
    ['yandex-market-card', 'Карточка 1:1', 1080, 1080],
    ['yandex-market-stretch', 'Растяжка', 1706, 184],
    ['yandex-market-vertical', 'Вертикальная карточка', 940, 1524],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Legacy safe zone retained for saved projects.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 512,
    sourceName: 'Legacy application preset',
    sourceType: 'manual',
    confidence: 'medium',
    requiredElements: ['title', 'cta'],
    defaultComposition: 'split-right-image',
  }),
  ...simpleEntries('wildberries', 'Wildberries / WB Media', 'legacy-marketplace', 'marketplace', 'marketplace', [
    ['wb-card', 'Карточка 3:4', 900, 1200],
    ['wb-infographic', 'Инфографика 3:4', 900, 1200],
  ], {
    safeArea: pctSafe(6, 5, 7, 5, 'Legacy safe zone retained for saved projects.'),
    overlayZones: [bottomAdLabel(28)],
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'psd'],
    maxFileSizeKb: 300,
    sourceName: 'Legacy application preset',
    sourceType: 'manual',
    confidence: 'medium',
    typescaleBoost: 1.08,
    gutter: 3.5,
  }),
  ...simpleEntries('avito', 'Авито Реклама', 'legacy', 'marketplace', 'marketplace', [
    ['avito-listing', 'Объявление', 1280, 960],
    ['avito-fullscreen', 'Видеолента', 1080, 1920],
  ], {
    safeArea: pctSafe(6, 6, 6, 6, 'Legacy safe zone retained for saved projects.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 2048,
    moderationRules: avitoCommonRules,
    sourceName: 'Legacy application preset',
    sourceType: 'manual',
    confidence: 'medium',
  }),
]

export const AD_FORMAT_CATALOG: AdFormatCatalogEntry[] = [
  ...yandexDisplayEntries(),
  ...vkCatalogEntries(),
  ...simpleEntries('ok', 'Одноклассники / myTarget', 'social', 'social', 'social-post', okEntries, {
    safeArea: pctSafe(6, 6, 6, 6, 'Базовая безопасная зона для социальных форматов.'),
    allowedFileTypes: ['jpg', 'jpeg', 'png'],
    maxFileSizeKb: 5120,
    moderationRules: socialTextRules,
    sourceName: 'OK/myTarget-like social formats, normalized manually',
    sourceType: 'industry_reference',
    confidence: 'medium',
  }),
  ...avitoEntries,
  ...ozonEntries,
  ...wbEntries,
  ...gisEntries,
  ...telegramEntries,
  ...legacyEntries,
]

export function aspectRatioText(format: Pick<FormatRuleSet, 'width' | 'height'>): string {
  return ratioLabel(format.width, format.height)
}
