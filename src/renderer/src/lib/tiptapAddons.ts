// Two small, read-only TipTap/ProseMirror enhancements that power the
// "Calm & comprehension" features. Each keeps an on/off flag in its own plugin
// state, toggled from the Editor with a transaction meta — so flipping a
// setting just dispatches an empty transaction and the decorations recompute.
// Neither ever changes the document, so they never trigger a save.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { GLOSSARY, glossaryMap } from '@shared/glossary'

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
