# Writability — Full UX & Persona Audit (Review Findings)

**Scope note (read first).** The audit brief referenced `SPEC.md`/`PLAN.md` and Scrivener-class personas (novelist, corkboard, Shunn compile). Neither file exists in this repository, and the app here is **Writability**: a calm, offline, accessibility-first paper writer for students (README is the de-facto spec). I audited the app **against its own ethos** — "calm, low-stimulus, nothing between the student and the page, fully offline, no judgment" — and adapted the personas to its real audience. Where the brief's persona had no Writability equivalent (e.g. Shunn manuscript compile), that is recorded honestly as out of scope rather than invented. Fixtures live in `/fixtures` (see below) and were used for every claim that needed scale.

**Fixtures** (`fixtures/seed.cjs`, run: `ELECTRON_RUN_AS_NODE=1 npx electron fixtures/seed.cjs`, then `WP_DATA_DIR=fixtures/data npm run dev`):
- `fx_long` — 15,000-word thesis paper, 12 sections, 40 sources, rubric-derived requirements in mixed states, 60 board cards.
- `fx_brief` — 400-word news brief, mid-draft, 2 web sources, deadline today.
- `fx_diss` — dissertation-scale research paper, 5 chapters, **200 references**, APA.
- `fx_short` — 350-word reflection, no ceremony.
- `fx_prop` — book-proposal-like argument paper, annotated 8-part TOC, 16 cards pre-sorted into sections, Chicago.

Verified: the app boots and passes its own smoke suite with these fixtures present (`WP_SMOKE_OK`), including the 200-reference paper.

---

## What's genuinely good — protect this

1. **The empty states and microcopy.** "There is no rush here, and nothing you write is graded" is the product. Every panel intro is written to a nervous student, not a power user. Do not let future features add expert-tone copy.
2. **Offline by default, AI strictly opt-in, key encrypted at rest** (`src/main/services/settings.ts`). The trust story is coherent; nothing phones home. Protect the "writing sent only when you press an AI button" contract.
3. **The accessibility stack is real, not performative**: bundled Atkinson/OpenDyslexic (`src/renderer/src/main.tsx`), 4 AA themes + Irlen tints (`themes.css`), spotlight, reading ruler, word-level read-aloud with voice/pitch, gentle spelling with personal dictionary. Nielsen "flexibility" mostly passes because of this.
4. **Format-correct export** (`src/main/services/export.ts`): MLA/APA/Chicago geometry verified against real rendered PDFs (heading block, title page, running headers, hanging indents). This is the app's hard deliverable; regression-test it forever (selftest already covers it).
5. **Self-test discipline**: 28 pure checks + a full UI smoke (`src/main/selftest.ts`, `smoke.ts`). Rare in an app this size; keep the "every feature adds a check" norm.
6. **One clear job per surface**: Outline (plan) / Editor (write) / Board (arrange) / Tools tabs (support). No surface does two things. IA is predictable.

## Top 10 most consequential findings

| # | ID | Sev | Finding |
|---|----|-----|---------|
| 1 | F-01 | **Blocker** | No find (let alone find & replace) anywhere — fatal in a 15k-word document |
| 2 | F-02 | **Major** | No keyboard discoverability: no shortcut cheat sheet, no command palette, stock Electron menu with no app commands |
| 3 | F-03 | **Major** | Destructive actions are permanent + `confirm()`-guarded only: delete paper/card/source/requirement have no undo |
| 4 | F-04 | **Major** | No per-paper snapshots/history; only whole-library manual backup — trust gap for a paper due tomorrow |
| 5 | F-05 | **Major** | Export success is silent (no path, no "open file") — a 5:55 p.m. writer cannot trust it blindly |
| 6 | F-06 | **Major** | Save-state can show "error" with no retry, no explanation, no recovery path |
| 7 | F-07 | **Major** | Quit-time save is a renderer `beforeunload` async IPC — plausibly lossy in the 700 ms debounce window; no main-process `will-quit` flush |
| 8 | F-08 | **Major** | No in-text citation insertion — 200 sources formatted beautifully, but the writer hand-types every `(Author 12)` |
| 9 | F-09 | **Major** (a11y) | Read-aloud has no pause, and click-a-word-to-resume is mouse-only — in the app's own flagship accessibility feature |
| 10 | F-10 | **Major** | 8 `alert()`/`confirm()` native dialogs — jarring, off-theme, and off-ethos ("calm") at exactly the stressful moments |

---

## Part 1 — UX professional audit

### Heuristic sweep (Nielsen)

**Visibility of system status — partial pass.**
- Save state chip (`Toolbar.tsx` `SAVE_LABELS`, `aria-live`) is exactly right. **F-06 (Major):** the `'error'` state renders as text with no affordance. Repro: make `WP_DATA_DIR` read-only, type, watch the chip; nothing tells you what to do. Files: `src/renderer/src/store/useStore.ts` (`save()`), `Toolbar.tsx`.
- **F-05 (Major):** `onExport` only surfaces *failure* (`Toolbar.tsx:34`); success returns a path that is thrown away. Repro: Export → docx → save; no confirmation, no reveal-in-folder.
- Word/page footer (words · ≈pages · words-to-fill) is good status; protect.

**Match with real world — pass.** Command-word decoder, plain-language hints, "Graded on:" items. Best-in-class copy for the audience.

**User control & undo — fails outside the editor.**
- Editor: TipTap history is fine (verified bold/type/undo in smoke-driven runs). "Fix everywhere" (`replaceWordEverywhere`, `useStore.ts`) is one undo step but discards cursor position (Minor).
- **F-03 (Major):** deleting a paper (`Library.tsx:129`), card (`Board.tsx`), source, or requirement is permanent; outline text edits and board moves/section changes have no undo stack at all. The ethos promise "nothing you do here can be ruined" is not kept by the data layer. Repro: delete a card → no recovery.
- **F-04 (Major):** no snapshots. `backup.ts` is all-or-nothing, user-initiated, exports a file. A student who mangles a chapter at 1 a.m. has nothing. Repro: open `fx_long`, delete three sections, close.

**Consistency & standards — partial.**
- **F-02 (Major):** the application menu is Electron's stock template (no code sets a Menu in `src/main/index.ts`). File menu has no Export; there is no shortcut for Focus, Read-aloud, Board, panels, or Export. Ctrl+B/I/Z work only because TipTap/Chromium provide them. macOS users get a menu that lies about the app.
- **F-10 (Major):** native `alert()`/`confirm()` in 8 places (grep `alert(|confirm(` under `src/renderer`). On Windows these are modal system dialogs in a different visual language; under stress (delete, restore, export-fail) the calm app suddenly shouts.

**Error prevention — mixed.** Autosave debounce 700 ms (`useStore.ts:141`) + `beforeunload` flush (`App.tsx:33`). **F-07 (Major):** the flush calls an async IPC save during `beforeunload`; Electron does not wait for it. Close within the debounce window and the last keystrokes are plausibly lost. Needs a main-process `will-quit`/window-close interception that awaits a final save. (Could not fully verify loss empirically headless — on the manual list.)

**Recognition over recall — fails for keyboard users.** **F-02** again: minimalism without a summonable cheat sheet or palette is hidden UI. There is no way inside the app to learn that arrows move tabs, Esc closes the reader, or that TipTap shortcuts exist.

**Flexibility & efficiency — strong for reading, weak for navigating.**
- **F-01 (Blocker):** no Ctrl+F. In `fx_long` (15k words) the only way to reach a passage is scrolling. No project-wide search either (Library has no filter — **F-11, Minor→Major at scale**; repro: seed 30 papers, find one).
- **F-12 (Minor):** Focus mode has no shortcut and Esc does not exit it.

**Aesthetic & minimalist — pass**, with one caveat: the Tools panel is now 7 tabs; "Spelling" and "Clarity" overlap conceptually (both are "review my writing"). Watch tab creep (F-13, Polish).

**Recover from errors — see F-03/F-04/F-06.**

**Help & documentation — the 3-step welcome is good; there is no reference beyond it (ties to F-02).**

### Performance (with fixtures — measured)
- Full-document nspell scan of 15,000 words: **3–4 ms warm** (measured via `ELECTRON_RUN_AS_NODE` benchmark; dictionary build 111 ms, correctly deferred off the critical path in `lib/spell.ts`). Spellcheck-per-keystroke is not a latency risk; decoration rebuild is capped (`MAX_SPELL_DECOS = 300`).
- App boots and smokes clean with `fx_diss` (200 sources) present.
- **Unverified (manual list):** real typing latency in `fx_long` with spotlight+ruler+print-layout all on; Clarity panel's `analyzeClarity` re-run per keystroke on 15k words while the tab is open (`ClarityPanel.tsx` `useMemo` on `doc`); citation list re-render with 200 sources while typing.

### Accessibility
- 49 `aria-label`s, tablist keyboard model, `aria-live` save chip, reduce-motion kill-switch, focus-ring tokens, high-contrast theme: genuinely strong.
- **F-09 (Major):** `ReadAloudOverlay.tsx` — no pause/resume (only Start over/Done), and `reader-word` spans are click-only (`data-wi` spans, no `tabindex`, no key handler). The flagship accessibility feature is not keyboard-accessible or interrupt-tolerant. Repro: open Read to me; try to pause with Space; try to move the highlight without a mouse.
- **F-14 (Minor):** `SpellPopover.tsx` does not move focus into itself on open (focus stays in the document; Esc works, but a keyboard user can't reach the suggestion chips without tabbing blind).
- **F-15 (Minor):** Board free-canvas drag is pointer-only; mitigated because the section `<select>` covers re-filing, but x/y arrangement has no keyboard path (acceptable; document it).

### Platform conventions
- **F-16 (Minor):** window close = quit on all platforms except macOS hide semantics are default-Electron; fine, but no app menu (F-02) means no standard `Cmd+,` for settings, no File→Export.

### Information architecture
- Predictable (see "protect"). One misplacement: **F-17 (Minor):** "Paper details & format" (heading, page numbers) lives inside the **Assignment** tab; students looking to change format after creation will look in Settings or Export first. Repro: ask anyone where to change MLA→APA.

---

## Part 2 — Persona walkthroughs (adapted to Writability's audience)

**P1. Deadline student journalist — `fx_brief` (400-word brief, due 6 p.m.)**
Open app → paper restores via `lastPaperId` (good). Finish draft, clear two requirements, export.
- Count to export: Export ▾ (1) → format (1) → OS save dialog (≥2) = 4–5 interactions, acceptable. **But** F-05: after "Save," silence. At 5:55 p.m. she re-exports twice "to be sure" — observed dead end, no path shown, no open-file.
- F-01 bites even at 400 words: she wants to jump to "superintendent" to fix a name; no find.
- Delight: save chip + word/page footer means she never wonders about state.

**P2. Long-form student writer — `fx_long`**
Reorder mid-revision: outline supports add/edit; board "By part" drag works well (protect). Working requirements from unchecked→checked is satisfying and visible (n/N done).
- Friction: moving actual **document text** between sections is manual cut/paste with no split-view and no find (F-01). Scrolling 15k words to locate Section 8 took ~30s of trackpad in dev run.
- "Fact-check packet" equivalent: none — requirements print nowhere. Exporting the checklist with the paper for a teacher/peer reviewer is a genuine, ethos-compatible gap (**F-18, Minor**).

**P3. Thesis writer (novelist stand-in) — `fx_long` cards**
60 unsorted cards on the free board: drag is smooth; "By part" columns with counts read like a corkboard. Sorting 60 cards via dropdowns is tedious but drag-to-column works.
- **F-19 (Minor):** no multi-select on cards; sorting 60 one-by-one.
- Sending a card to outline under its section works and is quietly excellent (protect).

**P4. Short-piece writer — `fx_short`**
New paper → 4 fields (title/type/format) → write → export: the tool tax is genuinely low; reflection template is 5 gentle steps, ignorable. Passes the minimal-ceremony test. Only F-05 mars the finish.

**P5. Nonfiction proposal author — `fx_prop`**
Annotated TOC via outline works; Chicago export produces a title page + Bibliography (verified rendering earlier in dev).
- **F-20 (Major):** no import of any kind. An author with an existing DOCX chapter retypes or pastes as plain text (paste loses italics into TipTap? bold/italic survive HTML paste; headings partially — unverified, manual list). The brief's "audit what survives" cannot even start; there is no importer.
- **F-21 (Major):** no footnotes — Chicago without notes is a half-promise. The app should either support basic footnotes or say plainly in the format picker that Chicago here = bibliography style only.

**P6. Academic writer — `fx_diss` (200 refs, APA)**
Switching MLA→APA after creation: possible via Assignment→Paper details (F-17 discoverability), reference list relabels correctly.
- Performance with 200 sources: fine (verified boot + smoke; formatting is O(n) string work).
- **F-08 (Major):** no in-text citation insertion; with 200 sources the writer alt-tabs to the panel, memorizes "Author 143," and types `(Author, 2019)` by hand — the single largest friction for this persona.
- **F-22 (Minor):** sources panel has no search/filter at 200 items; find-by-scroll.
- Honesty check: the app never claims to be a reference manager; the Citations panel copy is appropriately modest. Verdict: honest, but F-08 keeps it from being *useful* at dissertation scale.

**P7. The returning writer — `fx_long` after 3 weeks (fixture sets `createdAt` 21 days back)**
Reopens directly to the paper (session restore — good), cursor at end (reasonable). Due date and word goal render as quiet facts, not guilt (no red, no streaks — protect).
- **F-23 (Minor):** nothing says *where you were*: no "last edited" marker in-document, no recent-activity note. Orientation took ~2 min of re-reading; a subtle "you stopped here" highlight would cut it to seconds.
- **F-24 (Polish):** Library shows relative "edited 3 weeks ago" (good) but no sort control; the stale paper sorts by recency anyway.

---

## 5-minute manual test list (things this session could not truly experience)

1. **Typing feel** in `fx_long` with spellcheck + spotlight + ruler + print-layout all enabled — watch for input lag on a low-end Windows laptop.
2. **Quit-loss window (F-07):** type a sentence, quit within ~0.7 s via Cmd/Alt+F4, reopen — is the sentence there? Repeat 5×.
3. **Read-aloud audio** on real Windows/macOS voices: rate/pitch quality, and whether `onboundary` fires per-word for your installed voices (highlighting granularity varies by engine).
4. **Save-error UX:** make the data dir read-only mid-session; observe the chip and whether any writing can be rescued (copy-out).
5. **Paste fidelity from Word:** paste a DOCX chapter with italics/headings/footnotes into the editor; record what survives (informs F-20).
6. **High-contrast + print-layout combo:** print-layout forces a white sheet — verify it doesn't ambush high-contrast/dark users (suspected contrast inversion; `global.css` `:root[data-print-layout='true'] .prose` hardcodes `#ffffff`). **Likely F-25 (Major, a11y) — verify.**
7. **Export files open correctly in real Word** (headers, page numbers as fields, hanging indents) — automated checks only proved bytes render.

---

## Findings index (all, with severity)

| ID | Sev | One-line | Primary files |
|----|-----|----------|---------------|
| F-01 | Blocker | No find/replace in editor; no project search | `Editor.tsx` |
| F-02 | Major | No shortcuts/menu/palette/cheat sheet — undiscoverable minimalism | `src/main/index.ts`, app-wide |
| F-03 | Major | Deletes permanent (paper/card/source/req); no undo outside editor | `Library.tsx`, `Board.tsx`, `useStore.ts` |
| F-04 | Major | No per-paper snapshots/history | `services/backup.ts` (absence) |
| F-05 | Major | Export success silent; no reveal/open | `Toolbar.tsx` |
| F-06 | Major | Save "error" state has no retry/explanation | `useStore.ts`, `Toolbar.tsx` |
| F-07 | Major | Quit-time flush not guaranteed (async beforeunload) | `App.tsx`, `src/main/index.ts` |
| F-08 | Major | No in-text citation insertion | `CitationsPanel.tsx` |
| F-09 | Major | Read-aloud: no pause; word-resume mouse-only | `ReadAloudOverlay.tsx` |
| F-10 | Major | 8 native alert/confirm dialogs | grep sites |
| F-11 | Minor | Library lacks search/sort | `Library.tsx` |
| F-12 | Minor | Focus mode: no shortcut, Esc doesn't exit | `Toolbar.tsx` |
| F-13 | Polish | Tools tab creep (7 tabs; Clarity/Spelling overlap) | `ToolsPanel.tsx` |
| F-14 | Minor | Spell popover doesn't take focus | `SpellPopover.tsx` |
| F-15 | Minor | Free-board x/y arrangement pointer-only (documented tradeoff) | `Board.tsx` |
| F-16 | Minor | Stock Electron menu; no Cmd+, etc. | `src/main/index.ts` |
| F-17 | Minor | Format/heading buried in Assignment tab | `AssignmentPanel.tsx` |
| F-18 | Minor | Requirements checklist not exportable (checker packet) | `services/export.ts` |
| F-19 | Minor | No card multi-select (60-card sort is 60 drags) | `Board.tsx` |
| F-20 | Major | No DOCX/Markdown import | absence |
| F-21 | Major | No footnotes; Chicago half-served | `export.ts`, editor |
| F-22 | Minor | Sources panel: no search at 200 items | `CitationsPanel.tsx` |
| F-23 | Minor | No "you stopped here" reorientation cue | `Editor.tsx` |
| F-24 | Polish | Library: no sort control | `Library.tsx` |
| F-25 | Major? | Print-layout hardcodes white sheet — verify vs dark/high-contrast | `global.css` |

*Evidence basis: source audit of every file named; fixture boot + smoke run (`WP_SMOKE_OK` on fixture data); nspell/scan micro-benchmarks under Electron ABI; export PDFs rendered and inspected earlier in this branch's history (MLA/APA verified page-by-page).*
