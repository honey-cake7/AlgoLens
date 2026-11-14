import { expect, test } from '@playwright/test'
import type { AnalyzeResponse } from '../src/types/api'
import type { AlgorithmicAssessment } from '../src/types/algorithmic'

const statement = 'Given an array of integers, answer the queries described in the problem.'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
      ? route.continue() : route.abort('blockedbyclient')
  })
})

test('a pasted problem link is refused with a clear instruction, but text containing a link is allowed', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('Problem statement', { exact: true })
  const submit = page.getByRole('button', { name: 'Analyze Problem', exact: true })
  for (const link of ['https://leetcode.com/problems/two-sum/', '  https://leetcode.com/problems/two-sum/description/ \n https://leetcode.com/problems/3sum/ ', 'see www.codeforces.com/problemset/problem/4/A please']) {
    await input.fill(link)
    await expect(submit).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Find similar problems', exact: true })).toBeDisabled()
    await expect(page.getByText('AlgoLens can’t open links.', { exact: false })).toBeVisible()
  }
  await input.fill('Given an array of n integers and a target, find two indices whose values add up to the target. Source: https://leetcode.com/problems/two-sum/')
  await expect(submit).toBeEnabled()
  await expect(page.getByText('AlgoLens can’t open links.', { exact: false })).toBeHidden()
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

test('local live-analysis cap shows its own safe message', async ({ page }) => {
  await page.route('**/api/v1/analyze', route => route.fulfill({ status: 429, json: { detail: { code: 'local_rate_limit', message: 'server text' } } }))
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(statement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Too many live analyses this minute')
  await expect(page.getByRole('alert')).not.toContainText('server text')
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(statement)
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

const boundedStatement = 'Given an array of n integers, process its elements. 1 <= n <= 200000'
const aggregateStatement = 'There are t test cases, each with an array of n integers.\n1 <= t <= 10000\n1 <= n <= 1000\nThe sum of n over all test cases does not exceed 2000'

test('combined workflow shows actual deterministic bounds beside the unrelated demo', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(boundedStatement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Constraint & Complexity Analysis', exact: true })).toBeVisible()
  await expect(page.getByText('1 <= n <= 200000', { exact: true })).toBeVisible()
  const table = page.getByRole('region', { name: 'Per-instance growth', exact: true })
  const quadratic = table.getByRole('row').filter({ has: page.getByText('O(n^2)', { exact: true }) })
  await expect(quadratic).toContainText('40,000,000,000')
  await expect(quadratic).toContainText('Likely infeasible')
  await expect(page.getByLabel('Mock analysis warning')).toContainText('unrelated to your submission')
  await expect(page.getByRole('button', { name: 'Reveal Hint 1', exact: true })).toBeVisible()
})

test('offline assessment uses only the assess endpoint and explains aggregate growth', async ({ page }, testInfo) => {
  let providerRequests = 0
  await page.route('**/api/v1/analyze', route => { providerRequests += 1; return route.abort() })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(aggregateStatement)
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/assess'))
  await page.getByRole('button', { name: 'Assess constraints only', exact: true }).click()
  const response = await responsePromise
  const data: AlgorithmicAssessment = await response.json()
  expect(response.status()).toBe(200)
  expect(data.source).toBe('deterministic')
  const linear = data.assessments.find(item => item.complexity === 'O(n)' && item.scope === 'all_test_cases')
  const quadratic = data.assessments.find(item => item.complexity === 'O(n^2)' && item.scope === 'all_test_cases')
  expect(linear?.estimated_work).toBe(2000)
  expect(quadratic?.estimated_work).toBe(2000000)
  await expect(page.getByText('Offline Assessment', { exact: true })).toBeVisible()
  await expect(page.getByText('sum(n) <= 2000', { exact: true })).toBeVisible()
  const totals = page.getByRole('region', { name: 'All test cases: conservative bounds', exact: true })
  await expect(totals.getByRole('row').filter({ has: page.getByText('O(n^2)', { exact: true }) })).toContainText('2,000,000')
  await expect(page.getByRole('button', { name: 'Reveal Hint 1', exact: true })).toHaveCount(0)
  expect(providerRequests).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('offline-aggregate.png'), fullPage: true })
})

test('provider failure leaves an explicit offline action available without retry', async ({ page }) => {
  let providerRequests = 0
  await page.route('**/api/v1/analyze', route => {
    providerRequests += 1
    return route.fulfill({ status: 429, json: { detail: { code: 'rate_limit' } } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(boundedStatement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('free-tier capacity')
  await page.getByRole('button', { name: 'Assess constraints only', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Constraint & Complexity Analysis', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(boundedStatement)
  expect(providerRequests).toBe(1)
})

for (const scenario of [
  { name: 'no constraints', input: 'Given an array, solve the task described by the story without numeric limits.' },
  { name: 'value bounds', input: 'Each element a_i is a signed integer. -10^9 <= a_i <= 10^9' },
  { name: 'ambiguous sizes', input: 'Given an array of n integers and another array of m integers. 1 <= n, m <= 1000' },
  { name: 'conflicting bounds', input: 'Given an array of n integers.\nn <= 10\nn >= 20' },
]) {
  test(`offline UI handles ${scenario.name} without fabricated estimates`, async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Problem statement', { exact: true }).fill(scenario.input)
    await page.getByRole('button', { name: 'Assess constraints only', exact: true }).click()
    await expect(page.getByText('Growth assessment unavailable', { exact: true })).toBeVisible()
    await expect(page.getByText('Deterministic uncertainties', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Per-instance growth', exact: true })).toHaveCount(0)
  })
}

test('synthetic AI disagreement is shown without replacing either source', async ({ page }) => {
  await page.route('**/api/v1/analyze', async route => {
    const response = await route.fetch()
    const data: AnalyzeResponse = await response.json()
    await route.fulfill({ json: {
      ...data, analysis_type: 'ai', provider: 'groq', model: 'openai/gpt-oss-120b', demo_notice: null,
      complexity_guidance: [{ complexity: 'O(n^2)', assessment: 'Promising AI fixture', explanation: 'This is a controlled UI fixture, not a live model response.' }],
      deterministic: { ...data.deterministic, discrepancies: ['Potential inconsistency fixture: review the AI suggestion and deterministic growth assumptions.'] },
    } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(boundedStatement)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByLabel('Potential source discrepancies')).toContainText('Potential inconsistency fixture')
  await expect(page.getByText('Promising AI fixture', { exact: true })).toBeVisible()
  await expect(page.getByLabel('AI analysis notice')).toContainText('AI Analysis')
})

const retrievalQuery = 'Find inclusive interval sums for many queries on a fixed signed array.'

test('standalone practice search uses only local retrieval and preserves paste guidance', async ({ page }, testInfo) => {
  let analyses = 0
  await page.route('**/api/v1/analyze', route => { analyses += 1; return route.abort() })
  await page.goto('/')
  await expect(page.locator('#statement-paste-tip')).toContainText('Preserve mathematical expressions')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  const pending = page.waitForResponse(response => response.url().endsWith('/api/v1/similar'))
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  const data = await response.json()
  expect(data.query).toBe(retrievalQuery)
  expect(data.retrieval_method).toBe('tfidf')
  expect(data.reranking).toBe('task_cues')
  const section = page.getByRole('region', { name: 'Similar practice problems', exact: true })
  await expect(section.getByRole('heading', { name: 'Static ledger totals', exact: true })).toBeVisible()
  await expect(section).toContainText('TF-IDF + task cues')
  await expect(section).toContainText('Blended score:')
  await expect(section).toContainText('Shared task cues:')
  await expect(section.getByText('AlgoLens practice example', { exact: false })).toHaveCount(5)
  await expect(section).toContainText('not confidence probabilities')
  await expect(section.getByRole('link')).toHaveCount(0)
  expect(analyses).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('similar-problems.png'), fullPage: true })
  await page.getByLabel('Problem statement', { exact: true }).fill('A different statement to reset results.')
  await expect(section).toHaveCount(0)
})

test('combined recommendations use real input and stay collapsed beside demo hints', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Similar Problems', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Static ledger totals', exact: true })).toBeHidden()
  await page.getByText('Show practice recommendations (5) · includes technique tags', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Static ledger totals', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reveal Hint 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reveal Hint 2', exact: true })).toBeVisible()
})

test('visible semantic fallback never mislabels lexical matches', async ({ page }) => {
  await page.route('**/api/v1/similar', async route => {
    const data = await (await route.fetch()).json()
    await route.fulfill({ json: { ...data, requested_method: 'semantic', warnings: [...data.warnings, 'Semantic model is missing. Using TF-IDF; no download was made.'] } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  const section = page.getByRole('region', { name: 'Similar practice problems', exact: true })
  await expect(section).toContainText('Semantic model is missing. Using TF-IDF')
  await expect(section).toContainText('TF-IDF')
  await expect(section).not.toContainText('Local semantic')
})

test('local search has an explicit empty state', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill('zzzzxyz qqqxyz zzzzxyz qqqxyz')
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  await expect(page.getByText('No practice matches available.', { exact: false })).toBeVisible()
})

test('invalid retrieval data does not destroy a successful analysis or hints', async ({ page }) => {
  await page.route('**/api/v1/analyze', async route => {
    const data = await (await route.fetch()).json()
    data.similar_problems.matches[0].similarity_score = 7
    await route.fulfill({ json: data })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Analyze Problem', exact: true }).click()
  await expect(page.getByText('Practice recommendations could not be validated', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal Hint 1', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('semantic fixture displays honest local method and cosine score', async ({ page }) => {
  await page.route('**/api/v1/similar', async route => {
    const data = await (await route.fetch()).json()
    await route.fulfill({ json: { ...data, requested_method: 'semantic', retrieval_method: 'semantic', reranking: 'none', matches: data.matches.map((item: Record<string, unknown>) => ({ ...item, retrieval_method: 'semantic', similarity_score: 0.82, explanation: 'Fixture: local embedding cosine similarity.' })) } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  const section = page.getByRole('region', { name: 'Similar practice problems', exact: true })
  await expect(section).toContainText('Local semantic')
  await expect(section).toContainText('Cosine score: 0.820')
  await expect(section).not.toContainText('82%')
  await expect(section).not.toContainText('+ task cues')
  await expect(section).not.toContainText('Blended score')
})

test('external curated fixture renders a safe provenance link', async ({ page }) => {
  await page.route('**/api/v1/similar', async route => {
    const data = await (await route.fetch()).json()
    const first = { ...data.matches[0], title: 'Fixture external record', source_type: 'external_curated', source_url: 'https://example.org/fixture-problem', source_name: 'Example fixture archive' }
    await route.fulfill({ json: { ...data, matches: [first, ...data.matches.slice(1)] } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  const section = page.getByRole('region', { name: 'Similar practice problems', exact: true })
  await expect(section).toContainText('External source · Example fixture archive')
  const link = section.getByRole('link', { name: 'Open original problem (external site)' })
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', 'https://example.org/fixture-problem')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(section.getByText('AlgoLens practice example', { exact: false })).toHaveCount(4)
})

for (const [label, url] of [['javascript', 'javascript:alert(1)'], ['plain http', 'http://example.org/x'], ['original with link', null]] as const) {
  test(`unsafe provenance is rejected: ${label}`, async ({ page }) => {
    await page.route('**/api/v1/similar', async route => {
      const data = await (await route.fetch()).json()
      const bad = url === null ? { ...data.matches[0], source_url: 'https://example.org/x' } : { ...data.matches[0], source_type: 'external_curated', source_url: url, source_name: 'Fixture' }
      await route.fulfill({ json: { ...data, matches: [bad, ...data.matches.slice(1)] } })
    })
    await page.goto('/')
    await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
    await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
    await expect(page.getByText('unexpected practice search format', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open original problem (external site)' })).toHaveCount(0)
  })
}

test('unknown reranking value is rejected safely', async ({ page }) => {
  await page.route('**/api/v1/similar', async route => {
    const data = await (await route.fetch()).json()
    await route.fulfill({ json: { ...data, reranking: 'secret_reranker' } })
  })
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  await expect(page.getByText('unexpected practice search format', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Similar practice problems', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Problem statement', { exact: true })).toHaveValue(retrievalQuery)
})

test('out-of-catalog topic shows a clear no-close-match notice', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill('Find the smallest circle radius enclosing all planar points with real coordinates.')
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  const section = page.getByRole('region', { name: 'Similar practice problems', exact: true })
  await expect(section.getByRole('note')).toContainText('No close match in this catalog.')
  await expect(section.getByRole('note')).toContainText('geometry')
  await expect(section.getByText('AlgoLens practice example', { exact: false }).first()).toBeVisible()
})

test('covered topic shows no coverage notice', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Problem statement', { exact: true }).fill(retrievalQuery)
  await page.getByRole('button', { name: 'Find similar problems', exact: true }).click()
  const section = page.getByRole('region', { name: 'Similar practice problems', exact: true })
  await expect(section.getByRole('heading', { name: 'Static ledger totals', exact: true })).toBeVisible()
  await expect(section.getByRole('note')).toHaveCount(0)
})
