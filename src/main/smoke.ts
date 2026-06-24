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

  // First-run welcome guide: focus moves in, Next advances, Escape closes it.
  const welcome = await waitFor('[data-testid="welcome"]', 'welcome guide');
  await sleep(80); // let the focus effect run
  if (!welcome.contains(document.activeElement)) {
    throw new Error('welcome guide did not move focus into the dialog');
  }
  (await waitFor('[data-testid="welcome-next"]', 'welcome next')).click();
  await sleep(60);
  (document.activeElement || welcome).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  const wStart = Date.now();
  while (q('[data-testid="welcome"]') && Date.now() - wStart < 3000) await sleep(50);
  if (q('[data-testid="welcome"]')) throw new Error('welcome guide did not close on Escape');

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

  // Understand: summarise a dense source paragraph.
  (await waitFor('[data-testid="tab-reading"]', 'understand tab')).click();
  setValue(
    await waitFor('[data-testid="reading-input"]', 'reading input'),
    'Climate change is altering rainfall patterns. Many farmers report smaller harvests. Researchers argue that adapting crops could reduce losses.'
  );
  await waitFor('[data-testid="reading-result"]', 'reading result');

  // Tools panel tabs.
  (await waitFor('[data-testid="tab-clarity"]', 'clarity tab')).click();
  await waitFor('[data-testid="clarity-panel"]', 'clarity panel');
  await waitFor('[data-testid="ai-helper-off"]', 'AI helper hidden until a key is set');

  // Arrow keys move between tabs (ARIA tablist keyboard model).
  q('[data-testid="tab-clarity"]').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  await waitFor('[data-testid="citations-panel"]', 'ArrowRight moves to the next tab');

  (await waitFor('[data-testid="tab-citations"]', 'citations tab')).click();
  await waitFor('[data-testid="citations-panel"]', 'citations panel');

  (await waitFor('[data-testid="tab-settings"]', 'settings tab')).click();
  await waitFor('[data-testid="settings-panel"]', 'settings panel');

  // Backup controls are present in Settings.
  await waitFor('[data-testid="backup-create"]', 'backup button');
  await waitFor('[data-testid="backup-restore"]', 'restore button');

  // Read-aloud voice controls (voice picker when available, plus a preview).
  await waitFor('[data-testid="tts-preview"]', 'read-aloud voice preview');

  // Opt-in AI controls render; set a dummy key to reveal the helper (no call is made).
  await waitFor('[data-testid="ai-model"]', 'AI model select');
  setValue(await waitFor('[data-testid="ai-key"]', 'AI key input'), 'sk-ant-smoke-test');

  // Calm & comprehension: underline academic terms, then spotlight the paragraph.
  (await waitFor('[data-testid="toggle-define"]', 'define-terms toggle')).click();
  await waitFor('.prose .pm-glossary', 'academic terms underlined in the prose');
  (await waitFor('[data-testid="toggle-spotlight"]', 'spotlight toggle')).click();
  await waitFor('.editor-surface.spotlight', 'spotlight mode applied');

  // Reading ruler: enable it, then move the pointer over the page to reveal the band.
  (await waitFor('[data-testid="toggle-ruler"]', 'reading-ruler toggle')).click();
  await sleep(80);
  const scroll = await waitFor('.editor-scroll', 'editor scroll area');
  scroll.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 220, clientY: 240 }));
  await waitFor('[data-testid="reading-ruler"]', 'reading ruler follows the pointer');

  // Gentle spelling help: type a misspelling, see it flagged, fix it from the popover.
  const prose = await waitFor('.prose', 'editor prose');
  prose.focus();
  document.execCommand('insertText', false, ' becuase ');
  let flagged = null;
  for (let i = 0; i < 80; i++) {
    flagged = [...document.querySelectorAll('.pm-misspelled')].find((e) => e.textContent === 'becuase');
    if (flagged) break;
    await sleep(80);
  }
  if (!flagged) throw new Error('"becuase" was not flagged as a misspelling');
  flagged.click();
  await waitFor('[data-testid="spell-popover"]', 'spelling popover');
  const because = [...document.querySelectorAll('[data-testid="spell-suggestion"]')].find((b) => b.textContent === 'because');
  if (!because) throw new Error('no "because" suggestion was offered');
  because.click();
  await sleep(150);
  if (q('.prose').textContent.includes('becuase')) throw new Error('misspelling still present after fix');
  if (!q('.prose').textContent.includes('because')) throw new Error('correction was not applied');

  // Add-to-dictionary: teach it a made-up name and the underline goes away.
  prose.focus();
  document.execCommand('insertText', false, ' Zylphard ');
  let name = null;
  for (let i = 0; i < 80; i++) {
    name = [...document.querySelectorAll('.pm-misspelled')].find((e) => e.textContent === 'Zylphard');
    if (name) break;
    await sleep(80);
  }
  if (!name) throw new Error('a made-up word was not flagged');
  name.click();
  await waitFor('[data-testid="spell-popover"]', 'popover for the made-up word');
  (await waitFor('[data-testid="spell-add"]', 'add-to-dictionary button')).click();
  let gone = false;
  for (let i = 0; i < 60; i++) {
    if (![...document.querySelectorAll('.pm-misspelled')].some((e) => e.textContent === 'Zylphard')) { gone = true; break; }
    await sleep(80);
  }
  if (!gone) throw new Error('word still flagged after adding it to the dictionary');
  await waitFor('[data-testid="my-word"]', 'the taught word appears in My words');

  // Toggle a setting to exercise the live theming path.
  const themeBtn = q('[data-testid="theme-calm-dark"]');
  if (themeBtn) themeBtn.click();
  await sleep(100);

  // With a key configured, the opt-in AI helper now appears in the Clarity panel.
  (await waitFor('[data-testid="tab-clarity"]', 'clarity tab (configured)')).click();
  await waitFor('[data-testid="ai-helper"]', 'AI helper appears once a key is set');

  // The coach can be seeded from the student's own work (no retyping, no ghostwriting).
  (await waitFor('[data-testid="coach-chip-assignment"]', 'a coach seed chip')).click();
  await sleep(60);
  const coachBox = q('[data-testid="ai-input"]');
  if (!coachBox || !coachBox.value.trim()) throw new Error('coach seed chip did not fill the input');

  // Visual planning board: toggle in, add a card, sort it into a part of the paper.
  (await waitFor('[data-testid="board-toggle"]', 'board toggle')).click();
  await waitFor('[data-testid="board"]', 'planning board');

  // The brainstorm box can be seeded from the student's own work (no retyping).
  (await waitFor('[data-testid="board-seed-assignment"]', 'board brainstorm seed chip')).click();
  await sleep(50);
  const boardInput = q('[data-testid="board-ai-input"]');
  if (!boardInput || !boardInput.value.trim()) throw new Error('board seed chip did not fill the brainstorm box');

  (await waitFor('[data-testid="add-card"]', 'add card button')).click();
  setValue(await waitFor('[data-testid="board-card"] .card-text', 'a card on the board'), 'a planned idea');

  // Assign the card to a top-level outline section via the picker.
  const sectionSelect = await waitFor('[data-testid="board-card"] .card-section', 'card section picker');
  const realOption = sectionSelect.querySelector('option[value]:not([value=""])');
  if (!realOption) throw new Error('section picker had no outline sections');
  sectionSelect.value = realOption.value;
  sectionSelect.dispatchEvent(new Event('change', { bubbles: true }));

  // "By part" view groups cards into columns; the sorted card lands in one.
  (await waitFor('[data-testid="board-view-toggle"]', 'by-part toggle')).click();
  await waitFor('[data-testid="board-columns"]', 'board columns by part');
  if (!document.querySelector('[data-testid="board-column"]')) throw new Error('no part columns rendered');
  if (!document.querySelector('[data-testid="board-column"] [data-testid="board-card"]')) {
    throw new Error('sorted card did not appear in a column');
  }

  // Drag the card from its column into "Unsorted" (the last column) and verify it moves.
  const grip = await waitFor('[data-testid="card-grip"]', 'card drag grip');
  const cols = [...document.querySelectorAll('[data-testid="board-column"]')];
  const target = cols[cols.length - 1];
  if (target.querySelector('[data-testid="board-card"]')) throw new Error('target column was not empty to start');
  const dt = new DataTransfer();
  grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  await sleep(80);
  if (!target.querySelector('[data-testid="board-card"]')) {
    throw new Error('drag-to-sort did not move the card into the target column');
  }

  (await waitFor('[data-testid="board-toggle"]', 'board toggle back')).click();
  await waitFor('[data-testid="editor"]', 'back to the editor');

  // Immersive "Read to me": opens a reader that highlights each word as it reads.
  (await waitFor('[data-testid="read-aloud"]', 'read-aloud button')).click();
  await waitFor('[data-testid="read-aloud-overlay"]', 'read-aloud overlay');
  await waitFor('[data-testid="reader-page"]', 'reader page');
  if (!document.querySelector('.reader-sentence')) throw new Error('reader rendered no sentences');
  if (!document.querySelector('.reader-word[data-wi]')) throw new Error('reader rendered no words to highlight');
  (await waitFor('[data-testid="reader-close"]', 'reader close button')).click();
  await sleep(120);
  if (document.querySelector('[data-testid="read-aloud-overlay"]')) throw new Error('reader overlay did not close');

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
