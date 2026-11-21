import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The browser calls /api on the same address it loaded the page from, and Vite
// forwards those calls to the local backend. So a phone on the same Wi-Fi only
// needs the frontend port: the backend stays private on 127.0.0.1 and no
// cross-origin (CORS) setup is involved. ALGOLENS_API_TARGET is a server-side
// Node setting (not VITE_*), so it is never put into the browser bundle.
// Read through globalThis so this file type-checks without adding @types/node.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const apiTarget = env.ALGOLENS_API_TARGET || 'http://127.0.0.1:8000'
const proxy = { '/api': { target: apiTarget, changeOrigin: true } }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
