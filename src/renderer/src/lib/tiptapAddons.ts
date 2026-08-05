// Two small, read-only TipTap/ProseMirror enhancements that power the
// "Calm & comprehension" features. Each keeps an on/off flag in its own plugin
// state, toggled from the Editor with a transaction meta — so flipping a
// setting just dispatches an empty transaction and the decorations recompute.
// Neither ever changes the document, so they never trigger a save.

import { Extension, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { GLOSSARY, glossaryMap } from '@shared/glossary'
import { confusableFor, looksLikeWord, normalizeWord } from '@shared/spelling'
import { isMisspelled, spellReady } from './spell'

// --- Spotlight: dim everything but the paragraph holding the cursor ---------
export const spotlightKey = new PluginKey<boolean>('spotlight')

export const Spotlight = Extension.create({
  name: 'spotlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: spotlightKey,
        state: {
          init: () => false,
          apply(tr, value) {
            const meta = tr.getMeta(spotlightKey)
            return typeof meta === 'boolean' ? meta : value
          }
        },
        props: {
          decorations(state) {
            if (!spotlightKey.getState(state)) return null
            const { $head } = state.selection
            if ($head.depth < 1) return null
            const pos = $head.before(1)
            const node = state.doc.nodeAt(pos)
            if (!node) return null
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, { class: 'pm-spotlight' })
            ])
          }
        }
      })
    ]
  }
})

// --- Glossary: underline known academic terms with a hover definition -------
export const glossaryKey = new PluginKey<boolean>('glossary')

const GLOSSARY_DEFS = glossaryMap()
const GLOSSARY_RE = new RegExp(
  '\\b(' +
    [...GLOSSARY]
      .sort((a, b) => b.term.length - a.term.length)
      .map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')\\b',
  'gi'
)
const MAX_GLOSSARY_DECOS = 200

export const Glossary = Extension.create({
  name: 'glossary',
  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: glossaryKey,
        state: {
          init: () => false,
          apply(tr, value) {
            const meta = tr.getMeta(glossaryKey)
            return typeof meta === 'boolean' ? meta : value
          }
        },
        props: {
          decorations(state) {
            if (!glossaryKey.getState(state)) return null
            const decos: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              if (decos.length >= MAX_GLOSSARY_DECOS) return false
              const text = node.text
              GLOSSARY_RE.lastIndex = 0
              let m: RegExpExecArray | null
              while ((m = GLOSSARY_RE.exec(text)) && decos.length < MAX_GLOSSARY_DECOS) {
                const def = GLOSSARY_DEFS.get(m[0].toLowerCase())
                if (!def) continue
                const from = pos + m.index
                decos.push(
                  Decoration.inline(from, from + m[0].length, {
                    class: 'pm-glossary',
                    title: def
                  })
                )
              }
              return undefined
            })
            return DecorationSet.create(state.doc, decos)
          }
        }
      })
    ]
  }
})

// --- Spellcheck: gentle underlines for likely misspellings ------------------
// Offline (nspell). Optionally also marks commonly-confused words. Clicking a
// mark is handled by the Editor (it reads this plugin's state to find the word
// and its range). Never edits the document itself.
export interface SpellState {
  enabled: boolean
  homophones: boolean
  ignored: Set<string>
  version: number
}
export const spellcheckKey = new PluginKey<SpellState>('spellcheck')

const WORD_RE = /[A-Za-z][A-Za-z'’]*/g
const MAX_SPELL_DECOS = 300

function buildSpellDecorations(doc: PMNode, st: SpellState): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (decos.length >= MAX_SPELL_DECOS) return false
    const text = node.text
    WORD_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WORD_RE.exec(text)) && decos.length < MAX_SPELL_DECOS) {
      const w = m[0]
      if (!looksLikeWord(w)) continue
      const lower = normalizeWord(w).toLowerCase()
      if (st.ignored.has(lower)) continue
      const from = pos + m.index
      const to = from + w.length
      if (isMisspelled(w)) {
        decos.push(Decoration.inline(from, to, { class: 'pm-misspelled' }, { word: w }))
      } else if (st.homophones && confusableFor(w)) {
        decos.push(Decoration.inline(from, to, { class: 'pm-confusable' }, { word: w }))
      }
    }
    return undefined
  })
  return DecorationSet.create(doc, decos)
}

// Recompute only when the document or the relevant flags change (not on mere
// selection moves), so typing stays smooth even on long papers.
let spellCache: { doc: PMNode | null; key: string; set: DecorationSet } = {
  doc: null,
  key: '',
  set: DecorationSet.empty
}

export const Spellcheck = Extension.create({
  name: 'spellcheck',
  addProseMirrorPlugins() {
    return [
      new Plugin<SpellState>({
        key: spellcheckKey,
        state: {
          init: () => ({ enabled: false, homophones: false, ignored: new Set<string>(), version: 0 }),
          apply(tr, value) {
            const meta = tr.getMeta(spellcheckKey) as
              | (Partial<SpellState> & { ignore?: string; bump?: boolean })
              | undefined
            if (!meta) return value
            let next = value
            if (typeof meta.enabled === 'boolean') next = { ...next, enabled: meta.enabled }
            if (typeof meta.homophones === 'boolean') next = { ...next, homophones: meta.homophones }
            if (meta.ignore) {
              const ignored = new Set(next.ignored)
              ignored.add(meta.ignore.toLowerCase())
              next = { ...next, ignored, version: next.version + 1 }
            }
            // A bump just forces a re-scan (e.g. the personal dictionary changed).
            if (meta.bump) next = { ...next, version: next.version + 1 }
            return next
          }
        },
        props: {
          decorations(state) {
            const st = spellcheckKey.getState(state)
            if (!st || !st.enabled || !spellReady()) return DecorationSet.empty
            const key = `${st.homophones}:${st.version}:${spellReady()}`
            if (spellCache.doc === state.doc && spellCache.key === key) return spellCache.set
            const set = buildSpellDecorations(state.doc, st)
            spellCache = { doc: state.doc, key, set }
            return set
          }
        }
      })
    ]
  }
})

// --- Find: highlight matches of the find-bar query --------------------------
export interface FindState {
  query: string
  active: number
}
export const findKey = new PluginKey<FindState>('find')

/** All case-insensitive matches of `query` in the doc's text nodes. */
export function findMatches(doc: PMNode, query: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  const q = query.toLowerCase()
  if (!q) return out
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let i = text.indexOf(q)
    while (i !== -1 && out.length < 500) {
      out.push({ from: pos + i, to: pos + i + q.length })
      i = text.indexOf(q, i + q.length)
    }
  })
  return out
}

let findCache: { doc: PMNode | null; key: string; set: DecorationSet } = {
  doc: null,
  key: '',
  set: DecorationSet.empty
}

export const Find = Extension.create({
  name: 'find',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => ({ query: '', active: 0 }),
          apply(tr, value) {
            const meta = tr.getMeta(findKey) as Partial<FindState> | undefined
            return meta ? { ...value, ...meta } : value
          }
        },
        props: {
          decorations(state) {
            const st = findKey.getState(state)
            if (!st || !st.query) return DecorationSet.empty
            const key = `${st.query}:${st.active}`
            if (findCache.doc === state.doc && findCache.key === key) return findCache.set
            const decos = findMatches(state.doc, st.query).map((m, i) =>
              Decoration.inline(m.from, m.to, { class: 'pm-find' + (i === st.active ? ' active' : '') })
            )
            const set = DecorationSet.create(state.doc, decos)
            findCache = { doc: state.doc, key, set }
            return set
          }
        }
      })
    ]
  }
})

// --- Footnote: an inline, atomic note marker ---------------------------------
// Numbering is visual (CSS counters) and computed at export time, so notes
// renumber themselves automatically when moved or deleted.
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      text: { default: '' }
    }
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }]
  },
  renderHTML({ node }) {
    return ['sup', { 'data-footnote': node.attrs.text as string, class: 'fn-ref', title: node.attrs.text as string }]
  }
})

// --- Citation: an inline, atomic in-text citation marker ---------------------
// The marker is an *object*, not typed characters: it remembers which source it
// points at and which page, and its text is re-rendered from the paper's current
// style. That means switching MLA -> APA updates every marker, one backspace
// removes a whole marker rather than half of one, and the app can answer "which
// sources have I actually cited?".
export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      sourceId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-citation') ?? '',
        renderHTML: (attrs) => ({ 'data-citation': attrs.sourceId as string })
      },
      page: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-page') ?? '',
        renderHTML: (attrs) => ({ 'data-page': attrs.page as string })
      },
      form: {
        default: 'parenthetical',
        parseHTML: (el) => el.getAttribute('data-form') ?? 'parenthetical',
        renderHTML: (attrs) => ({ 'data-form': attrs.form as string })
      },
      label: {
        default: '',
        parseHTML: (el) => el.textContent ?? '',
        renderHTML: () => ({})
      }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-citation]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    const label = (node.attrs.label as string) || ''
    return [
      'span',
      {
        ...HTMLAttributes,
        class: 'cite-ref',
        title: 'Citation — click it (or select it and press Enter) to change the page or the source',
        'aria-label': `Citation: ${label}`
      },
      label
    ]
  }
})

/** Recompute every citation's label from the live sources; returns the updated
 *  doc, or null when nothing changed (so we never dispatch a pointless edit). */
export function relabelCitations(
  doc: PMNode,
  render: (attrs: { sourceId: string; page: string; form: string }) => string | null
): { pos: number; label: string }[] {
  const updates: { pos: number; label: string }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'citation') return
    const next = render({
      sourceId: (node.attrs.sourceId as string) ?? '',
      page: (node.attrs.page as string) ?? '',
      form: (node.attrs.form as string) ?? 'parenthetical'
    })
    // A missing source keeps its last-known label rather than vanishing.
    if (next !== null && next !== node.attrs.label) updates.push({ pos, label: next })
  })
  return updates
}
