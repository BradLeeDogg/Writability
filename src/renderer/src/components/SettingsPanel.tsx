import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { AI_MODELS, INTEGRITY_STATEMENT } from '@shared/ai'
import { sortVoices } from '@shared/voices'
import { listVoices, onVoicesChanged, speak } from '../lib/tts'
import type { FontChoice, OverlayTint, ThemeName } from '@shared/types'

const THEMES: { value: ThemeName; label: string }[] = [
  { value: 'calm-light', label: 'Calm light' },
  { value: 'calm-dark', label: 'Calm dark' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'high-contrast', label: 'High contrast' }
]

const FONTS: { value: FontChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'serif', label: 'Serif' },
  { value: 'atkinson', label: 'Atkinson Hyperlegible' },
  { value: 'opendyslexic', label: 'OpenDyslexic' }
]

const OVERLAYS: { value: OverlayTint; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'cream', label: 'Cream' },
  { value: 'rose', label: 'Rose' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' }
]

export function SettingsPanel(): JSX.Element {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const removeCustomWord = useStore((s) => s.removeCustomWord)
  const showToast = useStore((s) => s.showToast)
  const askConfirm = useStore((s) => s.askConfirm)
  const createBackup = useStore((s) => s.createBackup)
  const restoreBackup = useStore((s) => s.restoreBackup)
  const replayWelcome = useStore((s) => s.replayWelcome)
  const currentId = useStore((s) => s.current?.meta.id)
  const openPaperAgain = useStore((s) => s.openPaper)
  const [snaps, setSnaps] = useState<{ file: string; at: string; words: number }[] | null>(null)
  const loadSnaps = async (): Promise<void> => {
    if (currentId) setSnaps(await window.api.listSnapshots(currentId))
  }
  const restoreSnap = async (file: string): Promise<void> => {
    if (!currentId) return
    const ok = await askConfirm({
      title: 'Go back to this version?',
      body: 'Your current version is saved as a snapshot first, so you can return to it.',
      confirmLabel: 'Restore this version'
    })
    if (!ok) return
    await window.api.restoreSnapshot(currentId, file)
    await openPaperAgain(currentId)
    showToast('Version restored. Your previous state was snapshotted too.')
    void loadSnaps()
  }

  // Voices can arrive asynchronously after the page loads.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    const load = (): void => setVoices(sortVoices(listVoices()))
    load()
    return onVoicesChanged(load)
  }, [])

  const previewVoice = (): void => {
    speak('Hello — this is how the reading voice will sound.', {
      rate: settings.ttsRate,
      pitch: settings.ttsPitch,
      voiceURI: settings.ttsVoice
    })
  }

  const onBackup = async (): Promise<void> => {
    const res = await createBackup()
    if (res.ok) {
      showToast(`Saved a backup of ${res.count} paper${res.count === 1 ? '' : 's'}.`)
    } else if (!res.canceled) {
      showToast('Could not save the backup: ' + (res.error ?? 'unknown error'))
    }
  }

  const onRestore = async (): Promise<void> => {
    const ok = await askConfirm({
      title: 'Restore from a backup?',
      body: 'This brings back the papers saved in the file. Any paper you already have with the same id will be replaced by the saved copy.',
      confirmLabel: 'Restore'
    })
    if (!ok) return
    const res = await restoreBackup()
    if (res.ok) {
      showToast(`Brought back ${res.imported} paper${res.imported === 1 ? '' : 's'}.`)
    } else if (!res.canceled) {
      showToast('Could not restore: ' + (res.error ?? 'unknown error'))
    }
  }

  const applyDyslexiaPreset = (): void =>
    update({
      fontFamily: 'opendyslexic',
      fontScale: 1.2,
      lineSpacing: 2,
      letterSpacing: 0.05,
      paragraphSpacing: 1.1,
      overlayTint: 'cream'
    })

  return (
    <div className="settings" data-testid="settings-panel">
      <button className="primary block" onClick={applyDyslexiaPreset}>
        Apply dyslexia-friendly preset
      </button>

      <fieldset className="setting">
        <legend>Theme</legend>
        <div className="chips">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              data-testid={`theme-${t.value}`}
              className={'chip' + (settings.theme === t.value ? ' selected' : '')}
              aria-pressed={settings.theme === t.value}
              onClick={() => update({ theme: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="setting">
        <legend>Reading font</legend>
        <div className="chips">
          {FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={'chip' + (settings.fontFamily === f.value ? ' selected' : '')}
              aria-pressed={settings.fontFamily === f.value}
              onClick={() => update({ fontFamily: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="settings-group" data-testid="group-text">
        <summary>Text size &amp; spacing</summary>
      <Slider
        label="Text size"
        value={settings.fontScale}
        min={0.8}
        max={1.8}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ fontScale: v })}
      />
      <Slider
        label="Line spacing"
        value={settings.lineSpacing}
        min={1.2}
        max={2.4}
        step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => update({ lineSpacing: v })}
      />
      <Slider
        label="Letter spacing"
        value={settings.letterSpacing}
        min={0}
        max={0.12}
        step={0.01}
        format={(v) => `${v.toFixed(2)} em`}
        onChange={(v) => update({ letterSpacing: v })}
      />
      <Slider
        label="Space between paragraphs"
        value={settings.paragraphSpacing}
        min={0}
        max={2}
        step={0.1}
        format={(v) => `${v.toFixed(1)} em`}
        onChange={(v) => update({ paragraphSpacing: v })}
      />
      <Slider
        label="Line width"
        value={settings.maxLineWidth}
        min={48}
        max={100}
        step={1}
        format={(v) => `${v} chars`}
        onChange={(v) => update({ maxLineWidth: v })}
      />
      </details>

      <fieldset className="setting">
        <legend>Colour overlay</legend>
        <div className="chips">
          {OVERLAYS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={'chip' + (settings.overlayTint === o.value ? ' selected' : '')}
              aria-pressed={settings.overlayTint === o.value}
              onClick={() => update({ overlayTint: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="settings-group" data-testid="group-aids">
        <summary>Reading aids</summary>
      <label className="toggle">
        <input
          type="checkbox"
          data-testid="toggle-spotlight"
          checked={settings.spotlightMode}
          onChange={(e) => update({ spotlightMode: e.target.checked })}
        />
        <span>Spotlight the current paragraph (dim the rest)</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          data-testid="toggle-ruler"
          checked={settings.readingRuler}
          onChange={(e) => update({ readingRuler: e.target.checked })}
        />
        <span>Reading ruler (a tinted guide that follows your pointer)</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          data-testid="toggle-print-layout"
          checked={settings.printLayout}
          onChange={(e) => update({ printLayout: e.target.checked })}
        />
        <span>Print layout (see the page double-spaced and indented, as it exports)</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          data-testid="toggle-define"
          checked={settings.defineTerms}
          onChange={(e) => update({ defineTerms: e.target.checked })}
        />
        <span>Underline academic terms (hover to see a meaning)</span>
      </label>
      </details>

      <details className="settings-group" data-testid="group-citing">
        <summary>Citing sources</summary>
        <label className="toggle">
          <input
            type="checkbox"
            data-testid="toggle-paste-cite"
            checked={settings.pasteCitePrompt !== false}
            onChange={(e) => update({ pasteCitePrompt: e.target.checked })}
          />
          <span>After pasting a long passage, offer to add the citation</span>
        </label>
        <p className="hint">
          Citations you insert are kept as objects, not typed brackets — click one in your paper to
          change its page or its source, and they restyle themselves if you change the paper’s
          format.
        </p>
      </details>

      <details className="settings-group" data-testid="group-spelling">
        <summary>Spelling help</summary>
      <label className="toggle">
        <input
          type="checkbox"
          data-testid="toggle-spell"
          checked={settings.spellHelp}
          onChange={(e) => update({ spellHelp: e.target.checked })}
        />
        <span>Gentle spelling help (underline likely misspellings)</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          data-testid="toggle-homophone"
          checked={settings.homophoneHelp}
          onChange={(e) => update({ homophoneHelp: e.target.checked })}
        />
        <span>Mark commonly-confused words (their/there, your/you’re…)</span>
      </label>

      {settings.customWords.length > 0 && (
        <div className="my-words" data-testid="my-words">
          <span className="my-words-label">My words:</span>
          {settings.customWords.map((w) => (
            <button
              key={w}
              className="chip"
              data-testid="my-word"
              onClick={() => removeCustomWord(w)}
              title={`Remove “${w}” from your words`}
            >
              {w} ✕
            </button>
          ))}
        </div>
      )}
      </details>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.reduceMotion}
          onChange={(e) => update({ reduceMotion: e.target.checked })}
        />
        <span>Reduce motion</span>
      </label>

      <fieldset className="setting">
        <legend>Read aloud</legend>
        <p className="muted">
          Pick a voice that feels comfortable to listen to. A lower pitch and a slower speed often
          sound calmer. Press Preview to hear it.
        </p>
        {voices.length > 0 ? (
          <label className="field">
            <span>Voice</span>
            <select
              data-testid="tts-voice"
              value={settings.ttsVoice ?? ''}
              onChange={(e) => update({ ttsVoice: e.target.value || undefined })}
            >
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted small" data-testid="tts-no-voices">
            Your computer has only its built-in voice. You can add more voices (male, female, and
            others) in your operating system’s speech settings.
          </p>
        )}
        <Slider
          label="Speed"
          value={settings.ttsRate}
          min={0.6}
          max={1.4}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(v) => update({ ttsRate: v })}
        />
        <Slider
          label="Pitch"
          value={settings.ttsPitch}
          min={0.6}
          max={1.4}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(v) => update({ ttsPitch: v })}
        />
        <button className="ghost block" data-testid="tts-preview" onClick={previewVoice}>
          ▶ Preview voice
        </button>
      </fieldset>

      <fieldset className="setting">
        <legend>Your work</legend>
        <p className="muted">
          Your papers are saved on this computer. A backup keeps a copy somewhere of your own — a
          USB stick, a cloud folder — that you can restore from later.
        </p>
        <button className="ghost block" data-testid="backup-create" onClick={onBackup}>
          💾 Back up my papers…
        </button>
        <button className="ghost block" data-testid="backup-restore" onClick={onRestore}>
          ↩ Restore from a backup…
        </button>
        <button className="ghost block" onClick={replayWelcome}>
          Show the welcome guide again
        </button>
        {currentId && (
          <details className="history" data-testid="history" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) void loadSnaps() }}>
            <summary>History for this paper…</summary>
            <p className="muted small">
              Writability quietly saves a snapshot each time you open this paper. Restoring never
              loses anything — the current version is snapshotted first.
            </p>
            {snaps === null ? (
              <p className="muted small">Loading…</p>
            ) : snaps.length === 0 ? (
              <p className="muted small">No snapshots yet.</p>
            ) : (
              <ul className="history-list">
                {snaps.map((sn) => (
                  <li key={sn.file} className="history-row">
                    <span>
                      {new Date(sn.at).toLocaleString()} · {sn.words} words
                    </span>
                    <button className="ghost small" data-testid="restore-snapshot" onClick={() => void restoreSnap(sn.file)}>
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}
      </fieldset>

      <fieldset className="setting">
        <legend>AI help (optional)</legend>
        <p className="muted">
          Writability works fully offline. If you’d like optional AI help, paste your own Claude API
          key below. It’s stored only on this computer, and your writing is sent to Anthropic{' '}
          <strong>only when you press an AI button</strong> — never automatically. Leave this blank
          to keep Writability completely offline.
        </p>
        <label className="field">
          <span>Claude API key</span>
          <input
            type="password"
            data-testid="ai-key"
            autoComplete="off"
            placeholder="sk-ant-…"
            value={settings.aiApiKey ?? ''}
            onChange={(e) => update({ aiApiKey: e.target.value })}
          />
        </label>
        <details className="ai-contract" data-testid="ai-contract">
          <summary>What the AI helper will and won’t do</summary>
          <pre className="ai-contract-text">{INTEGRITY_STATEMENT}</pre>
          <button
            className="ghost small"
            onClick={() => {
              void navigator.clipboard.writeText(INTEGRITY_STATEMENT)
              showToast('Statement copied — you can share it with your teacher.')
            }}
          >
            Copy statement
          </button>
        </details>
        <label className="field">
          <span>Model</span>
          <select
            data-testid="ai-model"
            value={settings.aiModel}
            onChange={(e) => update({ aiModel: e.target.value })}
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.note}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          You can get a key from{' '}
          <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          . Usage is billed to your own Anthropic account.
        </p>
      </fieldset>
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps): JSX.Element {
  return (
    <label className="setting slider-setting">
      <span className="slider-head">
        <span>{label}</span>
        <span className="slider-value">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
