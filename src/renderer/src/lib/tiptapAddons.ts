// Two small, read-only TipTap/ProseMirror enhancements that power the
// "Calm & comprehension" features. Each keeps an on/off flag in its own plugin
// state, toggled from the Editor with a transaction meta — so flipping a
// setting just dispatches an empty transaction and the decorations recompute.
// Neither ever changes the document, so they never trigger a save.

import { Extension } from '@tiptap/core'
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
            const meta = tr.getMeta(spellcheckKey) as Partial<SpellState> & { ignore?: string }
            if (!meta) return value
            let next = value
            if (typeof meta.enabled === 'boolean') next = { ...next, enabled: meta.enabled }
            if (typeof meta.homophones === 'boolean') next = { ...next, homophones: meta.homophones }
            if (meta.ignore) {
              const ignored = new Set(next.ignored)
              ignored.add(meta.ignore.toLowerCase())
              next = { ...next, ignored, version: next.version + 1 }
            }
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
