# Программный комплекс для адаптации рекламных материалов к различным цифровым форматам

Проект предназначен для первичной технической адаптации рекламных материалов к набору цифровых форматов. Система не заменяет дизайнера и не гарантирует художественную завершенность макета: она формирует стартовую технически пригодную заготовку, выявляет critical-дефекты и формирует воспроизводимые отчеты для последующей доводки.

Основной проверяемый эффект проекта связан с отказом от простого масштабирования в пользу перестроения компоновки: снижается число critical-дефектов и уменьшается объем действий, необходимых для исправления результата (`actionsToFix`).

## Функциональность

- каталог из 126 рекламных форматов;
- модель исходного рекламного материала;
- `layout-engine-v2` для перестроения компоновки под целевой формат;
- generation candidates для проверки альтернативных компоновок;
- `fixedLayout` baseline как сильная базовая стратегия;
- `candidateSelection` with FixedLayout fallback;
- validator для выявления technical/critical-дефектов;
- расчет `actionsToFix`;
- CSV/JSON/TXT reports;
- visual review pipeline для оценки восприятия подготовленных заготовок;
- экспорт SVG/PNG/PDF/ZIP в интерфейсе приложения.

## Стек

- React;
- TypeScript;
- Vite;
- Electron;
- Vitest;
- Playwright;
- SVG/PNG export.

## Методы адаптации

В автоматическом эксперименте сравниваются три метода:

1. `scaling` - простое масштабирование исходной компоновки;
2. `fixedLayout` - детерминированное перестроение компоновки;
3. `candidateSelection` - выбор кандидата с FixedLayout fallback.

`fixedLayout` рассматривается как сильная базовая стратегия. `candidateSelection` является безопасной надстройкой: она использует `fixedLayout` как fallback и выбирает generated-кандидата только при улучшении по техническим метрикам.

## Экспериментальные результаты

Каталог содержит 126 рекламных форматов. Автоматический эксперимент покрывает 126 форматов x 3 метода = 378 случаев.

| Метод              | Critical | actionsToFix | Visual score |
| ------------------ | -------: | -----------: | -----------: |
| scaling            |       43 |          157 |         1,44 |
| fixedLayout        |        0 |           42 |         1,75 |
| candidateSelection |        0 |           29 |         1,73 |

Основной эффект достигается при отказе от простого масштабирования и переходе к перестроению компоновки. `candidateSelection` использует `fixedLayout` как fallback и улучшает часть случаев без ухудшения по `actionsToFix`.

Pairwise-сравнение `candidateSelection` и `fixedLayout`:

- `fixedFallback` выбран 116 раз;
- `generated` выбран 10 раз;
- `candidateSelection` лучше `fixedLayout` по `actionsToFix` в 10 случаях;
- одинаково в 116 случаях;
- хуже в 0 случаях.

Визуальная оценка использовалась для проверки восприятия технических заготовок, а не для доказательства художественной завершенности дизайна. В оценке участвовали 14 респондентов; проверено 60 PNG; собрано 840 оценок по шкале 0-2.

## Команды запуска

Установка зависимостей:

```bash
npm install
```

Запуск веб-версии:

```bash
npm run dev
```

Сборка:

```bash
npm run build
```

Тесты:

```bash
npm test
```

Desktop-режим через Electron:

```bash
npm run desktop:dev
```

Запуск исследовательских сценариев:

```bash
npx tsx scripts/run-layout-engine-v2-research.ts
npx tsx scripts/export-layout-engine-v2-visual-review-png.ts
npx tsx scripts/analyze-layout-engine-v2-visual-review.ts
```

## Где лежат результаты

- `research-results/layout-v2-summary.txt`
- `research-results/layout-v2-summary.csv`
- `research-results/layout-v2-decisions.csv`
- `research-results/layout-v2-report.json`
- `research-results/layout-v2-fixed-vs-candidate-summary.txt`
- `research-results/visual-review/`
- `research-results/visual-review/png/`
- `research-results/visual-review/visual-review-control-summary.txt`
- `research-results/visual-review/visual-review-control-by-method.csv`

Примеры PNG из визуальной проверки:

- `research-results/visual-review/png/case_001.png`
- `research-results/visual-review/png/case_002.png`

Скриншоты интерфейса можно разместить в `docs/assets/` после подготовки изображений интерфейса.

## Документация

- [Методология экспериментальной проверки](docs/research-testing-methodology.md)
- [Воспроизводимость результатов](docs/reproducibility.md)
- [Заметки для защиты](docs/defense-notes.md)

