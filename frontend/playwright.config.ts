import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

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
    baseURL: 'http://127.0.0.1:5173',
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
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: backendDirectory,
      url: 'http://127.0.0.1:8000/api/v1/health',
      reuseExistingServer: true,
      // Ignore live settings/keys in the developer's environment or root .env.
      env: {
        LLM_PROVIDER: 'fake', GROQ_API_KEY: '',
        GROQ_MODEL: 'openai/gpt-oss-120b', GROQ_MAX_OUTPUT_TOKENS: '3072',
        GROQ_TIMEOUT_SECONDS: '30',
        CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8000' },
    },
  ],
})
