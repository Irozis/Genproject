# Воспроизводимость результатов ВКР

Документ описывает, как повторно получить экспериментальные результаты по программному комплексу для адаптации рекламных материалов к различным цифровым форматам.

## Требования

- Node.js и npm;
- установленные зависимости проекта;
- Playwright browsers для сценариев, которые используют браузерный рендеринг PNG.

## Подготовка

Установить зависимости:

```bash
npm install
```

При необходимости установить браузеры Playwright:

```bash
npx playwright install
```

## Проверка проекта

Запустить тесты:

```bash
npm test
```

В Windows-окружении можно использовать прямой вызов:

```bash
npm.cmd test
```

Проверить сборку:

```bash
npm run build
```

## Повторный запуск исследования

Автоматический эксперимент по `layout-engine-v2`:

```bash
npx tsx scripts/run-layout-engine-v2-research.ts
```

Экспорт PNG для визуальной оценки:

```bash
npx tsx scripts/export-layout-engine-v2-visual-review-png.ts
```

Анализ визуальной оценки:

```bash
npx tsx scripts/analyze-layout-engine-v2-visual-review.ts
```

## Ожидаемые файлы результатов

После запуска исследовательских сценариев используются следующие файлы:

- `research-results/layout-v2-summary.txt`
- `research-results/layout-v2-summary.csv`
- `research-results/layout-v2-decisions.csv`
- `research-results/layout-v2-report.json`
- `research-results/layout-v2-fixed-vs-candidate-summary.txt`
- `research-results/visual-review/png/`
- `research-results/visual-review/visual-review-control-summary.txt`
- `research-results/visual-review/visual-review-control-by-method.csv`

## Связь с таблицами ВКР

| Данные ВКР | Файлы |
| ---------- | ----- |
| `critical` / `actionsToFix` | `research-results/layout-v2-summary.txt`, `research-results/layout-v2-summary.csv` |
| `fixedFallback` / `generated` | `research-results/layout-v2-fixed-vs-candidate-summary.txt` |
| visual score / critical defect rate | `research-results/visual-review/visual-review-control-by-method.csv`, `research-results/visual-review/visual-review-control-summary.txt` |
| детальные решения | `research-results/layout-v2-decisions.csv` |
| полный JSON | `research-results/layout-v2-report.json` |

## Актуальные контрольные значения

- каталог: 126 рекламных форматов;
- автоматический эксперимент: 126 форматов x 3 метода = 378 случаев;
- `scaling`: 43 critical, 157 `actionsToFix`, visual score 1,44;
- `fixedLayout`: 0 critical, 42 `actionsToFix`, visual score 1,75;
- `candidateSelection`: 0 critical, 29 `actionsToFix`, visual score 1,73.

Эти значения не следует изменять вручную в CSV/JSON/TXT-файлах. Если исследование запускается повторно и формирует новые результаты, в документации нужно указывать фактические значения из новых отчетов.

