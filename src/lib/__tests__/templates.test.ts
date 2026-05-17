import { describe, expect, it } from 'vitest'
import { DEFAULT_ENABLED } from '../defaults'
import { buildScene } from '../buildScene'
import { TEMPLATES } from '../templates'

const expected = {
  'fashion-drop': {
    brandName: 'Noir Atelier',
    title: 'Новый **силуэт** сезона',
    subtitle: 'Капсула из плотного хлопка, денима и вещей, которые быстро исчезают из наличия.',
    cta: 'Смотреть дроп',
    badge: 'Limited drop',
    accent: '#F15A3B',
  },
  'skincare-lab': {
    brandName: 'Dermalab',
    title: 'Уход, основанный на **активных формулах**',
    subtitle: 'Сыворотки и кремы для ежедневного восстановления кожи',
    cta: 'Подобрать уход',
    badge: 'Новинка',
    accent: '#78AA9B',
  },
  'coffee-roastery': {
    brandName: 'Ember Roastery',
    title: 'Свежая **обжарка** каждую неделю',
    subtitle: 'Авторские сорта кофе для дома, офиса и кофейни',
    cta: 'Выбрать кофе',
    badge: 'Новая партия',
    accent: '#D98A45',
  },
  'fintech-card': {
    brandName: 'Vector Pay',
    title: 'Карта, которая **держит ритм**',
    subtitle: 'Кэшбэк до 5%, понятные лимиты и платежи без лишних экранов.',
    cta: 'Оформить карту',
    badge: 'До 5% кэшбэк',
    accent: '#54D79A',
  },
  'travel-retreat': {
    brandName: 'TERRA Retreat',
    title: 'Три дня **тишины** у озера',
    subtitle: 'Камерные домики, завтраки на террасе и маршруты, в которых не нужно спешить.',
    cta: 'Выбрать даты',
    badge: 'Места ограничены',
    accent: '#EAC06A',
  },
  'kids-school': {
    brandName: 'BrightNest School',
    title: 'Английский через **игру** и проекты',
    subtitle: 'Мини-группы 7-10 лет: говорим, играем и собираем первые проекты на английском.',
    cta: 'Записаться',
    badge: 'Пробный урок',
    accent: '#2F8DFF',
  },
  'estate-premium': {
    brandName: 'VISTA Residence',
    title: 'Квартиры бизнес-класса **у воды**',
    subtitle: 'Панорамные виды, приватный двор и готовая инфраструктура',
    cta: 'Смотреть планировки',
    badge: 'Старт продаж',
    accent: '#C9AA67',
  },
  'fitness-club': {
    brandName: 'Pulse Fitness',
    title: 'Тренировки, которые **входят в привычку**',
    subtitle: 'Персональные программы, групповые занятия и зона восстановления',
    cta: 'Получить гостевой визит',
    badge: '7 дней бесплатно',
    accent: '#D7FF38',
  },
  'farm-grocery': {
    brandName: 'Harvest Lane',
    title: 'Овощи, собранные **сегодня**',
    subtitle: 'Сезонные наборы от локальных фермеров с доставкой в день сбора.',
    cta: 'Собрать корзину',
    badge: 'Свежий привоз',
    accent: '#2F8F5B',
  },
  'saas-dashboard': {
    brandName: 'MetricFlow',
    title: 'Контроль показателей **в одном дашборде**',
    subtitle: 'Отслеживайте продажи, воронку и retention без ручных отчётов',
    cta: 'Попробовать демо',
    badge: 'Для команд',
    accent: '#3DB7FF',
  },
} as const

describe('brand templates', () => {
  it('ships rebuilt starter-kit copy and brand systems for every built-in template', () => {
    expect(TEMPLATES.map((template) => template.id)).toEqual(Object.keys(expected))

    for (const template of TEMPLATES) {
      const spec = expected[template.id as keyof typeof expected]
      expect(template.brandKit.brandName).toBe(spec.brandName)
      expect(template.brandKit.palette.accent).toBe(spec.accent)
      expect(template.master.title?.text).toBe(spec.title)
      expect(template.master.subtitle?.text).toBe(spec.subtitle)
      expect(template.master.cta?.text).toBe(spec.cta)
      expect(template.master.badge?.text).toBe(spec.badge)
      expect(template.master.image?.src).toContain('images.unsplash.com')
      expect(template.enabled?.badge).toBe(true)
    }
  })

  it('uses compact copy without subtitles for small banner formats', () => {
    for (const template of TEMPLATES) {
      const enabled = { ...DEFAULT_ENABLED, ...template.enabled }
      const scene = buildScene(template.master, 'yandex-rsy-728x90', template.brandKit, enabled, {
        override: template.preferredModels?.['yandex-rsy-728x90'],
        blockOverrides: template.blockOverrides?.['yandex-rsy-728x90'],
        density: template.formatDensities?.['yandex-rsy-728x90'],
      })

      expect(scene.title).toBeDefined()
      expect(scene.cta).toBeDefined()
      expect(scene.subtitle).toBeUndefined()
    }
  })

  it('keeps marketplace formats on the safer product card composition', () => {
    for (const template of TEMPLATES) {
      expect(template.preferredModels?.['wb-card']).toBe('product-card-safe')
      expect(template.preferredModels?.['ozon-card']).toBe('product-card-safe')
      expect(template.preferredModels?.['yandex-market-card']).toBe('product-card-safe')
    }
  })
})
