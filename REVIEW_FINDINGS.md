# Writability — Cognitive Accessibility, UX & Persona Audit (v2)

**Scope.** This supersedes the earlier generic UX audit on this branch. Brief: judge Writability as what it is — a calm, offline, accessibility-first writing tool for neurodivergent students (autistic students as primary audience) producing correctly formatted academic papers. No `SPEC.md`/`PLAN.md` exist; the README, welcome flow, and in-app copy are the de-facto spec, and the ethos used throughout is: *calm, predictable, literal, one thing at a time; the student is always the author; independence is the goal.*

**Evidence basis.** Source audit of every file cited; the app booted and passed its full UI smoke against the seeded fixtures (`WP_SMOKE_OK`); citation formatter, AI prompts, planner, and timer read line-by-line; spell-scan of a 15k-word doc benchmarked (~4 ms warm — typing latency is not a risk). Fixtures: `fixtures/seed.cjs` (run `ELECTRON_RUN_AS_NODE=1 npx electron fixtures/seed.cjs`, then `WP_DATA_DIR=fixtures/data npm run dev`):

| id | scenario |
|----|----------|
| `fx_apa_rubric` | College argumentative essay, APA, detailed rubric, 5 scholarly sources |
| `fx_vague` | Same course, prompt is only *"Discuss the role of memory in Beloved."* — blank page |
| `fx_hs5` | High-school five-paragraph persuasive essay with teacher rubric |
| `fx_dump` | Messy brain-dump: 25 unsorted cards + chaotic scratch notes, no structure |
| `fx_stale` | Mid-draft abandoned 21 days ago; scratch says "STOPPED AT: rewrite the accountability section" |
| `fx_tonight` | Due 11:59 tonight, 600 of 1500 words done |
| `fx_diss` | 200-reference APA stress fixture |

---

## What's genuinely good — protect this

1. **The copy is the accessibility.** "There is no rush here, and nothing you write is graded." Every panel intro is literal, warm, and explains *why* ("so the reader sees the thread"). Outline prompts are concrete ("One clear sentence is enough"). This register is the product; defend it in review.
2. **The assignment decoder is the right idea executed honestly** (`src/shared/assignment.ts`): command words explained literally with examples ("discuss = look at more than one side, then give a reasoned view"), rubric rows become checkable "Graded on:" items. This is hidden-curriculum translation — the core autistic-student need — done without AI.
3. **AI is coach-bounded by construction** (`src/shared/ai.ts`): brainstorm = short phrases "not a sentence to copy"; outline = "Do not write the content itself"; feedback = questions. Off by default, local key, per-click consent. This is the strongest academic-integrity posture I have seen in a student tool. Freeze these prompts behind the existing selftest.
4. **Sensory design is calm by default and adjustable fast**: 4 AA themes, Irlen tints, spotlight, reading ruler, reduce-motion kill-switch (`themes.css`, `theme.ts`), no sound anywhere, no autoplaying motion, no mascots, no streaks, no notifications. The anti-pattern sweep found **one** class of violation (native dialogs, F-10).
5. **Executive-function scaffolding exists at every stage**: brain dump → board → send-card-to-outline-under-section → insert-outline-as-headings → thesis pin → next-step coach → back-planner ("N steps across D days" — arithmetic, not alarm). The pipeline from chaos to structure is real; `fx_dump` can be worked entirely inside it.
6. **Format-correct export geometry** (MLA heading block/running header, APA title page) verified against rendered PDFs earlier on this branch, with selftest coverage.

## Top 10 (ranked by consequence for the primary users)

| # | ID | Sev | Finding |
|---|----|-----|---------|
| 1 | N-01 | **Major** | The vague prompt — the primary persona's exact scenario — dead-ends: decoder finds "discuss" but produces zero requirements and no bridge to academic writing's unstated expectations |
| 2 | I-01 | **Major** | Every exported citation violates MLA/APA: no italics anywhere (plain-text formatter + plain TextRun export). "Almost right" costs real grades on the app's core promise |
| 3 | F-04 | **Major** | No version history/snapshots; deletes of cards/sources/requirements are permanent. A lost paragraph can end the week |
| 4 | F-07 | **Major** | Quit-time save is an async `beforeunload` race (`App.tsx:33`); last ~700 ms of typing plausibly lost on close |
| 5 | N-02 | **Major** | Nothing interrupts the perfectionism loop; spelling marks are on by default *while drafting*, inviting sentence-polishing on line one |
| 6 | F-10 | **Major** | 8 native `alert()`/`confirm()` dialogs: surprise modals in a different visual language at the most stressful moments |
| 7 | F-09 | **Major** | Read-aloud (flagship a11y feature) has no pause and word-resume is mouse-only |
| 8 | N-12 | **Major** | Re-entry after 3 weeks: no "here's where you were, here's the next small step." The fixture's own "STOPPED AT" note is buried in Brain dump |
| 9 | F-05/F-06 | **Major** | Trust at the edges: export success is silent; save-"error" state offers no retry or rescue |
| 10 | I-04 | **Major** | No scaffolding fade: prompts and templates are identical on paper #1 and paper #30 — the app never steps back as competence grows |

---

## Part 1 — Cognitive accessibility & UX audit

### Cognitive load & focus
- **One next action:** Library → "New paper" is clear; editor's placeholder ("Start writing here. You can begin anywhere") plus the outline's highlighted **Your next step** card answer "what now?" without inference. Pass — protect.
- **N-11 (Minor):** Settings is one undifferentiated ~20-control column (`SettingsPanel.tsx`). The dyslexia preset (protect) rescues first contact, but a sensory-overloaded student scanning for "turn off underlines" reads the whole list. Group into 3–4 collapsed sections with the preset on top.
- **F-13 (Polish):** 7 tools tabs; "Clarity" and "Spelling" are both "review my writing" — conceptual overlap adds a decision.

### Executive function scaffolding
- Task breakdown, visible progress (n/N done), honest back-planning: pass (see protect #5).
- **N-03 (Minor):** Transition seams: research→outline is unassisted (sources live in a tab, the outline never references them — you cannot attach a source to a Point); revise has no stage of its own (see N-02). The board→outline→draft seams are excellent.
- **N-05 (Minor):** Working-memory offload exists (Brain dump tab) but capturing a fleeting thought mid-sentence requires leaving the editor (click Tools → Brain dump → type → click back; 4+ interactions and a context loss). No quick-capture.
- **N-04 (Minor):** Words-remaining and days-remaining both exist but never meet ("~500 words/day would finish this" is computable from existing planner data and would serve time-blindness without pressure).

### Language of the interface
- Register is literal, concrete, mostly why-explaining. High-school fixture copy reads fine for 15 (no condescension found). Two blemishes: **N-10 (Polish):** "Irlen-style" jargon in a settings comment surfaces nowhere user-facing (ok), but "measure in ch" units and "letter spacing 0.01em" leak unit jargon into Settings labels' value readouts; round to plain words ("narrow / wide"). No idioms, no "just/simply" found in a sweep of user-facing strings.

### Predictability & consistency
- Same action/place/result holds throughout; nothing moves spontaneously; autosave chip is honest. **F-10 (Major):** the exceptions are the 8 `alert()`/`confirm()` sites (grep `alert(|confirm(` in `src/renderer`) — OS-styled surprise modals for delete, restore, read-aloud-unavailable, export-failure. Exactly the moments a shutdown-prone student needs the app to stay itself.
- **F-03 (Major):** Undo covers only the editor. Card/source/requirement deletion is permanent with no confirm (cards) or `confirm()` (paper). Repro: Board → × on a card → gone.
- **F-07 (Major):** `beforeunload` fires an async IPC save the window teardown does not await; combined with the 700 ms debounce (`useStore.ts:141`) a fast Alt+F4 after typing can drop text. Needs main-process close interception. (Marked for the manual list — could not empirically race it headless.)

### Sensory design
- Pass overall (protect #4). **F-25 (Major, verify):** print-layout hardcodes a white sheet (`global.css` `:root[data-print-layout='true'] .prose { background:#fff }`) — in calm-dark or high-contrast this is a full-screen luminance blast, the single worst sensory surprise available in the app. Repro: high-contrast theme → Settings → Print layout.
- Density is adjustable (spacing sliders); no flashing anywhere; timer is opt-in and silent.

### Feedback tone & error states
- Clarity panel and AI feedback are specific and kind by design (protect). Spelling popover's "Leave it" is the right non-judgment.
- **The app's worst error message** (as briefed): `alert('Export failed: unknown error')` (`Toolbar.tsx`) — modal, technical, no cause, no next step, at a deadline moment. Runner-up: save chip silently reading "error" (**F-06**) with no retry affordance and no path to rescue the text.
- **F-05 (Major):** export *success* is silent — no filename, no "open it." At 11:59 p.m. the student cannot verify the artifact exists without a file-manager hunt.

### Customization without choice-overload
- Sane defaults + preset: pass. N-11 grouping applies.

### Assistive tech interoperability
- 49 `aria-label`s, ARIA tablist with roving tabindex, `aria-live` save chip, focus-ring tokens: strong.
- **F-09 (Major):** `ReadAloudOverlay.tsx` — no pause/resume (only Start over / Done) and `reader-word` spans are click-only (no tabindex/key handling). The app's own headline feature fails keyboard-only and interruption-tolerance.
- **F-14 (Minor):** `SpellPopover.tsx` never moves focus into itself; keyboard users tab blind to reach suggestions.
- Dictation: no in-app support; OS dictation into the contenteditable should work but is unverified (manual list). TTS on own draft: yes (protect).
- **F-01 (Blocker):** No find (or replace) in-document or across papers. For working-memory-limited users, "scroll and re-read until you spot it" is the single most expensive operation in the app. Repro: `fx_stale`, locate "accountability."

### Trust & data safety
- Autosave + atomic writes + WAL sqlite: good bones. **F-04 (Major):** no per-paper history/snapshots; only whole-library manual backup (`backup.ts`). Nothing visible to recover *to*.

---

## Part 2 — Persona walkthroughs

**P1. Autistic college freshman — `fx_vague` (primary).**
Opens paper → Assignment tab → pastes "Discuss the role of memory in Beloved." → **Break it down for me**.
- Gets: command-word card for *discuss* (excellent, literal, with example). Requirements: none — note reads "No new requirements found. You can add your own below."
- **N-01 (Major):** This is the moment the app exists for, and it shrugs. No bridge from vague prompt → the unstated expectations (you still need an arguable thesis; "discuss" at college means argue with evidence; default length/sources/style are course conventions; *here is a sentence to ask your professor*). The knowledge exists in the app (command words, outline template) but nothing connects them here.
- Thesis writing: outline's thesis prompt + sentence frame ("I will show that ___ because ___") is genuinely good scaffolding once they find it.
- **Perfectionism loop (N-02, Major):** eleventh rewrite of the opening sentence. The app's contribution: wavy spelling underlines live from word one (spellHelp default-on, `types.ts`), Clarity one tab away, no draft-stage concept, no "keep going, fix later" affordance. Nothing worsens the loop, nothing interrupts it. A "drafting mode" that defers marks until revision — plus one coach line ("First drafts are allowed to be rough") — is the ethos-true fix.

**P2. Autistic student — sensory profile.**
Time-to-tolerable from first launch: Welcome (skippable) → Settings → dyslexia preset or theme chip + reduce motion ≈ **40–60 s**. Pass. Nothing resets without consent (settings persist; verified by store round-trip). One landmine: **F-25** (print-layout white blast). One irritant: spell/glossary underlines count as visual noise — off-switches exist but live mid-list (N-11).

**P3. ADHD junior — `fx_tonight`, 8:40 p.m.**
Initiation: opening the app lands directly in the paper (session restore — protect). Next-step card says the concrete next thing. Good.
- Time blindness: due date + word count visible; back-planner says steps across days — but tonight the useful number is words-left-vs-hours-left, which nothing computes (N-04). No countdown pressure anywhere (pass — timer is opt-in).
- Working memory: fleeting thought → 4+ clicks to Brain dump and back (N-05).
- Containment: everything needed is in-app; the only exits are user-chosen. Pass.
- 11:58 p.m. export: works in 4 interactions, then **silence** (F-05) — she exports three times "to be sure." The worst possible moment for ambiguity.

**P4. AuDHD sophomore — conflicting needs.**
Routine shape: default calm-light, fixed layout, identical ritual every session — the app is *made* of routine. Novelty shape: theme switch, board mode, timer are the whole novelty budget. **The design silently picked routine — correctly.** Name it and keep it; resist novelty features (see Do-not-do). Tension honestly handled by making stimulation opt-in (tints, timer). No finding beyond documentation.

**P5. Dyslexic college student.**
UI reading load: short lines, generous defaults — pass. Fonts/spacing/tints/TTS/personal dictionary: pass (protect). Citation help: forms remove ordering/punctuation *recall*, which is the real burden — but see I-01 (italics) and F-08 (no insert-at-cursor: hand-transcribing `(Author, 2019)` from a panel is exactly the fiddly copying this student flubs). Dictation: untested (manual list).

**P6. HS sophomore, 504 plan — `fx_hs5`.**
Five-paragraph shape maps 1:1 to the argument template (thesis, 3 points w/ PEEL, conclusion — counterargument card can be deleted). Teacher rubric ingests into "Graded on:" items (verified with fixture text). Register: speaks *to* them, not down (protect). Friction: the PEEL sub-prompts use "Analysis"/"Link back" — words her rubric doesn't use; a Minor vocabulary seam (N-13) worth a hover-explainer she already has for academic terms elsewhere.

**P7. Returning student — `fx_stale` (21 days, post-burnout).**
Reopens straight into the paper (good), cursor at end (arbitrary). Due date now reads as a past date — planner's `overdueDays` exists in `planner.ts`; the rendered copy tone for overdue is unverified (**manual list — must not shame**).
- **N-12 (Major):** Their own note — "STOPPED AT: rewrite the accountability section" — sits unseen in Brain dump. No "welcome back / here's where you were / one small step" moment; reorientation is unassisted re-reading (~minutes, at shutdown-recovery cost). The app already stores everything needed to greet them well.

---

## Part 3 — The instructor test

Process followed end-to-end on `fx_apa_rubric` (decode → requirements → outline w/ thesis frame → insert outline → draft → clarity/spelling → citations → export APA).

**Rubric grade of the app-guided artifact** (what the process produces, not the fixture prose):

| Criterion | Grade | Notes |
|---|---|---|
| Thesis | A− | Frame + pin + on-thesis nudge produce arguable, visible theses |
| Argument & organization | B+ | PEEL scaffold + transitions menu = sound paragraphs; counterargument is a first-class step (rare, valuable) |
| Evidence & source integration | C+ | The app tracks sources but never touches the *integration* moment: no quote/paraphrase scaffold, no signal-phrase help, no link from a Point to a source. "Drops quotes in" is the predictable outcome |
| Citations | C | Order/punctuation of elements: correct to spec in MLA and APA samples checked. **I-01 (Major):** zero italics — every book title, journal, container ships roman in panel *and* export (`citations.ts` note admits it; `export.ts` renders plain `TextRun`). Under APA/MLA rubrics this is a per-reference error. **I-02 (Minor):** APA sentence-case not enforced/coached; MLA "et al." correct; volume/issue punctuation verified for the branches read — full character-check of every branch belongs in selftest |
| Mechanics | B+ | Gentle spelling + clarity flags are specific and actionable |

**Academic integrity map** — where AI acts (`shared/ai.ts`, `AiHelper.tsx`, `Board.tsx`):
- Brainstorm → idea *phrases* as cards; Outline → structure *prompts* ("what THEY should write"); Feedback → questions. No thesis generation, no prose generation, no rewrite function anywhere. Off by default; per-click consent; local key. **Verdict: legitimate scaffolding; the paper is defensible orally because every sentence is the student's.**
- **I-03 (Minor):** AI-brainstormed cards are indistinguishable from the student's own cards afterward. For a student later asked "which ideas were yours?" — and for honest self-knowledge — label their provenance (a small ✦ suffices).
- **I-05 (Polish):** No visible statement a student could show an instructor ("what this tool does/never does") — an exportable integrity note would protect exactly these students under AI policies.

**Scaffolding fade — I-04 (Major):** There is none. Paper #30 gets the same prompt text, same PEEL sub-steps, same coach as paper #1. Independence-as-goal requires a path to *less*: a "lean template" option, dismissible prompt text, and (eventually) "start from blank" as an earned default. Today the app quietly assumes permanent need.

---

## 5-minute manual test list (traceable in code, not experienceable here)

1. **Quit-race (F-07):** type, Alt+F4 within ~0.7 s, reopen ×5 — any loss?
2. **Overdue tone (N-12/planner):** set due date to yesterday — read every string it renders. Must be factual, never red, never "overdue!".
3. **Print-layout × dark/high-contrast (F-25):** flip it in both — is it a white flash?
4. **OS dictation** into the editor (Win+H / macOS) — punctuation, undo behavior.
5. **Screen-reader pass** (NVDA): tablist, save chip announcements, spelling popover focus, read-aloud overlay.
6. **Word/Docs opens the export:** italics absence (I-01), page-number fields, hanging indents.
7. **Real voices:** read-aloud pause absence in practice; `onboundary` granularity per engine.

## Questions only real users can answer (+ participatory plan)

Automated review cannot know: whether the *decoder's explanations* match the ambiguity students actually feel; whether spotlight/tints help or stigmatize; whether the coach's tone lands as kind or as noise under RSD; whether "Graded on:" items reduce or add anxiety; what the perfectionism loop needs beyond a drafting mode; whether the board is a relief or a second task.

**Plan (lightweight, 6–10 participants):** recruit via campus disability services + neurodivergent student orgs (compensated, remote, own laptops): 3 autistic college students (≥1 with a vague-prompt assignment in hand), 2 ADHD, 1 AuDHD, 1 dyslexic, 1 HS student with a 504. Tasks: (a) bring your real current assignment, get from prompt → thesis; (b) `fx_dump` → an outline you'd defend; (c) reopen `fx_stale` and resume; (d) export and check the citation page against your syllabus style. Observe: time-to-first-word, loop behaviors, settings hunting, points of shutdown; end with "what would you remove?" Two rounds: before and after the backlog's wave 1.

## Findings index

| ID | Sev | One-line | Files |
|----|-----|----------|-------|
| N-01 | Major | Vague prompt dead-ends; no unstated-expectations bridge | `assignment.ts`, `AssignmentPanel.tsx` |
| N-02 | Major | No drafting mode; marks-on-by-default feeds perfectionism | `types.ts` defaults, `tiptapAddons.ts` |
| N-03 | Minor | Sources unattachable to outline points | `OutlinePanel.tsx`, `CitationsPanel.tsx` |
| N-04 | Minor | Words-left never meets days-left | `planner.ts`, `Editor.tsx` footer |
| N-05 | Minor | No quick-capture to Brain dump from editor | `BrainDumpPanel.tsx` |
| N-10 | Polish | Unit jargon in settings readouts | `SettingsPanel.tsx` |
| N-11 | Minor | Settings = one long list | `SettingsPanel.tsx` |
| N-12 | Major | No re-entry "where you were / next small step" | `App.tsx`, `Editor.tsx` |
| N-13 | Minor | PEEL vocab unexplained inline | `outline-templates.ts` |
| F-01 | Blocker | No find/replace anywhere | `Editor.tsx` |
| F-03 | Major | Deletes permanent outside editor | `Board.tsx`, `useStore.ts` |
| F-04 | Major | No snapshots/version history | `backup.ts` (absence) |
| F-05 | Major | Export success silent | `Toolbar.tsx` |
| F-06 | Major | Save-error: no retry/rescue | `useStore.ts`, `Toolbar.tsx` |
| F-07 | Major | Quit-time flush race | `App.tsx:33`, `src/main/index.ts` |
| F-09 | Major | Read-aloud: no pause; mouse-only resume | `ReadAloudOverlay.tsx` |
| F-10 | Major | 8 native alert/confirm modals | grep sites |
| F-14 | Minor | Spell popover doesn't take focus | `SpellPopover.tsx` |
| F-17 | Minor | Format/heading buried in Assignment tab | `AssignmentPanel.tsx` |
| F-25 | Major* | Print-layout white sheet vs dark themes (*verify) | `global.css` |
| I-01 | Major | No italics in citations, panel or export | `citations.ts`, `export.ts` |
| I-02 | Minor | APA sentence-case uncoached; full char-audit → selftest | `citations.ts` |
| I-03 | Minor | AI card provenance unlabeled | `Board.tsx` |
| I-04 | Major | No scaffolding fade | templates/app-wide |
| I-05 | Polish | No exportable integrity statement | — |
