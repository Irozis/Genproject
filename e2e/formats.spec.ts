import { test, expect } from '@playwright/test'

test.describe('Onboarding', () => {
  test('shows wordmark and three mode cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Adaptive Graphics')).toBeVisible()
    await expect(page.getByText('Import reference image')).toBeVisible()
    await expect(page.getByText('Build master creative')).toBeVisible()
    await expect(page.getByText('Start from brand template')).toBeVisible()
  })
})

test.describe('Editor — entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('Create new →').click()
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

  test('shows all four format previews by default', async ({ page }) => {
    await expect(page.getByText('Marketplace Card')).toBeVisible()
    await expect(page.getByText('Product Highlight')).toBeVisible()
    await expect(page.getByText('Social Square')).toBeVisible()
    await expect(page.getByText('Story')).toBeVisible()
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
    await page.getByText('Create new →').click()
  })

  test('toggling title off removes it from all previews', async ({ page }) => {
    // Enable the title row toggle (first checkbox in element list)
    const titleCheckbox = page.locator('.el-row').filter({ hasText: 'Title' }).locator('input[type=checkbox]')
    await titleCheckbox.uncheck()

    // The SVG should no longer contain the title text
    // (default text is "Summer drop, ready to ship")
    const svgText = await page.locator('.preview__svg').first().textContent()
    expect(svgText ?? '').not.toContain('Summer drop')
  })

  test('switching sidebar to Assets tab shows image upload', async ({ page }) => {
    await page.getByRole('button', { name: 'Assets' }).click()
    await expect(page.getByText('Main image')).toBeVisible()
    await expect(page.getByText('Logo')).toBeVisible()
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
    await page.getByText('Create new →').click()
    await page.waitForTimeout(200) // let SVGs render

    await expect(page).toHaveScreenshot('editor-default.png', { maxDiffPixelRatio: 0.02 })
  })
})
