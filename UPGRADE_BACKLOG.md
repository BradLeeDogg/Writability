# Writability — Upgrade Backlog

Implementable tickets from `REVIEW_FINDINGS.md`. Each passes the ethos test: *removes friction without adding noise between the student and the page.* Ordered impact×effort (quick wins first). Effort: S ≤ half day, M ≤ 2 days, L = multi-day. Gate for every ticket: typecheck + build + selftest + smoke green, with a new selftest/smoke assertion where logic is pure/UI-visible.

## Cross-cutting themes
1. **Trust at the edges** — writing feels safe until save-error/quit/delete/export, where the app goes silent or native (F-03..07, F-10).
2. **Undiscoverable minimalism** — the chrome is admirably small but there is no way to learn the app from inside it (F-01, F-02, F-12).
3. **Sources are stored, not used** — citations panel is a display case; the writing moment never touches it (F-08, F-22).
4. **Accessibility flagship, keyboard steerage** — read-aloud/board favor pointer users (F-09, F-15).

---

### T1 — In-editor Find & Replace — **S/M** — F-01 — all personas
**Problem:** No way to locate text in a 15k-word paper.
**Change:** TipTap search extension (or a ~100-line ProseMirror plugin): Ctrl/Cmd+F opens a small inline bar above the editor (not a modal); Enter/Shift+Enter cycle, Esc closes, optional replace field; matches highlighted with theme tokens.
**Accept:** Ctrl+F finds/cycles/replaces in `fx_long`; works with spellcheck decorations active; smoke asserts open→match-count→close. Ethos: transient, summoned, disappears.

### T2 — Quit-safe saving — **S** — F-07 — all
**Problem:** Async `beforeunload` flush can lose the 700 ms debounce window.
**Change:** In main, intercept `close` on the window: send `flush-save` over IPC, await renderer ack (with 1s timeout), then destroy. Keep `beforeunload` as belt-and-braces.
**Accept:** Manual test #2 in findings passes 5/5; selftest covers the IPC handler.

### T3 — Export you can trust — **S** — F-05 — deadline persona esp.
**Change:** On success, show an in-app toast: "Saved to *filename* — **Open** · **Show in folder**" (uses `shell.openPath`/`showItemInFolder`). Remember last-used format per paper.
**Accept:** Export docx → toast with working buttons; failure keeps current error path but in-app (see T5). Smoke: export happy-path is currently untested — add IPC-level check.

### T4 — Save-error recovery — **S** — F-06
**Change:** When `saveState==='error'`, chip becomes "Not saved — Retry"; click retries; tooltip carries the error message; after 2 failures offer "Save a copy…" (plain-text dump via dialog) so words are never trapped.
**Accept:** Simulated write failure shows Retry; retry after permissions restored → "Saved."

### T5 — Calm dialogs + undoable deletes — **M** — F-03, F-10
**Change:** Replace all 8 `alert()`/`confirm()` with one in-app dialog/toast component (theme-aware, focus-trapped, Esc). Deletes (card/source/requirement) become immediate with a 10s "Deleted — Undo" toast instead of confirm; paper delete keeps a typed-confirm dialog but moves the paper to a `trash/` dir retained 30 days.
**Accept:** grep shows zero `alert(`/`confirm(`; card delete undoable; deleted paper restorable from trash dir; selftest for trash/restore.

### T6 — Command palette + cheat sheet — **M** — F-02, F-12, F-16
**Change:** Ctrl/Cmd+K palette listing every command (export, read aloud, focus, print layout, panels, tabs, new paper) with fuzzy match; `?` (or Ctrl+/) opens a one-screen shortcut sheet; register a real application Menu with the same commands + accelerators (gets macOS Cmd+, App menu for free); Esc exits focus mode.
**Accept:** Every toolbar action reachable via palette and menu; sheet lists all; smoke drives palette→"Read aloud."
**Ethos:** zero persistent chrome; discoverability on demand. This is the iA-Writer/Ulysses convention worth borrowing.

### T7 — Read-aloud: pause + keyboard — **S** — F-09 — core audience
**Change:** Space toggles pause/resume (SpeechSynthesis pause/resume with cancel-fallback for engines that ignore it); ←/→ jump a sentence (re-`speakFrom`); word spans get `tabindex=-1` roving focus so Enter resumes from focused word.
**Accept:** Keyboard-only session can pause, move, resume; smoke asserts Space sets paused state.

### T8 — Insert citation at cursor — **M** — F-08, F-22 — academic/feature personas
**Change:** In Citations panel, each source gets "Insert ⌘" inserting the correct in-text form for the paper's style — MLA `(Author 12)`, APA `(Author, 2019)`, Chicago superscript-style fallback `(Author 2019)` — at the cursor; add a filter box over sources (name/title/year); palette (T6) exposes "Insert citation…" with the same search.
**Accept:** With `fx_diss`, filter "143" → insert → correct APA parenthetical at cursor; pure formatter unit-tested per style in selftest.

### T9 — Per-paper snapshots — **L** — F-04, F-03 — all
**Change:** Automatic snapshot of `content` on paper open and every 20 min of active editing (keep last 20, pruned); sidecar `snapshots/` per paper (compressed JSON). "History…" in palette/menu opens a list with relative times + word deltas; restore = new snapshot of current, then swap; no diff viewer in v1.
**Accept:** Edit `fx_long`, restore a snapshot, current state itself recoverable; selftest round-trips snapshot/restore/prune.
**Ethos:** invisible until summoned; converts the app's core promise ("nothing can be ruined") from copy to fact.

### T10 — Where-was-I marker — **S** — F-23 — returning writer
**Change:** Persist last selection position in meta on save; on open, place cursor there and give the containing paragraph a 2s fading tint ("You stopped here"). Respect reduce-motion (no animation, just tint).
**Accept:** Reopen `fx_long` → cursor mid-document at last edit; marker gone after interaction.

### T11 — Library search + sort — **S** — F-11, F-24
**Change:** A single quiet input above the paper list filtering by title/type; sort toggle (recent / A–Z). No new chrome elsewhere.
**Accept:** 30-paper fixture filters as-you-type; keyboard reachable.

### T12 — Print-layout theme safety — **S** — F-25
**Change:** Verify manual test #6; if confirmed, express the print sheet with theme-aware tokens in dark/high-contrast (dark "paper" with correct contrast) or auto-suspend print-layout in high-contrast with a notice.
**Accept:** All 4 themes × print-layout meet AA; smoke checks attribute combo renders.

### T13 — Requirements/"fact-check" export — **S/M** — F-18 — feature/deadline personas
**Change:** Export menu gains "Checklist (.txt/.docx appendix)": requirements with done-state, sources list, word/page counts — a one-page packet a teacher or checker can actually use.
**Accept:** `fx_long` produces packet listing 4 requirements w/ states + 40 sources; selftest on the pure builder.

### T14 — DOCX import (honest) — **L** — F-20 — nonfiction/academic
**Change:** "Import…" accepting .docx/.md via mammoth→HTML→TipTap; after import show a plain fidelity report: what was kept (headings, bold/italic, lists), what was dropped (footnotes, images, tables) — never silently.
**Accept:** Golden docx fixture imports; report lists dropped footnotes; selftest against fixture.

### T15 — Footnotes (basic) — **L** — F-21 — academic/nonfiction
**Change:** TipTap footnote mark + panel-less flow (insert via palette/shortcut); export renders real footnotes in docx and numbered notes in PDF; Chicago picker copy updated meanwhile (S sub-task, ship first) to say "bibliography style; footnotes coming."
**Accept:** Note survives export to docx as a Word footnote; PDF renders superscript + notes.

### T16 — Format/heading discoverability — **S** — F-17
**Change:** Keep the editor in Assignment tab, but add "Change format…" to Export menu + palette, deep-linking to it; New-paper dialog already covers creation.
**Accept:** Palette "format" → panel opens with details expanded.

**Suggested order:** T2, T4, T3, T5 (trust core) → T1, T6, T7 (discoverability/keyboard) → T8, T10, T11, T12, T13, T16 → T9 → T14, T15.

---

## Do not do

- **A formatting toolbar/ribbon expansion** — tempting for "discoverability," but T6 solves that without permanent chrome; the page stays bare.
- **Tabs for multiple open papers** — power-user pull; splits attention, breeds clutter; the Library round-trip is one keystroke away once T6 lands.
- **Grammar checking / style linting in the margin** — adjacent to Clarity, but persistent judgments on the page violate "no judgment"; keep review opt-in, in the panel.
- **Streaks, badges, daily-goal flames** — motivation theater curdles into guilt UI for exactly this audience; the quiet word/page footer is the right amount.
- **Cloud sync / accounts by default** — the offline-private story is the moat; if ever, opt-in file-based sync only.
- **AI autocomplete in the editor** — the coach-not-ghostwriter line is the product's integrity; inline generation crosses it irreversibly.
- **A real reference manager (Zotero-lite)** — 200-source display + insert (T8) is the honest scope; import/dedupe/DOI-lookup is a different product.
- **Word-processor page view as default** — print-layout is rightly a toggle; WYSIWYG-by-default trades reading comfort (the app's point) for simulation.
- **Notification/reminder system for due dates** — the planner already back-plans; push guilt is off-ethos.
