import { test, expect } from '@playwright/test'

test.describe('Onboarding', () => {
  test('shows wordmark and three mode cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Генератор креативов')).toBeVisible()
    await expect(page.getByText('Загрузить референс')).toBeVisible()
    await expect(page.getByText('Создать мастер-креатив')).toBeVisible()
    await expect(page.getByText('Выбрать бренд-шаблон')).toBeVisible()
  })
})

test.describe('Editor — entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('Создать новый').click()
  })

  test('renders editor header at ≤52px height', async ({ page }) => {
    const header = page.locator('.editor-header')
    await expect(header).toBeVisible()
    const box = await header.boundingBox()
    expect(box!.height).toBeLessThanOrEqual(52)
  })

  test('sidebar is exactly 320px wide', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    await expect(sidebar).toBeVisible()
    const box = await sidebar.boundingBox()
    expect(box!.width).toBe(320)
  })

  test('shows key default format previews', async ({ page }) => {
    const previewTitles = page.locator('.preview__title')
    await expect(previewTitles.filter({ hasText: /^VK Пост 1:1$/ })).toBeVisible()
    await expect(previewTitles.filter({ hasText: /^VK Пост 4:5$/ })).toBeVisible()
    await expect(previewTitles.filter({ hasText: /^Telegram История$/ })).toBeVisible()
    await expect(previewTitles.filter({ hasText: /^WB Карточка 3:4$/ })).toBeVisible()
  })

  test('page itself does not scroll (editor is 100vh)', async ({ page }) => {
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const clientHeight = await page.evaluate(() => document.documentElement.clientHeight)
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight)
  })
})

test.describe('Editor — live update', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('Создать новый').click()
  })

  test('toggling title off removes it from all previews', async ({ page }) => {
    const titleCheckbox = page.getByRole('checkbox', { name: 'Заголовок', exact: true })
    await titleCheckbox.uncheck()

    // The SVG should no longer contain the title text.
    const svgText = await page.locator('.preview__svg').first().textContent()
    expect(svgText ?? '').not.toContain('Покупки к лету')
  })

  test('switching sidebar to Assets tab shows image upload', async ({ page }) => {
    await page.getByRole('tab', { name: 'Медиа' }).click()
    await expect(page.getByText('Основное изображение')).toBeVisible()
    await expect(page.getByText('Логотип')).toBeVisible()
  })
})

test.describe('Visual snapshots', () => {
  test('onboarding page matches snapshot', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('onboarding.png', { maxDiffPixelRatio: 0.02 })
  })

  test('editor with default project matches snapshot', async ({ page }) => {
    // Clear any saved project so we always get the default
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await page.getByText('Создать новый').click()
    await page.waitForTimeout(200) // let SVGs render

    await expect(page).toHaveScreenshot('editor-default.png', { maxDiffPixelRatio: 0.02 })
  })
})
