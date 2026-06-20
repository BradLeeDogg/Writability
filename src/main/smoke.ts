import { app, BrowserWindow } from 'electron'

// Smoke test: boot the real window, mount the renderer, then drive each panel
// from inside the page. Catches renderer crashes, import errors, and broken
// IPC wiring that a type-check can't see. Prints WP_SMOKE_OK on success.

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  async function waitFor(sel, label, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = q(sel);
      if (el) return el;
      await sleep(80);
    }
    throw new Error('timed out waiting for ' + (label || sel) + ' (' + sel + ')');
  }

  // Renderer mounted at all?
  await waitFor('#root', 'react root');
  if (!q('#root').children.length) throw new Error('renderer mounted but #root is empty');

  // Library view (no papers yet in the throwaway data dir).
  await waitFor('[data-testid="library"]', 'library view');
  (await waitFor('[data-testid="new-paper"]', 'new paper button')).click();

  // New-paper dialog -> create with defaults.
  (await waitFor('[data-testid="create-paper"]', 'create paper button')).click();

  // Editor view with outline scaffold.
  await waitFor('[data-testid="editor"]', 'editor');
  await waitFor('[data-testid="outline"]', 'outline panel');
  if (!document.querySelector('[data-testid="outline-node"]')) {
    throw new Error('outline rendered no scaffold steps');
  }

  // Tools panel tabs.
  (await waitFor('[data-testid="tab-clarity"]', 'clarity tab')).click();
  await waitFor('[data-testid="clarity-panel"]', 'clarity panel');

  (await waitFor('[data-testid="tab-citations"]', 'citations tab')).click();
  await waitFor('[data-testid="citations-panel"]', 'citations panel');

  (await waitFor('[data-testid="tab-settings"]', 'settings tab')).click();
  await waitFor('[data-testid="settings-panel"]', 'settings panel');

  // Toggle a setting to exercise the live theming path.
  const themeBtn = q('[data-testid="theme-calm-dark"]');
  if (themeBtn) themeBtn.click();
  await sleep(100);

  return 'WP_SMOKE_OK';
})()`

export async function runSmoke(win: BrowserWindow): Promise<void> {
  const fail = (msg: string): void => {
    console.error('WP_SMOKE_FAIL:', msg)
    app.exit(1)
  }

  // Surface renderer errors that would otherwise be swallowed.
  win.webContents.on('render-process-gone', (_e, details) => fail('render process gone: ' + details.reason))
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) console.error('renderer error:', message)
  })

  const guard = setTimeout(() => fail('overall smoke timeout (30s)'), 30000)

  try {
    if (win.webContents.isLoading()) {
      await new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()))
    }
    const result = await win.webContents.executeJavaScript(PROBE, true)
    clearTimeout(guard)
    if (result === 'WP_SMOKE_OK') {
      console.log('WP_SMOKE_OK')
      app.exit(0)
    } else {
      fail('probe returned unexpected value: ' + String(result))
    }
  } catch (err) {
    clearTimeout(guard)
    fail((err as Error)?.message ?? String(err))
  }
}
