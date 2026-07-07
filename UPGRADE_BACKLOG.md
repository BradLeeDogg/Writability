# Writability — Upgrade Backlog (v2, cognitive-accessibility audit)

> **Status: all 18 tickets implemented in full** on
> `claude/gracious-wozniak-nm9540`. The six deviations noted in earlier
> revisions were closed in the follow-up commit: Ctrl+K command palette (T2),
> re-entry "Take me there" cursor jump (T6), Ctrl+Shift+C insert-citation
> popover (T9), Shift+←/→ + Enter word-level keyboard resume in read-aloud
> (T10), the ≥3-papers start-leaner nudge with a permanent "don't ask again"
> (T13), and a 20-minute snapshot interval alongside snapshot-on-open (T14).

Implements `REVIEW_FINDINGS.md` (v2). Every ticket: problem → change → acceptance → effort (S ≤ ½ day, M ≤ 2 days, L multi-day) → personas → ethos check (*reduces cognitive load and increases the student's own capability, without noise, pressure, or dependence*). Standing gate for all tickets: typecheck + build + selftest + smoke green, with a new selftest/smoke assertion wherever the change has pure logic or visible UI.

## Cross-cutting themes (plain names)

1. **The app is kind until something goes wrong.** Save-error, export, quit, delete — the edges go silent or go native. Trust work (T1–T5) is the highest-leverage cluster for every persona.
2. **The best help doesn't show up at the moment of need.** The decoder can't help with vagueness (the primary scenario), the "STOPPED AT" note hides during re-entry, sources sit in a tab while paragraphs get written. The knowledge is in the app; the *timing* is wrong (T6, T8, T9).
3. **Drafting and revising are one undifferentiated stage.** Marks-on-by-default plus no stage concept feeds the perfectionism loop (T7).
4. **Scaffolding has no exit.** Identical support on paper #1 and #30 quietly cultivates dependence (T13).
5. **Keyboard users are second-class in the flagship feature.** Read-aloud pause/nav (T10), find (T2).

---

## Wave 1 — Trust & quick wins

### T1 — Quit-safe saving — **S** — F-07 — all personas
**Problem:** `beforeunload` fires an async IPC save that window teardown doesn't await; last ~700 ms of typing can be lost.
**Change:** Main process intercepts window `close`: `e.preventDefault()` → ask renderer to flush (`flush-save` IPC) → on ack or 1 s timeout, `win.destroy()`. Keep `beforeunload` as backup.
**Accept:** Manual quit-race test passes 5/5; selftest covers the flush handler; no double-save corruption (atomic writes already guard).
**Ethos:** invisible; pure trust.

### T2 — In-editor Find (and replace) — **M** — F-01 (Blocker) — all
**Problem:** No way to locate text; scroll-hunting taxes exactly the working memory these students are short on.
**Change:** Ctrl/Cmd+F opens a small inline bar docked above the editor (not a modal): match count ("3 of 7"), Enter/Shift+Enter cycle, Esc closes and returns focus to the text, optional replace field behind a "Replace…" disclosure. Theme-token highlights; plays nice with spelling decorations.
**Accept:** Works in `fx_stale` ("accountability" reachable in ≤3 keystrokes + Enter); smoke drives open→count→cycle→close; reduced-motion = no scroll animation.
**Ethos:** summoned, transient, gone.

### T3 — Export you can verify — **S** — F-05 — ADHD (`fx_tonight`), all
**Problem:** Export success is silent; students re-export "to be sure" at 11:58 p.m.
**Change:** On success, an in-app toast (not a modal): "Saved **essay.docx** — Open · Show in folder" (`shell.openPath` / `showItemInFolder`), auto-dismiss 10 s, focus unaffected. Remember last format per paper.
**Accept:** Toast renders with working actions for docx/pdf/txt; failure path unchanged (until T5); smoke asserts toast on a stubbed success.
**Ethos:** answers one anxious question at the exact moment, then leaves.

### T4 — Save-error becomes a plan, not a state — **S** — F-06 — all
**Problem:** Chip reads "error"; no retry, no explanation, no rescue.
**Change:** Error chip becomes "Not saved — Try again" (button). Tooltip carries the OS error. After 2 consecutive failures, offer "Save a copy as text…" (plain-text dump via save dialog) so words are never trapped. Copy is factual, never alarming; no red beyond existing `--danger` accents.
**Accept:** Simulated EACCES → retry works after permissions restored; rescue file contains full doc text; selftest on the rescue serializer.
**Ethos:** converts the scariest moment into a next small step.

### T5 — Kill the native modals; make deletes undoable — **M** — F-10, F-03 — all (sensory + RSD especially)
**Problem:** 8 `alert()`/`confirm()` OS modals = surprise, style-break, and shame-adjacent tone; card/source/requirement deletes are permanent.
**Change:** One in-app dialog + toast component (theme-aware, focus-trapped, Esc, reduced-motion-aware). Deletes become immediate + 10 s "Deleted — Undo" toast (store holds the tombstone). Paper delete keeps an explicit typed dialog and moves the folder to `trash/` (30-day retention, restore via Library "Recently deleted" disclosure).
**Accept:** `grep -r "alert(\|confirm(" src/renderer` returns nothing; card delete undoable via toast and Ctrl+Z-equivalent action; deleted paper restorable; selftest covers trash/restore round-trip.
**Ethos:** predictability restored; nothing is ever more than one action from recovery.

### T6 — Re-entry: "Here's where you were" — **S/M** — N-12, F-07-adjacent — returning student, ADHD
**Problem:** After 3 weeks the app opens mid-document with no orientation; the student's own "STOPPED AT" note is buried.
**Change:** Persist last cursor position + timestamp in meta on save. When a paper opens after >48 h away, show a single dismissible card at the top of the editor (not a modal): "Welcome back — last worked *3 weeks ago*. Your next step: *{next-step coach output}*." plus "Your note to yourself: *{first line of scratch, if any}*" and a "Take me there" button (jumps to last edit, brief theme-tint highlight, none under reduced motion). Never auto-shows twice for the same absence.
**Accept:** `fx_stale` open → card shows the STOPPED-AT scratch line + next step; dismiss persists; smoke covers the >48 h path with a forced timestamp.
**Ethos:** removes the re-orientation tax; zero guilt language (no "you've been away too long").

## Wave 2 — The moments of need

### T7 — Drafting mode (defer judgment) — **M** — N-02 — primary persona, HS, dyslexic
**Problem:** Spelling/glossary marks are live from word one; nothing interrupts the rewrite-line-one loop; drafting and revising are one stage.
**Change:** A two-state writing stage on the paper (Draft / Polish), one quiet control near the save chip. In **Draft**: spelling/confusable/glossary decorations off, Clarity tab shows "You're drafting — this runs when you switch to Polish", placeholder copy gains one line: "First drafts are allowed to be rough." In **Polish**: current behavior. Default for new papers: Draft. Persisted per paper (`meta.stage`).
**Accept:** Toggling stages flips decorations without reload (plugin metas exist); new-paper default is Draft; smoke asserts marks absent in Draft and present in Polish; copy reviewed against register.
**Ethos:** one control, less noise during creation, judgment only when invited — directly serves "the student is the author."

### T8 — The vague-prompt bridge — **M** — N-01 — **primary persona**
**Problem:** "Discuss the role of memory in Beloved." yields command-word cards but zero requirements and a shrug ("No new requirements found").
**Change:** When decoding finds a command word but produces <2 requirements, render a "What college papers usually expect" block (pure, offline, no AI): 4–6 checkable defaults phrased literally — arguable thesis; reasons backed by evidence from the text; quotes cited in {paper's format}; length/sources "not stated — ask your teacher" items that insert a ready-to-send question ("Could you tell me the expected length and number of sources?") into Brain dump. Each item one sentence + a why. Add-all or add-one.
**Accept:** `fx_vague` decode → block appears; adding items populates requirements; a prompt already rich in explicit requirements never shows the block; selftest: trigger condition + item text; smoke: decode vague fixture → add-all → items checkable.
**Ethos:** translates the hidden curriculum — the app's founding job — without writing a word for them.

### T9 — Cite while writing — **M** — I-01-adjacent, F-08, N-03 — dyslexic, academic, college personas
**Problem:** Sources live in a tab; in-text citations are hand-transcribed; outline points can't reference sources; integration is unscaffolded.
**Change:** (a) "Insert citation" at cursor: palette-free minimal version — a small popover on Ctrl/Cmd+Shift+C listing sources (filter box), Enter inserts the correct in-text form for the paper's style from the existing `inTextAuthor` logic. (b) Each source row gains "Insert in-text". (c) Optional signal-phrase starter chips in the popover ("According to X…", "X argues that…") — text the student completes.
**Accept:** `fx_diss` (200 sources): filter + insert < 5 interactions; inserted forms match style selftest cases; smoke covers popover→insert.
**Ethos:** removes fiddly transcription (the dyslexic burden) at the moment of writing; the sentence around the citation stays theirs.

### T10 — Read-aloud: pause + keyboard — **S/M** — F-09 — dyslexic, all a11y
**Problem:** Flagship feature can't pause and word-resume is mouse-only.
**Change:** Space toggles pause/resume (SpeechSynthesis pause/resume, cancel+`speakFrom` fallback for engines that ignore pause); ←/→ move a sentence; roving `tabindex` on words so Enter resumes from focus; visible bar buttons Pause/Resume mirror the keys.
**Accept:** Keyboard-only run: open → pause → arrow → resume from word; smoke asserts paused state class; reduced-motion honored on scroll-into-view.
**Ethos:** interruption-tolerance is an autistic/ADHD need, not a luxury.

### T11 — Quick capture — **S** — N-05 — ADHD, AuDHD
**Problem:** A fleeting thought costs 4+ interactions and a context switch to bank.
**Change:** Ctrl/Cmd+J opens a one-line capture field floating over the editor; Enter appends timestamped line to Brain dump and closes; Esc cancels; focus returns to the exact prior selection.
**Accept:** Capture round-trip ≤ 3 keystrokes + text; scratch gains the line; cursor restored; smoke covers it.
**Ethos:** working-memory offload with zero navigation.

### T12 — Citations render true (italics) — **M** — I-01 — instructor test, every college persona
**Problem:** Every reference ships without italics in panel and export — a per-reference APA/MLA error on the app's core promise.
**Change:** `formatCitation` returns structured segments (`{text, italic}`[]) alongside the plain string (keep string API for txt/clipboard). Citations panel renders `<em>`; docx export maps to `TextRun({italics})`; PDF HTML maps to `<i>`. Sentence-case coaching for APA titles = one hint line in the source form, not enforcement.
**Accept:** Selftest asserts segment italics for book title (MLA/APA/Chicago), container/journal names; exported docx inspected in the existing export selftest for an italic run; character-level fixture strings for one source per type per style pinned in selftest.
**Ethos:** correctness the student can trust — the whole point of format help.

## Wave 3 — Structural

### T13 — Scaffolding fade ("lean mode") — **M/L** — I-04 — all, independence goal
**Problem:** Support never recedes; paper #30 = paper #1.
**Change:** (a) Per-paper "Show writing prompts" toggle: off hides outline prompt paragraphs and PEEL sub-labels, leaving bare structure. (b) New-paper dialog gains "Blank structure" template alongside the five types. (c) After the student has completed ≥3 papers of a type, the dialog quietly defaults its suggestion to leaner ("You've done this before — start leaner?" — dismissible, never repeated if declined). No metrics UI, no levels, no praise-inflation.
**Accept:** Toggle hides prompts without data loss; blank template creates headings-only outline; the ≥3 nudge fires once and respects decline forever (setting); selftest on the nudge predicate.
**Ethos:** the definition of the goal — support that removes itself.

### T14 — Version history (snapshots) — **L** — F-04, F-03 — all
**Problem:** No visible recovery; a mangled chapter is unrecoverable; whole-library backup is manual and coarse.
**Change:** Auto-snapshot paper content on open and every 20 min of active editing (keep last 20, pruned, compressed JSON under the paper dir). "History…" (palette/menu + Settings) lists snapshots with relative time + word delta; Restore first snapshots current state, then swaps. No diff view in v1.
**Accept:** Selftest: snapshot/restore/prune round-trip; restoring never loses the pre-restore state; UI list keyboard-navigable.
**Ethos:** converts "nothing you write can be ruined" from tone into mechanism.

### T15 — Settings grouped, preset first — **S** — N-11, N-10 — sensory persona
**Change:** Group into collapsed sections (Comfort presets / Reading & fonts / Colour & light / Focus & sound / Spelling & help / AI & data), preset button pinned top; readouts in plain words where units leak ("Line width: comfortable (68)").
**Accept:** All controls reachable in ≤2 clicks; nothing re-ordered within groups thereafter (predictability); smoke updated selectors.

### T16 — Print-layout theme safety — **S** — F-25 — sensory persona
**Change:** Verify manual test; if confirmed, dark/high-contrast get a dark "sheet" with AA text (tokens, not hardcoded #fff), or the toggle explains "Print layout uses a light page" *before* flipping.
**Accept:** All 4 themes × print-layout AA; no full-screen luminance jump without consent.

### T17 — AI provenance + integrity note — **S** — I-03, I-05 — college personas
**Change:** Cards created from AI brainstorm get a small persistent ✦ and "AI suggestion" title; Settings AI section gains "What the AI helper will and won't do" (the existing NO_GHOSTWRITING contract in student words) with "Copy statement" for sharing with an instructor.
**Accept:** ✦ survives reload (persisted flag on Card); statement copy matches prompts' actual constraints; selftest pins the statement to the prompt constants so they can't drift apart.
**Ethos:** the student can always answer "which ideas were mine?" — authorship stays legible.

### T18 — Overdue tone audit — **S** — N-12-adjacent — returning, ADHD
**Change:** Render overdue due-dates as fact ("was due 12 Jun") with the planner switching to "next small step" framing; zero red, zero exclamation. Add the copy to selftest as pinned strings.
**Accept:** `fx_stale` (past due) shows factual copy; grep finds no "overdue!"/warning styling on date paths.

**Suggested order:** T1 → T4 → T3 → T5 → T2 → T6 → T7 → T8 → T10 → T11 → T12 → T9 → T15 → T16 → T17 → T18 → T13 → T14.

---

## Do not do

- **Streaks, badges, daily goals, writing "flames."** Tempting (retention!); guilt UI curdles motivation for exactly this audience — the quiet footer is the right amount.
- **Countdown timers on deadlines.** Tempting (time-blindness!); pressure ≠ visibility. T-numbers as facts (words/day), never ticking clocks.
- **AI drafting, sentence rewriting, or thesis generation.** Tempting (it demos great); it's ghostwriting — it endangers students under AI policies and steals the skill the app exists to build. The prompt constants are a contract; T17 makes it visible.
- **A grammar checker in the margins.** Adjacent to Clarity; persistent judgment on the page violates draft-stage calm. Review stays opt-in, in the panel (and behind T7's Polish stage).
- **Gamified onboarding tours, mascots, celebratory confetti.** Infantilizing; the register is the product.
- **Notification/reminder system.** Nagging externalizes shame; the planner already answers "what now?" when the student arrives.
- **A settings marketplace of themes/fonts.** Choice overload; curated few + preset beats infinite knobs.
- **Cloud accounts / sync by default.** The offline-private story is the trust story; if ever, opt-in and file-based.
- **Tabs / multi-paper windows.** Splits attention; the Library round-trip is cheap and singular focus is the design.
- **"Reading level" scores or grades on the student's own prose.** Numbers read as verdicts under RSD; Clarity's specific, sentence-anchored notes are the honest alternative.
