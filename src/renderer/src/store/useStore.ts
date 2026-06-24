import { create } from 'zustand'
import { applySettings } from '../lib/theme'
import { decodeAssignment } from '@shared/assignment'
import { splitIntoItems } from '@shared/ai'
import { uid } from '@shared/ids'
import { insertNoteUnder, makeBodyParagraph, nextBodyParagraphNumber } from '@shared/outline-templates'
import { mergeCustomWord } from '@shared/spelling'
import type { AiRunInput, AiRunResult, BackupResult, ExportResult, RestoreResult } from '@shared/api'
import { CARD_COLORS, DEFAULT_SETTINGS } from '@shared/types'
import type {
  AppSettings,
  Card,
  CardColor,
  CitationSource,
  EssayType,
  ExportFormat,
  OutlineNode,
  Paper,
  PaperSummary,
  RequirementItem
} from '@shared/types'

type View = 'library' | 'editor'
type ToolsTab = 'assignment' | 'braindump' | 'reading' | 'clarity' | 'citations' | 'settings'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface StoreState {
  ready: boolean
  view: View
  settings: AppSettings
  papers: PaperSummary[]
  current: Paper | null
  dirty: boolean
  saveState: SaveState

  outlineOpen: boolean
  toolsOpen: boolean
  toolsTab: ToolsTab
  /** When true, the main area shows the visual planning board instead of the editor. */
  boardOpen: boolean
  /** When true, the immersive "Read to me" overlay is open. */
  readAloudOpen: boolean

  // lifecycle
  init: () => Promise<void>
  refreshPapers: () => Promise<void>

  // settings
  updateSettings: (patch: Partial<AppSettings>) => void
  addCustomWord: (word: string) => void
  removeCustomWord: (word: string) => void

  // papers
  createPaper: (input: { title: string; essayType: EssayType }) => Promise<void>
  openPaper: (id: string) => Promise<void>
  closePaper: () => Promise<void>
  deletePaper: (id: string) => Promise<void>

  // editing
  setDoc: (doc: unknown) => void
  setTitle: (title: string) => void
  setScratch: (text: string) => void
  setDueDate: (date: string) => void
  setOutlineText: (id: string, text: string) => void
  toggleOutlineDone: (id: string) => void
  addBodyParagraph: () => void
  addOutlineNote: (text: string) => void
  removeOutlineNode: (id: string) => void

  // planning board (cards)
  addCard: (text?: string) => void
  addCardsFromText: (text: string) => void
  updateCardText: (id: string, text: string) => void
  updateCardSection: (id: string, section: string | undefined) => void
  cycleCardColor: (id: string) => void
  moveCard: (id: string, x: number, y: number) => void
  removeCard: (id: string) => void
  sendCardToOutline: (id: string) => void
  addSource: (source: CitationSource) => void
  updateSource: (id: string, patch: Partial<CitationSource>) => void
  removeSource: (id: string) => void

  // assignment
  setAssignmentPrompt: (prompt: string) => void
  /** Decode the prompt and merge in any new requirements. Returns how many were added. */
  decodeAssignment: () => number
  addRequirement: (text: string) => void
  toggleRequirement: (id: string) => void
  removeRequirement: (id: string) => void

  // saving
  save: () => Promise<void>

  // ui
  toggleOutline: () => void
  toggleTools: () => void
  setToolsTab: (tab: ToolsTab) => void
  toggleFocus: () => void
  toggleBoard: () => void
  openReadAloud: () => void
  closeReadAloud: () => void

  // export
  exportCurrent: (format: ExportFormat) => Promise<ExportResult>

  // backup
  createBackup: () => Promise<BackupResult>
  restoreBackup: () => Promise<RestoreResult>

  // onboarding
  dismissWelcome: () => void
  replayWelcome: () => void

  // ai (opt-in)
  runAi: (input: AiRunInput) => Promise<AiRunResult>
}

// --- debounce timers (module scope so they survive re-renders) -------------
let saveTimer: ReturnType<typeof setTimeout> | null = null
let settingsTimer: ReturnType<typeof setTimeout> | null = null

function mapNode(nodes: OutlineNode[], id: string, fn: (n: OutlineNode) => OutlineNode): OutlineNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n)
    if (n.children.length) return { ...n, children: mapNode(n.children, id, fn) }
    return n
  })
}

export const useStore = create<StoreState>()((set, get) => {
  const scheduleSave = (): void => {
    set({ dirty: true, saveState: 'idle' })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().save()
    }, 700)
  }

  const persistSettings = (): void => {
    if (settingsTimer) clearTimeout(settingsTimer)
    settingsTimer = setTimeout(() => {
      void window.api.saveSettings(get().settings)
    }, 250)
  }

  const patchContent = (patch: Partial<Paper['content']>): void => {
    const cur = get().current
    if (!cur) return
    set({ current: { ...cur, content: { ...cur.content, ...patch } } })
    scheduleSave()
  }

  return {
    ready: false,
    view: 'library',
    settings: DEFAULT_SETTINGS,
    papers: [],
    current: null,
    dirty: false,
    saveState: 'idle',
    outlineOpen: true,
    toolsOpen: true,
    toolsTab: 'assignment',
    boardOpen: false,
    readAloudOpen: false,

    async init() {
      const [settings, papers] = await Promise.all([window.api.getSettings(), window.api.listPapers()])
      applySettings(settings)
      set({ settings, papers, ready: true })
      // Restore the last paper if it still exists.
      if (settings.lastPaperId && papers.some((p) => p.id === settings.lastPaperId)) {
        await get().openPaper(settings.lastPaperId)
      }
    },

    async refreshPapers() {
      set({ papers: await window.api.listPapers() })
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch }
      applySettings(settings)
      set({ settings })
      persistSettings()
    },

    addCustomWord(word) {
      const next = mergeCustomWord(get().settings.customWords, word)
      if (next !== get().settings.customWords) get().updateSettings({ customWords: next })
    },

    removeCustomWord(word) {
      const lower = word.toLowerCase()
      get().updateSettings({
        customWords: get().settings.customWords.filter((w) => w.toLowerCase() !== lower)
      })
    },

    async createPaper(input) {
      const paper = await window.api.createPaper(input)
      set({ current: paper, view: 'editor', dirty: false, saveState: 'saved' })
      get().updateSettings({ lastPaperId: paper.meta.id })
      await get().refreshPapers()
    },

    async openPaper(id) {
      const paper = await window.api.openPaper(id)
      if (!paper) {
        await get().refreshPapers()
        return
      }
      set({ current: paper, view: 'editor', dirty: false, saveState: 'saved' })
      get().updateSettings({ lastPaperId: id })
    },

    async closePaper() {
      if (get().dirty) await get().save()
      set({ current: null, view: 'library' })
      await get().refreshPapers()
    },

    async deletePaper(id) {
      await window.api.deletePaper(id)
      const cur = get().current
      if (cur?.meta.id === id) set({ current: null, view: 'library' })
      await get().refreshPapers()
    },

    setDoc(doc) {
      patchContent({ doc })
    },

    setTitle(title) {
      const cur = get().current
      if (!cur) return
      set({ current: { ...cur, meta: { ...cur.meta, title } } })
      scheduleSave()
    },

    setScratch(text) {
      patchContent({ scratch: text })
    },

    setDueDate(date) {
      const cur = get().current
      if (!cur) return
      set({ current: { ...cur, meta: { ...cur.meta, dueDate: date || undefined } } })
      scheduleSave()
    },

    setOutlineText(id, text) {
      const cur = get().current
      if (!cur) return
      patchContent({ outline: mapNode(cur.content.outline, id, (n) => ({ ...n, text })) })
    },

    toggleOutlineDone(id) {
      const cur = get().current
      if (!cur) return
      patchContent({ outline: mapNode(cur.content.outline, id, (n) => ({ ...n, done: !n.done })) })
    },

    addBodyParagraph() {
      const cur = get().current
      if (!cur) return
      const outline = cur.content.outline
      const para = makeBodyParagraph(nextBodyParagraphNumber(outline))
      // Slot it in before a trailing Conclusion, if there is one.
      const idx = outline.findIndex((n) => n.kind === 'section' && /conclusion/i.test(n.label))
      const next =
        idx >= 0 ? [...outline.slice(0, idx), para, ...outline.slice(idx)] : [...outline, para]
      patchContent({ outline: next })
    },

    addOutlineNote(text) {
      const cur = get().current
      const trimmed = text.trim()
      if (!cur || !trimmed) return
      patchContent({ outline: insertNoteUnder(cur.content.outline, undefined, trimmed) })
    },

    removeOutlineNode(id) {
      const cur = get().current
      if (!cur) return
      const prune = (list: OutlineNode[]): OutlineNode[] =>
        list.filter((n) => n.id !== id).map((n) => ({ ...n, children: prune(n.children) }))
      patchContent({ outline: prune(cur.content.outline) })
    },

    // --- planning board (cards) ----------------------------------------
    addCard(text = '') {
      const cur = get().current
      if (!cur) return
      const n = cur.content.cards.length
      const card: Card = {
        id: uid('card'),
        text,
        x: 28 + (n % 6) * 26,
        y: 28 + (n % 6) * 26,
        color: CARD_COLORS[n % CARD_COLORS.length]
      }
      patchContent({ cards: [...cur.content.cards, card] })
    },

    addCardsFromText(text) {
      const cur = get().current
      if (!cur) return
      const items = splitIntoItems(text)
      if (items.length === 0) return
      const base = cur.content.cards.length
      const newCards: Card[] = items.map((t, i) => ({
        id: uid('card'),
        text: t,
        x: 24 + (i % 4) * 184,
        y: 24 + Math.floor(i / 4) * 150 + (base > 0 ? 12 : 0),
        color: CARD_COLORS[(base + i) % CARD_COLORS.length]
      }))
      patchContent({ cards: [...cur.content.cards, ...newCards] })
    },

    updateCardText(id, text) {
      const cur = get().current
      if (!cur) return
      patchContent({ cards: cur.content.cards.map((c) => (c.id === id ? { ...c, text } : c)) })
    },

    updateCardSection(id, section) {
      const cur = get().current
      if (!cur) return
      patchContent({
        cards: cur.content.cards.map((c) => (c.id === id ? { ...c, section } : c))
      })
    },

    cycleCardColor(id) {
      const cur = get().current
      if (!cur) return
      patchContent({
        cards: cur.content.cards.map((c) => {
          if (c.id !== id) return c
          const next = CARD_COLORS[(CARD_COLORS.indexOf(c.color) + 1) % CARD_COLORS.length]
          return { ...c, color: next as CardColor }
        })
      })
    },

    moveCard(id, x, y) {
      const cur = get().current
      if (!cur) return
      patchContent({
        cards: cur.content.cards.map((c) => (c.id === id ? { ...c, x, y } : c))
      })
    },

    removeCard(id) {
      const cur = get().current
      if (!cur) return
      patchContent({ cards: cur.content.cards.filter((c) => c.id !== id) })
    },

    sendCardToOutline(id) {
      const cur = get().current
      if (!cur) return
      const card = cur.content.cards.find((c) => c.id === id)
      const trimmed = card?.text.trim()
      if (!card || !trimmed) return
      // Land the idea under the part of the paper it was sorted into (if any).
      patchContent({ outline: insertNoteUnder(cur.content.outline, card.section, trimmed) })
    },

    addSource(source) {
      const cur = get().current
      if (!cur) return
      patchContent({ sources: [...cur.content.sources, source] })
    },

    updateSource(id, patch) {
      const cur = get().current
      if (!cur) return
      patchContent({
        sources: cur.content.sources.map((s) => (s.id === id ? { ...s, ...patch } : s))
      })
    },

    removeSource(id) {
      const cur = get().current
      if (!cur) return
      patchContent({ sources: cur.content.sources.filter((s) => s.id !== id) })
    },

    setAssignmentPrompt(prompt) {
      const cur = get().current
      if (!cur) return
      patchContent({ assignment: { ...cur.content.assignment, prompt } })
    },

    decodeAssignment() {
      const cur = get().current
      if (!cur) return 0
      const { requirements } = decodeAssignment(cur.content.assignment.prompt)
      const existing = cur.content.assignment.requirements
      const have = new Set(existing.map((r) => r.text.toLowerCase()))
      const additions: RequirementItem[] = requirements
        .filter((text) => !have.has(text.toLowerCase()))
        .map((text) => ({ id: uid('req'), text, done: false, source: 'auto' as const }))
      if (additions.length === 0) return 0
      patchContent({
        assignment: { ...cur.content.assignment, requirements: [...existing, ...additions] }
      })
      return additions.length
    },

    addRequirement(text) {
      const cur = get().current
      const trimmed = text.trim()
      if (!cur || !trimmed) return
      const item: RequirementItem = { id: uid('req'), text: trimmed, done: false, source: 'manual' }
      patchContent({
        assignment: {
          ...cur.content.assignment,
          requirements: [...cur.content.assignment.requirements, item]
        }
      })
    },

    toggleRequirement(id) {
      const cur = get().current
      if (!cur) return
      patchContent({
        assignment: {
          ...cur.content.assignment,
          requirements: cur.content.assignment.requirements.map((r) =>
            r.id === id ? { ...r, done: !r.done } : r
          )
        }
      })
    },

    removeRequirement(id) {
      const cur = get().current
      if (!cur) return
      patchContent({
        assignment: {
          ...cur.content.assignment,
          requirements: cur.content.assignment.requirements.filter((r) => r.id !== id)
        }
      })
    },

    async save() {
      const cur = get().current
      if (!cur) return
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      set({ saveState: 'saving' })
      try {
        const res = await window.api.savePaper({ meta: cur.meta, content: cur.content })
        // Reflect the server timestamp without clobbering newer edits.
        set((state) => ({
          dirty: false,
          saveState: 'saved',
          current: state.current
            ? { ...state.current, meta: { ...state.current.meta, updatedAt: res.updatedAt } }
            : state.current
        }))
      } catch {
        set({ saveState: 'error' })
      }
    },

    toggleOutline() {
      set((s) => ({ outlineOpen: !s.outlineOpen }))
    },

    toggleTools() {
      set((s) => ({ toolsOpen: !s.toolsOpen }))
    },

    setToolsTab(tab) {
      set({ toolsTab: tab, toolsOpen: true })
    },

    toggleFocus() {
      get().updateSettings({ focusMode: !get().settings.focusMode })
    },

    toggleBoard() {
      set((s) => ({ boardOpen: !s.boardOpen }))
    },

    openReadAloud() {
      set({ readAloudOpen: true })
    },

    closeReadAloud() {
      set({ readAloudOpen: false })
    },

    async exportCurrent(format) {
      const cur = get().current
      if (!cur) return { ok: false, error: 'No paper open' }
      if (get().dirty) await get().save()
      return window.api.exportPaper({ id: cur.meta.id, format })
    },

    async createBackup() {
      // Flush any pending edits so the backup is fully up to date.
      if (get().dirty) await get().save()
      return window.api.createBackup()
    },

    async restoreBackup() {
      const res = await window.api.restoreBackup()
      if (res.ok && (res.imported ?? 0) > 0) {
        // A restore can change papers and settings underneath us — reload both
        // and return to the library so nothing stale stays on screen.
        const [settings, papers] = await Promise.all([
          window.api.getSettings(),
          window.api.listPapers()
        ])
        applySettings(settings)
        set({ settings, papers, current: null, view: 'library' })
      }
      return res
    },

    dismissWelcome() {
      get().updateSettings({ onboarded: true })
    },

    replayWelcome() {
      get().updateSettings({ onboarded: false })
    },

    async runAi(input) {
      return window.api.runAi(input)
    }
  }
})
