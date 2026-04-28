import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const feedRows = [
  // Group 1: nominal (short text)
  { id: 'n_01', title: 'Летняя коллекция', subtitle: 'Новинки этого сезона уже в наличии', cta: 'Купить', badge: 'Новинка' },
  { id: 'n_02', title: 'Осенние новинки', subtitle: 'Тёплые модели для прохладных дней', cta: 'Смотреть', badge: 'Хит' },
  { id: 'n_03', title: 'Городской стиль', subtitle: 'Удобные решения на каждый день', cta: 'Выбрать', badge: 'Выбор' },
  { id: 'n_04', title: 'Базовый гардероб', subtitle: 'Классика, которая легко сочетается всегда', cta: 'Подробнее', badge: 'База' },
  { id: 'n_05', title: 'Спортивная линия', subtitle: 'Лёгкие ткани для активного ритма', cta: 'Заказать', badge: 'Комфорт' },
  { id: 'n_06', title: 'Деним капсула', subtitle: 'Актуальные фасоны в новых оттенках', cta: 'Смотреть', badge: 'Тренд' },
  { id: 'n_07', title: 'Праздничная серия', subtitle: 'Элегантные образы для особых событий', cta: 'Купить', badge: 'Премиум' },
  { id: 'n_08', title: 'Новая обувь', subtitle: 'Модели с мягкой посадкой и поддержкой', cta: 'Выбрать', badge: 'Новое' },
  { id: 'n_09', title: 'Аксессуары сезона', subtitle: 'Детали, которые завершают ваш образ', cta: 'Подробнее', badge: 'Топ' },
  { id: 'n_10', title: 'Weekend подборка', subtitle: 'Свободные силуэты для отдыха и прогулок', cta: 'Заказать', badge: 'Лимит' },

  // Group 2: translated-long (simulated German/Finnish translation)
  {
    id: 't_01',
    title: 'Sommerkollektion Neuheiten Edition',
    subtitle: 'Die neuesten Produkte dieser Saison sind jetzt verfugbar und sofort bequem online bestellbar',
    cta: 'Jetzt entdecken',
    badge: 'Neu eingetroffen',
  },
  {
    id: 't_02',
    title: 'Herbstangebote Premium Auswahl',
    subtitle: 'Ajankohtaiset kausimallit ovat saatavilla verkossa nopealla toimituksella koko maahan',
    cta: 'Katso valikoima',
    badge: 'Suosittu valinta',
  },
  {
    id: 't_03',
    title: 'Urban Lifestyle Kollektion',
    subtitle: 'Die aktualisierte Linie bietet mehr Komfort, bessere Materialien und langere Haltbarkeit im Alltag',
    cta: 'Mehr erfahren',
    badge: 'Empfohlen',
  },
  {
    id: 't_04',
    title: 'Nordic Essentials Sortiment',
    subtitle: 'Uusi mallisto yhdistaa selkean muotoilun, kaytannollisyyden ja ajattoman tyylin joka paivaan',
    cta: 'Tutustu heti',
    badge: 'Kausiuutuus',
  },
  {
    id: 't_05',
    title: 'Sport Performance Highlights',
    subtitle: 'Die neue Serie ist fur intensive Bewegung entwickelt und unterstutzt ein aktives Tempo dauerhaft',
    cta: 'Jetzt bestellen',
    badge: 'Performance',
  },
  {
    id: 't_06',
    title: 'Denim Trends Auswahl',
    subtitle: 'Paivitetyt leikkaukset ja monipuoliset varisavyt tarjoavat joustavuutta arjen pukeutumiseen helposti',
    cta: 'Katso nyt',
    badge: 'Trendikäs',
  },
  {
    id: 't_07',
    title: 'Festive Moments Collection',
    subtitle: 'Die eleganten Modelle fur besondere Anlasse verbinden modernen Look mit angenehm leichter Passform',
    cta: 'Kollektion ansehen',
    badge: 'Premium Wahl',
  },
  {
    id: 't_08',
    title: 'Comfort Shoes Neuheiten',
    subtitle: 'Korkea kayttomukavuus, pehmea sisarakenne ja tarkka tuki tekevat paivittaisesta kaytosta kevytta',
    cta: 'Valitse malli',
    badge: 'Mukavuus',
  },
  {
    id: 't_09',
    title: 'Season Accessories Line',
    subtitle: 'Die abgestimmten Details erganzen jedes Outfit harmonisch und sorgen fur einen klaren Gesamtstil',
    cta: 'Details sehen',
    badge: 'Top Auswahl',
  },
  {
    id: 't_10',
    title: 'Weekend Capsule Drop',
    subtitle: 'Rentoon viikonloppuun suunnitellut tuotteet yhdistavat toimivuuden, tyylin ja kestavan laadun',
    cta: 'Nayta tuotteet',
    badge: 'Rajoitettu erä',
  },

  // Group 3: stress-long (very long text)
  {
    id: 's_01',
    title: 'Грандиозная летняя распродажа коллекции сезона 2026 года для всей семьи',
    subtitle:
      'Все товары нашего летнего каталога доступны со скидкой до пятидесяти процентов при заказе от двух единиц товара с бесплатной доставкой по всей России и удобной возможностью возврата в течение тридцати дней',
    cta: 'Перейти к каталогу',
    badge: 'Большой запуск',
  },
  {
    id: 's_02',
    title: 'Масштабная осенняя подборка тёплых моделей для города и дальних поездок',
    subtitle:
      'Мы собрали практичные и стильные решения, которые подходят для ежедневной носки, долгих прогулок и переменчивой погоды, чтобы вы могли комфортно планировать рабочие дни и выходные без компромиссов',
    cta: 'Смотреть все модели',
    badge: 'Сезонный выбор',
  },
  {
    id: 's_03',
    title: 'Премиальная капсула для деловых встреч, переговоров и вечерних мероприятий',
    subtitle:
      'Эта серия объединяет материалы высокого качества, продуманные силуэты и аккуратные детали, чтобы вы выглядели уверенно в любой ситуации, сохраняли комфорт в течение дня и подчеркивали индивидуальный стиль',
    cta: 'Узнать подробнее',
    badge: 'Премиум серия',
  },
  {
    id: 's_04',
    title: 'Спортивная линейка для активного образа жизни и высокой динамики каждый день',
    subtitle:
      'Лёгкие дышащие ткани, анатомичный крой и современный дизайн делают эту коллекцию отличным выбором для тренировок, прогулок и поездок, помогая сохранять свободу движений и аккуратный внешний вид',
    cta: 'Выбрать комплект',
    badge: 'Максимум комфорта',
  },
  {
    id: 's_05',
    title: 'Новая джинсовая коллекция с акцентом на комфорт, посадку и современный стиль',
    subtitle:
      'Мы обновили популярные модели, добавили универсальные цвета и улучшили посадку, чтобы каждая вещь легко сочеталась с вашим базовым гардеробом, подходила для офиса и оставалась удобной в течение дня',
    cta: 'Открыть новинки',
    badge: 'Обновлённая классика',
  },
  {
    id: 's_06',
    title: 'Коллекция аксессуаров для завершения повседневных, деловых и праздничных образов',
    subtitle:
      'В подборке представлены сумки, ремни и другие детали, которые помогают быстро собрать гармоничный комплект и подчеркнуть индивидуальный стиль, сохраняя баланс между функциональностью и визуальной выразительностью',
    cta: 'Перейти к аксессуарам',
    badge: 'Новые детали',
  },
  {
    id: 's_07',
    title: 'Большая распродажа ограниченной серии с максимально выгодными условиями покупки',
    subtitle:
      'Только в этом месяце вы можете оформить заказ по специальной цене, получить дополнительные бонусы и бесплатную доставку в большинство регионов, чтобы сэкономить бюджет и обновить гардероб без лишних затрат',
    cta: 'Получить скидку',
    badge: 'Только сейчас',
  },
  {
    id: 's_08',
    title: 'Городская коллекция для насыщенного ритма работы, встреч и активного отдыха',
    subtitle:
      'Функциональные материалы и универсальные фасоны позволяют легко адаптировать образы под офис, встречу с друзьями и вечерние планы без лишних усилий, сохраняя удобство и аккуратный вид в течение всего дня',
    cta: 'Посмотреть подборку',
    badge: 'Универсальный стиль',
  },
  {
    id: 's_09',
    title: 'Комфортная обувная линия с мягкой поддержкой и устойчивостью на весь день',
    subtitle:
      'Каждая модель разработана так, чтобы снизить нагрузку на стопу, обеспечить устойчивость при ходьбе и сохранить аккуратный внешний вид в течение дня, даже если вы много перемещаетесь между задачами и встречами',
    cta: 'Подобрать пару',
    badge: 'Лидер продаж',
  },
  {
    id: 's_10',
    title: 'Итоговая сезонная подборка лучших предложений и абсолютных хитов продаж',
    subtitle:
      'Собрали самые востребованные позиции в одном месте, чтобы вы могли быстро сравнить варианты, выбрать подходящее решение и оформить заказ за пару минут, получив оптимальное сочетание цены, качества и сервиса',
    cta: 'Собрать заказ',
    badge: 'Финальный дроп',
  },
]

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

const feedCsv = [
  'id,title,subtitle,cta,badge',
  ...feedRows.map((row) =>
    [row.id, row.title, row.subtitle, row.cta, row.badge].map(escapeCsv).join(','),
  ),
  '',
].join('\n')

const projectData = {
  id: 'test-project',
  name: 'Test Project',
  master: {
    background: {
      kind: 'solid',
      color: '#ffffff',
    },
    accent: '#ffffff',
    title: {
      text: 'Summer drop, ready to ship',
      x: 6,
      y: 18,
      w: 60,
      fontSize: 7,
      charsPerLine: 18,
      maxLines: 3,
      weight: 900,
      fill: '#1a1a1a',
    },
    subtitle: {
      text: 'Marketplace-ready layouts in one click.',
      x: 6,
      y: 44,
      w: 50,
      fontSize: 3,
      charsPerLine: 32,
      maxLines: 2,
      weight: 400,
      fill: '#1a1a1a',
    },
    cta: {
      text: 'Shop now',
      x: 6,
      y: 84,
      w: 30,
      h: 7,
      fontSize: 2.6,
      charsPerLine: 14,
      maxLines: 1,
      weight: 700,
      fill: '#1a1a1a',
      bg: '#ffffff',
      rx: 999,
    },
    image: {
      x: 50,
      y: 8,
      w: 44,
      h: 84,
      src: null,
      rx: 16,
      fit: 'cover',
    },
    blocks: [
      { id: 'title', x: 8, y: 12, w: 48, h: 22 },
      { id: 'subtitle', x: 8, y: 38, w: 48, h: 12 },
      { id: 'cta', x: 8, y: 82, w: 28, h: 8 },
      { id: 'image', x: 58, y: 12, w: 34, h: 76 },
    ],
  },
  enabled: {
    title: true,
    subtitle: true,
    cta: true,
    badge: false,
    logo: false,
    image: true,
  },
  brandKit: {
    brandName: 'Atlas Goods',
    displayFont: '"Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
    palette: {
      ink: '#1a1a1a',
      inkMuted: '#4E5155',
      surface: '#FFFFFF',
      accent: '#ffffff',
      accentSoft: '#f1f1f1',
    },
    gradient: ['#FFEDD5', '#FED7AA', '#FDBA74'],
    toneOfVoice: 'neutral',
    ctaStyle: 'pill',
  },
  goal: 'promo-pack',
  visualSystem: 'product-card',
  assetHint: null,
  imageSrc: 'https://picsum.photos/1200/1200',
  logoSrc: null,
  activeLocale: 'en',
  availableLocales: ['en'],
  selectedFormats: [
    'custom:marketplace-card-1200',
    'custom:product-highlight-1080x1350',
    'custom:social-square-1080',
    'custom:story-1080x1920',
  ],
  blockOverrides: {
    'custom:marketplace-card-1200': {
      title: { x: 8, y: 12, w: 46, h: 20 },
      subtitle: { x: 8, y: 35, w: 46, h: 12 },
      cta: { x: 8, y: 82, w: 28, h: 8 },
      image: { x: 56, y: 10, w: 36, h: 80 },
    },
    'custom:product-highlight-1080x1350': {
      title: { x: 8, y: 11, w: 50, h: 20 },
      subtitle: { x: 8, y: 34, w: 50, h: 12 },
      cta: { x: 8, y: 80, w: 30, h: 8 },
      image: { x: 54, y: 10, w: 38, h: 78 },
    },
    'custom:social-square-1080': {
      title: { x: 8, y: 12, w: 46, h: 20 },
      subtitle: { x: 8, y: 35, w: 46, h: 12 },
      cta: { x: 8, y: 82, w: 28, h: 8 },
      image: { x: 56, y: 10, w: 36, h: 80 },
    },
    'custom:story-1080x1920': {
      title: { x: 8, y: 10, w: 52, h: 20 },
      subtitle: { x: 8, y: 33, w: 52, h: 12 },
      cta: { x: 8, y: 78, w: 32, h: 8 },
      image: { x: 12, y: 46, w: 76, h: 42 },
    },
  },
  customFormats: [
    {
      key: 'custom:marketplace-card-1200',
      label: 'Marketplace Card 1200x1200',
      width: 1200,
      height: 1200,
      aspectRatio: 1,
      safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
      gutter: 4,
      minTitleSize: 5,
      maxTitleLines: 3,
      requiredElements: ['title', 'subtitle', 'cta', 'image'],
    },
    {
      key: 'custom:product-highlight-1080x1350',
      label: 'Product Highlight 1080x1350',
      width: 1080,
      height: 1350,
      aspectRatio: 0.8,
      safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
      gutter: 4,
      minTitleSize: 5,
      maxTitleLines: 3,
      requiredElements: ['title', 'subtitle', 'cta', 'image'],
    },
    {
      key: 'custom:social-square-1080',
      label: 'Social Square 1080x1080',
      width: 1080,
      height: 1080,
      aspectRatio: 1,
      safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
      gutter: 4,
      minTitleSize: 5,
      maxTitleLines: 3,
      requiredElements: ['title', 'subtitle', 'cta', 'image'],
    },
    {
      key: 'custom:story-1080x1920',
      label: 'Story 1080x1920',
      width: 1080,
      height: 1920,
      aspectRatio: 0.5625,
      safeZone: { top: 8, right: 5, bottom: 8, left: 5 },
      gutter: 3,
      minTitleSize: 5,
      maxTitleLines: 4,
      requiredElements: ['title', 'subtitle', 'cta', 'image'],
    },
  ],
} as const

async function main(): Promise<void> {
  const feedPath = path.join(projectRoot, 'test-feed.csv')
  const projectPath = path.join(projectRoot, 'project.json')

  await writeFile(feedPath, feedCsv, 'utf8')
  await writeFile(projectPath, JSON.stringify(projectData, null, 2), 'utf8')

  console.log('Test data created: test-feed.csv, project.json')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
