import { expect, test } from '@playwright/test'
import type { AnalyzeResponse } from '../src/types/api'

const statement = 'Given an array of integers, answer the queries described in the problem.'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
      ? route.continue() : route.abort('blockedbyclient')
  })
})

test('input enforces trimmed length limits and Clear resets it', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('Problem statement', { exact: true })
  const submit = page.getByRole('button', { name: 'Analyze Problem', exact: true })
  await expect(submit).toBeDisabled()
  await input.fill('   \n\t')
  await expect(submit).toBeDisabled()
  await input.fill('x'.repeat(19))
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Add at least 20 characters to continue.')).toBeVisible()
  await input.fill('x'.repeat(20_001))
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Shorten the statement to 20,000 characters or fewer.')).toBeVisible()
  await input.fill('  ' + 'x'.repeat(20_000) + '  ')
  await expect(submit).toBeEnabled()
  // Ten emoji are ten Python/Unicode code points, not twenty UTF-16 units.
  await input.fill('😀'.repeat(10))
  await expect(submit).toBeDisabled()
  await input.fill('😀'.repeat(20))
  await expect(submit).toBeEnabled()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(submit).toBeDisabled()
})

test('real API round trip renders all sections and reveals hints sequentially', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('Backend connected', { exact: true })).toBeVisible()
  const input = page.getByLabel('Problem statement', { exact: true })
  await input.fill(`  ${statement}\n `)
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/analyze') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({ statement })
  const data: AnalyzeResponse = await response.json()
  expect(data.analysis_type).toBe('mock')
  await expect(page.getByLabel('Mock analysis warning')).toContainText('unrelated to your submission')
  expect(data.provider).toBe('fake')
  expect(data.model).toBeNull()
  for (const name of ['Problem Essence', 'Objective', 'Input/Output', 'Constraints', 'Complexity Guidance', 'Possible DSA Techniques', 'Important Observations', 'Progressive Hints', 'Uncertainties']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  for (const hint of data.hints) await expect(page.getByText(hint.text, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reveal Hint 2', exact: true })).toHaveCount(0)
  for (const hint of data.hints) {
    await page.getByRole('button', { name: `Reveal Hint ${hint.level}`, exact: true }).click()
    await expect(page.getByText(hint.text, { exact: true })).toBeVisible()
    for (const later of data.hints.filter(item => item.level > hint.level)) {
      await expect(page.getByText(later.text, { exact: true })).toHaveCount(0)
    }
  }
  await expect(page.getByText('All three demo hints are revealed.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('analysis.png'), fullPage: true })

  // Editing clears stale results; a fresh response starts with every hint hidden.
  await input.fill(statement + ' A different statement.')
  await expect(page.getByRole('heading', { name: 'Problem Essence', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reveal Hint 1', exact: true })).toBeVisible()
  for (const hint of data.hints) await expect(page.getByText(hint.text, { exact: true })).toHaveCount(0)
})

test('loading disables editing and prevents duplicate submissions', async ({ page }) => {
  let requests = 0
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/analyze', async route => {
    requests += 1
    const response = await route.fetch()
    await gate
    await route.fulfill({ response })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  try {
    await expect(page.getByRole('button', { name: 'Analyzing…', exact: true })).toBeDisabled()
    await expect(page.getByLabel('Problem statement', { exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled()
    await expect(page.getByText('Requesting analysis from the backend…')).toBeVisible()
    await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit())
  } finally {
    release()
  }
  await expect(page.getByRole('heading', { name: 'Problem Essence', exact: true })).toBeVisible()
  expect(requests).toBe(1)
})

test('HTTP errors preserve input and permit a successful real retry', async ({ page }) => {
  await page.route('**/api/v1/analyze', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }), { times: 1 })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('HTTP 503')
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Problem Essence', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('network failure is readable and preserves the statement', async ({ page }) => {
  await page.route('**/api/v1/analyze', route => route.abort('failed'))
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cannot reach the API')
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(statement)
  await expect(page.getByRole('button', { name: 'Analyze Problem', exact: true })).toBeEnabled()
})

test('backend validation errors are displayed clearly', async ({ page }) => {
  await page.route('**/api/v1/analyze', route => route.fulfill({ status: 422, json: { detail: [] } }))
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The backend rejected the statement')
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(statement)
})

test('unexpected successful response is rejected instead of crashing', async ({ page }) => {
  await page.route('**/api/v1/analyze', async route => {
    const response = await route.fetch()
    const data: AnalyzeResponse = await response.json()
    await route.fulfill({ json: { ...data, hints: [data.hints[2], data.hints[0], data.hints[1]] } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('unexpected analysis format')
  await expect(page.getByRole('heading', { name: 'Problem Essence', exact: true })).toHaveCount(0)
})

test('unreadable JSON is shown as an error', async ({ page }) => {
  await page.route('**/api/v1/analyze', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }))
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('unreadable JSON')
})

test('health indicator recovers after the API is available again', async ({ page }) => {
  await page.route('**/api/v1/health', route => route.abort('failed'))
  await page.goto('/')
  await expect(page.getByText('Backend unavailable', { exact: true })).toBeVisible()
  await page.unroute('**/api/v1/health')
  await page.getByRole('button', { name: 'Recheck', exact: true }).click()
  await expect(page.getByText('Backend connected', { exact: true })).toBeVisible()
})

test('AI response fixture displays provider, uncertainties and hidden hints', async ({ page }, testInfo) => {
  // UI branch only: reuse local fake content; no SDK or live Groq request.
  await page.route('**/api/v1/analyze', async route => {
    const response = await route.fetch()
    const data: AnalyzeResponse = await response.json()
    await route.fulfill({ json: {
      ...data, analysis_type: 'ai', provider: 'groq', model: 'openai/gpt-oss-120b', demo_notice: null,
      objective: null, input_summary: null, output_summary: null,
      constraints: [], complexity_guidance: [], possible_techniques: [], important_observations: [],
      uncertainties: ['Fixture only: input bounds were not provided.'],
    } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByLabel('AI analysis notice')).toContainText('openai/gpt-oss-120b')
  await expect(page.getByLabel('AI analysis notice')).toContainText('hypotheses')
  await expect(page.getByLabel('Mock analysis warning')).toHaveCount(0)
  await expect(page.getByText('Not reliably determined from the statement.')).toBeVisible()
  await expect(page.getByText('No constraints were reliably extracted. Check uncertainties.')).toBeVisible()
  await expect(page.getByText('Fixture only: input bounds were not provided.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal Hint 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal Hint 2', exact: true })).toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('ai-fixture.png'), fullPage: true })
})

test('free-tier limit displays a safe message without automatic retry', async ({ page }) => {
  let requests = 0
  await page.route('**/api/v1/analyze', route => {
    requests += 1
    return route.fulfill({ status: 429, json: { detail: { code: 'rate_limit', message: 'Raw provider detail must not be rendered' } } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Groq free-tier capacity has been reached')
  await expect(page.getByRole('alert')).not.toContainText('Raw provider detail')
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(statement)
  expect(requests).toBe(1)
})

test('inconsistent AI/demo metadata is rejected', async ({ page }) => {
  await page.route('**/api/v1/analyze', async route => {
    const response = await route.fetch()
    const data: AnalyzeResponse = await response.json()
    await route.fulfill({ json: { ...data, analysis_type: 'ai' } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('unexpected analysis format')
})
