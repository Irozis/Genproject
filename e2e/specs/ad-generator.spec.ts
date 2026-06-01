import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const STORAGE_KEY = 'adaptive-graphics:project:v2'
const fixtureDir = join(process.cwd(), 'e2e', 'fixtures')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY)
})

test('creates a project from image upload to export step', async ({ page }) => {
  await createProjectToFormats(page, 'horizontal-product.jpg')
  await page.getByTestId('select-recommended-formats').click()
  await ensureSomeFormatSelected(page)

  await next(page)
  await expect(page.getByTestId('export-step')).toBeVisible()
  await expect(page.getByTestId('export-step')).toContainText('Экспорт и скачивание')
  await expect(page.getByTestId('export-step').getByTestId('download-zip-button')).toBeEnabled()
  await expect(page.getByTestId('preview-card').first()).toBeVisible()
  await expect(page.locator('[data-validation-status]').first()).toHaveAttribute('data-validation-status', /ready|warning|error/)
})

test('ranks recommended formats for horizontal, vertical, and square images', async ({ page }) => {
  await createProjectToFormats(page, 'horizontal-product.jpg')
  await expect(page.getByTestId('recommended-formats-panel')).toBeVisible()
  await expect(page.locator('[data-testid="recommended-format"][data-recommendation-level="excellent"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="recommended-format"][data-image-mode="smart-crop"], [data-testid="recommended-format"][data-image-mode="contain"]').first()).toBeVisible()
  await page.getByTestId('select-recommended-formats').click()
  await ensureSomeFormatSelected(page)

  await createProjectToFormats(page, 'vertical-product.jpg')
  await expect(page.locator('[data-testid="recommended-format"][data-format-id*="story"], [data-testid="recommended-format"][data-format-id*="vertical"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="recommended-format"][data-warning-count]:not([data-warning-count="0"])').first()).toBeVisible()

  await createProjectToFormats(page, 'square-product.jpg')
  await expect(page.locator('[data-testid="recommended-format"][data-format-id*="square"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="recommended-format"][data-image-mode="contain"], [data-testid="recommended-format"][data-image-mode="smart-crop"]').first()).toBeVisible()
})

test('small and horizontal formats render without critical UI errors', async ({ page }) => {
  await createProjectToFormats(page, 'horizontal-product.jpg', {
    title: 'Big seasonal campaign with a very long headline for narrow placements',
    subtitle: 'Detailed offer copy that should wrap, clamp, or hide gracefully when the format becomes too small.',
  })

  for (const [width, height] of [
    [320, 50],
    [320, 100],
    [319, 57],
    [728, 90],
    [1456, 180],
    [2880, 300],
    [300, 250],
  ]) {
    await selectFormatBySize(page, width, height)
  }

  await next(page)
  const cards = page.getByTestId('preview-card')
  await expect(cards.first()).toBeVisible()
  await expect.poll(() => cards.count()).toBeGreaterThan(0)
  await expect(page.locator('[data-validation-status="error"]')).toHaveCount(0)
})

test('palette list is stable on selection, changes on regeneration, and survives reload', async ({ page }) => {
  await createProjectToStyle(page)
  const paletteIdsBefore = await paletteIds(page)
  const paletteSignaturesBefore = await paletteSignatures(page)
  expect(paletteIdsBefore.length).toBeGreaterThan(1)

  await page.getByTestId('palette-card').nth(0).click()
  await expect.poll(() => paletteIds(page)).toEqual(paletteIdsBefore)
  await page.getByTestId('palette-card').nth(1).click()
  await expect.poll(() => paletteIds(page)).toEqual(paletteIdsBefore)

  await page.getByTestId('regenerate-palettes-button').click()
  await expect.poll(async () => JSON.stringify(await paletteSignatures(page))).not.toBe(JSON.stringify(paletteSignaturesBefore))
  const selectedAfterRegenerate = await selectedPaletteId(page)
  expect(selectedAfterRegenerate).toBeTruthy()

  await page.waitForTimeout(450)
  await page.reload()
  const restoredPaletteId = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw).selectedPaletteId : ''
  }, STORAGE_KEY)
  expect(restoredPaletteId).toBe(selectedAfterRegenerate)
})

test('editing and app/browser back preserve the project draft', async ({ page }) => {
  await createProjectToFormats(page, 'square-product.jpg')
  await page.getByTestId('select-recommended-formats').click()
  await ensureSomeFormatSelected(page)
  await next(page)
  await page.getByRole('button', { name: /редактированию/i }).click()
  await expect(page.getByTestId('editor-step')).toBeVisible()

  const before = await editorState(page)
  await page.getByTestId('edit-format-button').first().click()
  await expect(page.locator('.layout-editor')).toBeVisible()
  await page.locator('.layout-editor [data-testid="back-button"]').click()
  await expect(page.locator('.layout-editor')).toHaveCount(0)

  await page.getByTestId('back-button').first().click()
  await expect(page.getByTestId('export-step')).toBeVisible()
  const afterAppBack = await editorState(page)
  expect(afterAppBack.id).toBe(before.id)
  expect(afterAppBack.brandName).toBe(before.brandName)
  expect(afterAppBack.selectedFormats).toEqual(before.selectedFormats)
  expect(afterAppBack.selectedPaletteId).toBe(before.selectedPaletteId)

  await page.goBack()
  await expect(page.getByTestId('app-start')).toHaveCount(0)
  expect((await editorState(page)).id).toBe(before.id)
})

test('final export downloads a zip and shows completion feedback', async ({ page }) => {
  await createProjectToFormats(page, 'square-product.jpg')
  await page.getByTestId('select-recommended-formats').click()
  await ensureSomeFormatSelected(page)
  await next(page)
  await page.getByRole('button', { name: /редактированию/i }).click()
  await expect(page.getByTestId('editor-step')).toBeVisible()
  await expect(page.getByTestId('preview-card').first()).toBeVisible()

  await page.getByTestId('export-all-button').click()
  const download = page.waitForEvent('download')
  await page.getByTestId('download-zip-button').click()
  await expect((await download).suggestedFilename()).toMatch(/\.zip$/)
  await expect(page.getByText('Материалы готовы.')).toBeVisible()
})

async function createProjectToFormats(page: Page, imageName: string, text = defaultText) {
  await createProjectToStyle(page, imageName, text)
  await next(page)
  await expect(page.getByTestId('format-step')).toBeVisible()
  await expect(page.getByTestId('recommended-formats-panel')).toBeVisible()
}

async function createProjectToStyle(page: Page, imageName = 'square-product.jpg', text = defaultText) {
  await page.goto('/')
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY)
  await page.goto('/')
  await expect(page.getByTestId('app-start')).toBeVisible()
  await page.getByTestId('create-project-button').first().click()
  await expect(page.getByTestId('upload-image-input')).toBeAttached()
  await uploadFixture(page, imageName)
  await next(page)
  await next(page)
  await expect(page.getByTestId('content-step')).toBeVisible()
  await page.getByTestId('content-title-input').fill(text.title)
  await page.getByTestId('content-subtitle-input').fill(text.subtitle)
  await page.getByTestId('content-cta-input').fill('Buy now')
  await next(page)
  await expect(page.getByTestId('style-step')).toBeVisible()
  await page.getByTestId('brand-name-input').fill('E2E Brand')
}

async function uploadFixture(page: Page, imageName: string) {
  await page.getByTestId('upload-image-input').setInputFiles({
    name: imageName,
    mimeType: 'image/svg+xml',
    buffer: readFileSync(join(fixtureDir, imageName)),
  })
}

async function next(page: Page) {
  await page.locator('.wizard-nav .btn-primary').click()
}

async function selectFormatBySize(page: Page, width: number, height: number) {
  const row = page.locator(`[data-testid="format-row"][data-format-width="${width}"][data-format-height="${height}"]`).first()
  await expect(row).toBeVisible()
  if ((await row.getAttribute('data-selected')) !== 'true') await row.click()
}

async function editorState(page: Page) {
  const editor = page.locator('.editor')
  return {
    id: await editor.getAttribute('data-project-id'),
    brandName: await editor.getAttribute('data-brand-name'),
    selectedFormats: (await editor.getAttribute('data-selected-formats') || '').split(',').filter(Boolean),
    selectedPaletteId: await editor.getAttribute('data-selected-palette-id'),
  }
}

async function selectedFormatCount(page: Page) {
  return Number(await page.locator('.editor').getAttribute('data-selected-format-count') ?? 0)
}

async function ensureSomeFormatSelected(page: Page) {
  if (await selectedFormatCount(page) === 0) {
    await page.getByTestId('recommended-format').first().click()
  }
  await expect.poll(() => selectedFormatCount(page)).toBeGreaterThan(0)
}

async function paletteIds(page: Page) {
  return page.getByTestId('palette-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-palette-id') || ''))
}

async function paletteSignatures(page: Page) {
  return page.getByTestId('palette-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-palette-signature') || ''))
}

async function selectedPaletteId(page: Page) {
  return page.locator('.editor').getAttribute('data-selected-palette-id')
}

const defaultText = {
  title: 'Fresh product launch for every ad platform',
  subtitle: 'Clean creative assets generated automatically for social, banners, and marketplace placements.',
}
