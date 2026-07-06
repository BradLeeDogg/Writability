import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Library } from './components/Library'
import { Toolbar } from './components/Toolbar'
import { OutlinePanel } from './components/OutlinePanel'
import { Editor } from './components/Editor'
import { ToolsPanel } from './components/ToolsPanel'
import { Board } from './components/Board'
import { ReadAloudOverlay } from './components/ReadAloudOverlay'
import { Welcome } from './components/Welcome'
import { Notices } from './components/Notices'

export default function App(): JSX.Element {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const current = useStore((s) => s.current)
  const init = useStore((s) => s.init)
  const save = useStore((s) => s.save)
  const focusMode = useStore((s) => s.settings.focusMode)
  const onboarded = useStore((s) => s.settings.onboarded)
  const outlineOpen = useStore((s) => s.outlineOpen)
  const toolsOpen = useStore((s) => s.toolsOpen)
  const boardOpen = useStore((s) => s.boardOpen)

  useEffect(() => {
    void init()
  }, [init])

  // Quit-safe saving: main intercepts the window close and waits for this
  // flush to finish (see src/main/index.ts). beforeunload stays as a backup.
  useEffect(() => {
    window.api.onFlushRequest(() => {
      void save().finally(() => window.api.flushDone())
    })
    const flush = (): void => {
      void save()
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [save])

  if (!ready) {
    return (
      <div className="splash" role="status" aria-live="polite">
        <span className="brand-mark" aria-hidden="true">
          ✎
        </span>
        <p>Loading Writability…</p>
      </div>
    )
  }

  const showWelcome = !onboarded

  if (view === 'library' || !current) {
    return (
      <div className="app" data-testid="app">
        {showWelcome && <Welcome />}
      <Notices />
        <Library />
      </div>
    )
  }

  return (
    <div className="app" data-testid="app">
      {showWelcome && <Welcome />}
      <Notices />
      <ReadAloudOverlay />
      <Toolbar />
      {boardOpen ? (
        <Board />
      ) : (
        <main className="workspace" data-focus={String(focusMode)}>
          {!focusMode && outlineOpen && <OutlinePanel />}
          <Editor key={current.meta.id} />
          {!focusMode && toolsOpen && <ToolsPanel />}
        </main>
      )}
    </div>
  )
}
