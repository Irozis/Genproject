import { expect, test } from '@playwright/test'

test('starts from onboarding and opens the guided wizard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-start')).toBeVisible()
  await page.getByTestId('create-project-button').first().click()
  await expect(page.getByTestId('upload-image-input')).toBeAttached()
})

test('default guided project keeps the editor shell fixed', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('create-project-button').first().click()

  const header = page.locator('.editor-header')
  const sidebar = page.locator('.sidebar')
  await expect(header).toBeVisible()
  await expect(sidebar).toBeVisible()
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(52)
  expect((await sidebar.boundingBox())!.width).toBe(320)
})
