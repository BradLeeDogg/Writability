import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Bundled, offline-friendly accessible fonts.
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/opendyslexic/latin-400.css'
import '@fontsource/opendyslexic/latin-700.css'

import './styles/themes.css'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
