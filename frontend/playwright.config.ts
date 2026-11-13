import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const frontendPort = Number(process.env.ALGOLENS_TEST_FRONTEND_PORT || 5173)
const backendPort = Number(process.env.ALGOLENS_TEST_BACKEND_PORT || 8000)
if (![frontendPort, backendPort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535)) throw new Error('Invalid browser test ports')
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const backendUrl = `http://127.0.0.1:${backendPort}`

const backendDirectory = fileURLToPath(new URL('../backend', import.meta.url))
const python = fileURLToPath(new URL(
  process.platform === 'win32' ? '../backend/.venv/Scripts/python.exe' : '../backend/.venv/bin/python',
  import.meta.url,
))

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: frontendUrl,
    channel: 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'] } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  // Own both processes so a passing browser test proves the complete workflow.
  // Existing servers are deliberately not reused, avoiding tests of stale code.
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port ${backendPort}`,
      cwd: backendDirectory,
      url: `${backendUrl}/api/v1/health`,
      reuseExistingServer: false,
      // Ignore live settings/keys in the developer's environment or root .env.
      env: {
        LLM_PROVIDER: 'fake', GROQ_API_KEY: '',
        GROQ_MODEL: 'openai/gpt-oss-120b', GROQ_MAX_OUTPUT_TOKENS: '3072',
        GROQ_TIMEOUT_SECONDS: '30',
        RETRIEVAL_METHOD: 'tfidf', RETRIEVAL_TOP_K: '5', RETRIEVAL_RERANK: 'cues',
        EMBEDDING_MODEL: 'sentence-transformers/all-MiniLM-L6-v2',
        CORS_ORIGINS: `http://localhost:${frontendPort},${frontendUrl}`,
      },
    },
    {
      command: `npm run dev -- --port ${frontendPort}`,
      url: frontendUrl,
      reuseExistingServer: false,
      env: { VITE_API_BASE_URL: backendUrl },
    },
  ],
})
