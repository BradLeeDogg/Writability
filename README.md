# Writability

**Write + ability.** A calm, accessibility-first desktop app for writing school
and college papers — built first for students **on the autism spectrum** and with
other disabilities (dyslexia, ADHD, dysgraphia, executive-function differences).

Everything runs **offline on your own machine**. No account, no cloud, no
tracking. Your papers are plain files in your Documents folder.

Writability lowers the real barriers to academic writing:

- **Blank-page paralysis** → scaffolded outlines that prompt you step by step.
- **Structure** → essay templates (argument, research, lab, thesis, reflection)
  that walk you through *thesis → point → evidence → analysis → link*.
- **Clarity** → gentle, plain-language checks (no AI, no network): readability,
  long/complex sentences, passive voice, unclear "this/it", repeated words,
  spacing.
- **Sensory overwhelm** → a quiet, predictable interface you control: themes
  (incl. high-contrast), a dyslexia-friendly mode with **OpenDyslexic** and
  adjustable line/letter/paragraph spacing, colour overlays, reduced motion, and
  a distraction-reduced focus mode.
- **Executive function** → every outline step is a checkable task with a live
  progress bar.

Plus **read-aloud** (proofread by ear), **Word / PDF / text export**, and an
**MLA / APA / Chicago** citation helper.

In-text citations are inserted as *objects*, not typed brackets: pick the
source, say which page, choose whether it reads in brackets — "(Smith 42)" — or
in your sentence — "Smith (42) argues that…" — with an optional sentence
starter. A marker restyles itself if the paper's format changes, deletes as one
piece, can be corrected by clicking it (or selecting it and pressing Enter), and
lets the app say which sources are actually cited. Pasting a long passage offers
the citation there and then.

> Feedback in Writability is meant to be gentle, literal, and specific — it says
> *why* something might help, and never uses idioms or ambiguous wording.

## Status

First milestone, v0.1. The core (create/open a paper → accessible editor →
outline scaffold → autosave that persists) plus clarity checks, read-aloud,
export, and citations are implemented and covered by the verify harness below.

## Stack

- **Electron 33** + **electron-vite 2** → `out/main`, `out/preload`, `out/renderer`
- **React 18 + TypeScript 5.7**, **Vite 5**
- **TipTap 2 / ProseMirror** editor
- **Zustand 5** renderer state
- **better-sqlite3 11** — a per-paper SQLite database (native; rebuilt for
  Electron via `electron-builder install-app-deps`)
- **docx** for Word export; PDF via Electron's `printToPDF`; read-aloud via the
  Web Speech API

## Project structure

```
src/
  main/        Electron main (Node). IPC in main/ipc/index.ts; logic in main/services/*
  preload/     Context-isolated bridge: preload/index.ts exposes window.api
  renderer/src React app: components/, store/useStore.ts (Zustand), styles/, lib/
  shared/      Cross-process code: api.ts, types.ts, clarity.ts, citations.ts, …
```

**Storage.** A paper is a folder under `Documents/Writability/Papers/<id>/`
containing `project.db` (SQLite: the prose document, the outline tree, and
citation sources) plus a `paper.json` sidecar used for fast listing. Paths are
centralised in `services/paths.ts`; JSON is written atomically via
`services/atomic.ts`.

**The IPC triad.** Every cross-process feature touches three files in lockstep:
`ipcMain.handle(...)` in `src/main/ipc/index.ts`, a binding in
`src/preload/index.ts`, and a typed signature in `src/shared/api.ts`. Pure
helpers (clarity analysis, citation formatting) live in `src/shared/` and are
imported directly by the renderer.

## Develop

```bash
npm install        # also rebuilds better-sqlite3 for Electron (postinstall)
npm run dev        # launch with hot reload
```

## Verify-before-push harness

All four must pass before every push:

```bash
npm run typecheck                 # 1. types (main + renderer)
npm run build                     # 2. bundle to out/

# 3. main-process assertions → prints SELFTEST_OK
WP_SELFTEST=1 electron out/main/index.js

# 4. boots the window, drives every panel → prints WP_SMOKE_OK
WP_SMOKE=1 electron out/main/index.js
```

On Linux, run the Electron steps headless:

```bash
WP_SELFTEST=1 xvfb-run -a ./node_modules/.bin/electron --no-sandbox out/main/index.js
WP_SMOKE=1    xvfb-run -a ./node_modules/.bin/electron --no-sandbox out/main/index.js
```

## Builds / downloads

Pushing to the dev branch triggers
`.github/workflows/build-windows.yml`, which builds on `windows-latest` and
publishes the installer, portable `.exe`, and `.zip` to the **`win-latest`**
GitHub Release.

Builds are **unsigned**, so Windows SmartScreen will warn the first time —
choose **More info → Run anyway**.

## License

MIT
