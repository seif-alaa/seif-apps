import { audio } from '../audio/audio';
import { app, go } from '../lib/app';
import { settings, type Settings } from '../lib/settings';
import { useStore } from '../lib/store';
import { IconClose, IconMute, IconVolume } from '../ui/icons';

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => {
        onChange(!checked);
        audio.ui();
      }}
    />
  );
}

export function SettingsOverlay() {
  const s = useStore(settings, (x) => x);
  const set = (patch: Partial<Settings>) => settings.set(patch);
  const close = () => app.set({ settingsOpen: false });
  return (
    <div className="overlay" onClick={close}>
      <div className="sheet panel" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="screen-head">
          <h2 className="screen-title" style={{ fontSize: 22 }}>
            Settings
          </h2>
          <button className="icon-btn" aria-label="Close settings" onClick={close}>
            <IconClose />
          </button>
        </div>

        <div className="setting-row">
          <div>
            <div className="label">Sound</div>
            <div className="hint">{s.muted ? 'All audio is muted' : 'Effects and music are on'}</div>
          </div>
          <button
            className="icon-btn"
            aria-label={s.muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              set({ muted: !s.muted });
              audio.unlock();
            }}
          >
            {s.muted ? <IconMute /> : <IconVolume />}
          </button>
        </div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2, paddingTop: 8 }}>
          <label className="label" htmlFor="sfx">
            Effects volume
          </label>
          <input
            id="sfx"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfxVolume}
            onChange={(e) => set({ sfxVolume: Number(e.target.value) })}
            onPointerUp={() => audio.place(4)}
          />
        </div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2, paddingTop: 8 }}>
          <label className="label" htmlFor="music">
            Music volume
          </label>
          <input id="music" type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="label">Haptics</div>
            <div className="hint">Vibration on supported devices</div>
          </div>
          <Switch label="Haptics" checked={s.haptics} onChange={(v) => set({ haptics: v })} />
        </div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '10px 0' }}>
          <div>
            <div className="label">Motion</div>
            <div className="hint">Reduced motion removes particles, shake and pulsing</div>
          </div>
          <div className="segmented" role="group" aria-label="Motion">
            {(['system', 'reduced', 'full'] as const).map((m) => (
              <button key={m} aria-pressed={s.motion === m} onClick={() => set({ motion: m })}>
                {m === 'system' ? 'System' : m === 'reduced' ? 'Reduced' : 'Full'}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="label">Tutorial</div>
          <button
            className="btn btn-sm"
            onClick={() => {
              close();
              if (!app.get().room) go('tutorial');
            }}
          >
            Replay
          </button>
        </div>
        <p className="hint" style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 0 }}>
          Guest play. Your nickname and preferences are stored on this device only. All sounds and artwork are original to this game.
        </p>
      </div>
    </div>
  );
}
