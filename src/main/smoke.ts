import { app, BrowserWindow } from 'electron'

// Smoke test: boot the real window, mount the renderer, then drive each panel
// from inside the page. Catches renderer crashes, import errors, and broken
// IPC wiring that a type-check can't see. Prints WP_SMOKE_OK on success.

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (sel) => document.querySelector(sel);
  const setValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
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

  // Thesis pin is docked above the writing area.
  await waitFor('[data-testid="thesis-pin"]', 'thesis pin');

  // Adding a body paragraph grows the outline.
  const beforeNodes = document.querySelectorAll('[data-testid="outline-node"]').length;
  (await waitFor('[data-testid="add-body-paragraph"]', 'add paragraph button')).click();
  await sleep(150);
  const afterNodes = document.querySelectorAll('[data-testid="outline-node"]').length;
  if (afterNodes <= beforeNodes) throw new Error('add body paragraph did not add outline nodes');

  // Next-step coach and deadline back-planner live in the outline.
  await waitFor('[data-testid="next-step"]', 'next-step coach');
  setValue(await waitFor('[data-testid="due-date"]', 'due date input'), '2030-01-01');

  // Focus timer in the toolbar: start, then pause.
  (await waitFor('[data-testid="timer-toggle"]', 'focus timer')).click();
  await sleep(60);
  q('[data-testid="timer-toggle"]').click();

  // Drafting bridge: insert the outline into the document as real headings.
  (await waitFor('[data-testid="insert-outline"]', 'insert outline button')).click();
  await waitFor('.prose h2', 'outline headings inserted into the document');

  // Linking-words menu inserts a phrase at the cursor.
  (await waitFor('[data-testid="linking-words"]', 'linking words menu')).click();
  (await waitFor('[data-testid="transition-phrase"]', 'a transition phrase')).click();

  // Assignment decoder (the default tools tab): decode a prompt into a checklist.
  await waitFor('[data-testid="assignment-panel"]', 'assignment panel');
  const prompt = await waitFor('[data-testid="assignment-prompt"]', 'assignment prompt');
  setValue(prompt, 'Write a 600-word essay. Analyse the theme. Use at least 3 sources in MLA style.');
  (await waitFor('[data-testid="decode-assignment"]', 'decode button')).click();
  await waitFor('[data-testid="requirement-item"]', 'a decoded requirement');

  // Brain dump: a judgement-free scratch space.
  (await waitFor('[data-testid="tab-braindump"]', 'brain dump tab')).click();
  setValue(await waitFor('[data-testid="braindump-text"]', 'brain dump textarea'), 'messy thoughts');

  // Tools panel tabs.
  (await waitFor('[data-testid="tab-clarity"]', 'clarity tab')).click();
  await waitFor('[data-testid="clarity-panel"]', 'clarity panel');

  (await waitFor('[data-testid="tab-citations"]', 'citations tab')).click();
  await waitFor('[data-testid="citations-panel"]', 'citations panel');

  (await waitFor('[data-testid="tab-settings"]', 'settings tab')).click();
  await waitFor('[data-testid="settings-panel"]', 'settings panel');

  // Calm & comprehension: underline academic terms, then spotlight the paragraph.
  (await waitFor('[data-testid="toggle-define"]', 'define-terms toggle')).click();
  await waitFor('.prose .pm-glossary', 'academic terms underlined in the prose');
  (await waitFor('[data-testid="toggle-spotlight"]', 'spotlight toggle')).click();
  await waitFor('.editor-surface.spotlight', 'spotlight mode applied');

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
