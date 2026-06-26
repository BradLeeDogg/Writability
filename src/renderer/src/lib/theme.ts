import type { AppSettings } from '@shared/types'

// Apply settings to the document root. Colors/fonts are driven by data-*
// attributes (see themes.css); spacing is driven by CSS custom properties.
// Programmatic CSSOM writes like these are not blocked by the page CSP.
export function applySettings(s: AppSettings): void {
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.dataset.font = s.fontFamily
  root.dataset.overlay = s.overlayTint
  root.dataset.focus = String(s.focusMode)
  root.dataset.reduceMotion = String(s.reduceMotion)
  root.dataset.printLayout = String(s.printLayout)

  root.style.setProperty('--font-scale', String(s.fontScale))
  root.style.setProperty('--line-spacing', String(s.lineSpacing))
  root.style.setProperty('--letter-spacing', `${s.letterSpacing}em`)
  root.style.setProperty('--para-spacing', `${s.paragraphSpacing}em`)
  root.style.setProperty('--max-line-width', `${s.maxLineWidth}ch`)
}
