import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
