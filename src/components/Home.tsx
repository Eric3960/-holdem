import { useState, type FormEvent } from 'react';
import { AVATARS } from '../../shared/types';
import type { Profile } from '../hooks/useRoom';

interface Props {
  initialProfile: Profile | null;
  initialCode: string | null;
  error: string | null;
  onJoin: (profile: Profile, code?: string) => void;
}

const field = 'w-full rounded-xl bg-white/10 px-3 py-3 text-base ring-1 ring-white/15 outline-none placeholder:text-white/30 focus:ring-2 focus:ring-amber-300';

export default function Home({ initialProfile, initialCode, error, onJoin }: Props) {
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [avatar, setAvatar] = useState(initialProfile?.avatar ?? AVATARS[0]);
  const [code, setCode] = useState(initialCode ?? '');
  const profile = () => ({ name: name.trim() || '玩家', avatar });

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length === 6) onJoin(profile(), code);
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#14532d,#020617_70%)] px-4 py-8">
      <div className="w-full max-w-sm space-y-5 rounded-3xl bg-slate-900/85 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <div className="text-center">
          <div className="text-3xl font-black text-amber-300">♠ Hold'em 錦標賽</div>
          <p className="mt-1 text-sm text-white/60">{initialCode ? `朋友邀請你加入房間 ${initialCode}` : '約一小時一場的親友德州撲克'}</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-white/60">暱稱</span>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="輸入你的名字" autoFocus className={field} />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-white/60">頭像</span>
          <div className="grid grid-cols-6 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`grid aspect-square place-items-center rounded-xl text-2xl transition ${a === avatar ? 'bg-amber-400/30 ring-2 ring-amber-300' : 'bg-white/5 hover:bg-white/10'}`}
                aria-label={`頭像 ${a}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{error}</p>}

        <form onSubmit={join} className="space-y-2">
          <span className="text-xs font-semibold tracking-wide text-white/60">加入朋友的房間</span>
          <div className="flex gap-2">
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              placeholder="6 碼代碼"
              inputMode="text"
              autoCapitalize="characters"
              className={`${field} min-w-0 font-mono tracking-[0.3em] uppercase`}
            />
            <button
              type="submit"
              disabled={code.length !== 6}
              className="shrink-0 rounded-xl bg-linear-to-b from-amber-300 to-amber-500 px-5 font-bold text-slate-900 transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              加入
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3 text-xs text-white/30">
          <div className="h-px flex-1 bg-white/10" />或<div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => onJoin(profile())}
          className="w-full rounded-xl bg-white/10 py-3 font-bold ring-1 ring-white/20 transition hover:bg-white/15 active:scale-[0.98]"
        >
          建立新房間（我當房主）
        </button>
      </div>
    </div>
  );
}
