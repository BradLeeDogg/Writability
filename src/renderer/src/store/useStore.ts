import { create } from 'zustand'
import { applySettings } from '../lib/theme'
import { decodeAssignment } from '@shared/assignment'
import { uid } from '@shared/ids'
import { makeBodyParagraph, nextBodyParagraphNumber } from '@shared/outline-templates'
import type { ExportResult } from '@shared/api'
import { DEFAULT_SETTINGS } from '@shared/types'
import type {
  AppSettings,
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

  // lifecycle
  init: () => Promise<void>
  refreshPapers: () => Promise<void>

  // settings
  updateSettings: (patch: Partial<AppSettings>) => void

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
  removeOutlineNode: (id: string) => void
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

  // export
  exportCurrent: (format: ExportFormat) => Promise<ExportResult>
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

    removeOutlineNode(id) {
      const cur = get().current
      if (!cur) return
      const prune = (list: OutlineNode[]): OutlineNode[] =>
        list.filter((n) => n.id !== id).map((n) => ({ ...n, children: prune(n.children) }))
      patchContent({ outline: prune(cur.content.outline) })
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

    async exportCurrent(format) {
      const cur = get().current
      if (!cur) return { ok: false, error: 'No paper open' }
      if (get().dirty) await get().save()
      return window.api.exportPaper({ id: cur.meta.id, format })
    }
  }
})
