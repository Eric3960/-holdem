import { useEffect, useRef, useState } from 'react';
import type { AudioPrefs } from '../audio/sound';
import { sfx } from '../audio/sound';

interface Props {
  prefs: AudioPrefs;
  onChange: (patch: Partial<AudioPrefs>) => void;
  className?: string;
}

function Row({ label, on, volume, onToggle, onVolume, id }: { label: string; on: boolean; volume: number; onToggle: () => void; onVolume: (v: number) => void; id: string }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={onToggle}
          className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-amber-400' : 'bg-white/20'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={!on}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="h-2 w-full accent-amber-400 disabled:opacity-30"
        aria-label={`${label}音量`}
      />
    </div>
  );
}

export default function SoundControls({ prefs, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const muted = !prefs.sfx && !prefs.music;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 hover:bg-white/20" aria-label="音效與音樂">
        {muted ? '🔇' : '🔊'}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-60 space-y-4 rounded-2xl bg-slate-900 p-4 text-left text-white shadow-2xl ring-1 ring-white/15">
          <Row
            id="sfx-volume"
            label="音效"
            on={prefs.sfx}
            volume={prefs.sfxVolume}
            onToggle={() => onChange({ sfx: !prefs.sfx })}
            onVolume={(v) => {
              onChange({ sfxVolume: v });
              setTimeout(sfx.preview, 50);
            }}
          />
          <Row id="music-volume" label="背景音樂（輕爵士）" on={prefs.music} volume={prefs.musicVolume} onToggle={() => onChange({ music: !prefs.music })} onVolume={(v) => onChange({ musicVolume: v })} />
          <p className="text-[11px] leading-relaxed text-white/40">所有聲音都由瀏覽器即時合成。手機若開啟靜音模式可能聽不到。</p>
        </div>
      )}
    </div>
  );
}
