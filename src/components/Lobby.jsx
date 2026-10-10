import { useState } from 'react';
import { AVATARS, MAX_SEATS, MIN_SEATS } from '../../shared/constants';

const randomRoom = () => Math.random().toString(36).slice(2, 7);

function load(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Lobby({ onJoin }) {
  const roomFromUrl = new URLSearchParams(location.search).get('room');
  const [name, setName] = useState(() => load('holdem-name', ''));
  const [avatar, setAvatar] = useState(() => load('holdem-avatar', AVATARS[0]));
  const [room, setRoom] = useState(roomFromUrl ?? randomRoom());
  const [seatCount, setSeatCount] = useState(MAX_SEATS);

  const submit = (e) => {
    e.preventDefault();
    const code = room.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || randomRoom();
    try {
      localStorage.setItem('holdem-name', name.trim());
      localStorage.setItem('holdem-avatar', avatar);
    } catch {}
    history.replaceState(null, '', `?room=${code}`);
    onJoin({ room: code, name: name.trim() || '玩家', avatar, seatCount });
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#14532d,#020617_70%)] px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl bg-slate-900/85 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <div className="text-center">
          <div className="text-3xl font-black text-amber-300">♠ Hold'em</div>
          <p className="mt-1 text-sm text-white/60">{roomFromUrl ? `朋友邀請你加入牌桌「${roomFromUrl}」` : '開一桌，把連結傳給朋友'}</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-white/60">暱稱</span>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="輸入你的名字"
            autoFocus
            className="w-full rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 outline-none placeholder:text-white/30 focus:ring-2 focus:ring-amber-300"
          />
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

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-white/60">房間代碼</span>
            <input
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              maxLength={16}
              className="w-full rounded-xl bg-white/10 px-3 py-2.5 font-mono ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-amber-300"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-white/60">座位數</span>
            <select
              id="seats"
              value={seatCount}
              onChange={(e) => setSeatCount(Number(e.target.value))}
              className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 outline-none [&>option]:bg-slate-900"
            >
              {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map((n) => (
                <option key={n} value={n}>
                  {n} 人
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-3 text-[11px] text-white/40">座位數只在開新房間時有效；加入既有房間會沿用原設定。</p>

        <button type="submit" className="w-full rounded-xl bg-linear-to-b from-amber-300 to-amber-500 py-3 font-bold text-slate-900 shadow-lg transition hover:brightness-110 active:scale-[0.98]">
          入座
        </button>
      </form>
    </div>
  );
}
