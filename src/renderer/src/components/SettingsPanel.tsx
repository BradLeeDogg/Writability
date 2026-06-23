import { useStore } from '../store/useStore'
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
  const createBackup = useStore((s) => s.createBackup)
  const restoreBackup = useStore((s) => s.restoreBackup)
  const replayWelcome = useStore((s) => s.replayWelcome)

  const onBackup = async (): Promise<void> => {
    const res = await createBackup()
    if (res.ok) {
      alert(`Saved a backup of ${res.count} paper${res.count === 1 ? '' : 's'}.`)
    } else if (!res.canceled) {
      alert('Could not save the backup: ' + (res.error ?? 'unknown error'))
    }
  }

  const onRestore = async (): Promise<void> => {
    const ok = confirm(
      'Restore from a backup?\n\nThis brings back the papers saved in the file. ' +
        'Any paper you already have with the same id will be replaced by the saved copy.'
    )
    if (!ok) return
    const res = await restoreBackup()
    if (res.ok) {
      alert(`Brought back ${res.imported} paper${res.imported === 1 ? '' : 's'}.`)
    } else if (!res.canceled) {
      alert('Could not restore: ' + (res.error ?? 'unknown error'))
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
          data-testid="toggle-define"
          checked={settings.defineTerms}
          onChange={(e) => update({ defineTerms: e.target.checked })}
        />
        <span>Underline academic terms (hover to see a meaning)</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.reduceMotion}
          onChange={(e) => update({ reduceMotion: e.target.checked })}
        />
        <span>Reduce motion</span>
      </label>

      <Slider
        label="Read-aloud speed"
        value={settings.ttsRate}
        min={0.6}
        max={1.4}
        step={0.1}
        format={(v) => `${v.toFixed(1)}×`}
        onChange={(v) => update({ ttsRate: v })}
      />

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
