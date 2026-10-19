import { useState } from 'react';
import type { RoomSettings, TableView } from '../../shared/types';
import { MIN_PLAYERS, SETTING_LIMITS, STARTING_STACK } from '../../shared/types';
import type { RoomApi } from '../hooks/useRoom';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt('請複製：', text);
    }
  };
  return (
    <button type="button" onClick={copy} className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-white/15 transition active:scale-95 ${done ? 'bg-emerald-500/30' : 'bg-white/10 hover:bg-white/20'}`}>
      {done ? '已複製 ✓' : label}
    </button>
  );
}

function NumberSetting({ label, unit, value, k, disabled, onChange }: { label: string; unit: string; value: number; k: keyof typeof SETTING_LIMITS; disabled: boolean; onChange: (v: number) => void }) {
  const [min, max] = SETTING_LIMITS[k];
  const [draft, setDraft] = useState<string | null>(null); // 輸入中的值，離開欄位或按 Enter 才送出
  const commit = () => {
    if (draft !== null && draft !== '') onChange(Number(draft));
    setDraft(null);
  };
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-white/80">
        {label}
        <span className="ml-1 text-[11px] text-white/35">
          {min}～{max}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <input
          id={k}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft ?? value}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-20 rounded-lg bg-white/10 px-2 py-1.5 text-right tabular-nums ring-1 ring-white/15 outline-none focus:ring-amber-300 disabled:bg-transparent disabled:ring-0"
        />
        <span className="w-8 text-xs text-white/50">{unit}</span>
      </span>
    </label>
  );
}

export default function RoomLobby({ view, api }: { view: TableView; api: RoomApi }) {
  const { settings } = view.tournament;
  const host = view.isHost;
  const set = (patch: Partial<RoomSettings>) => api.updateSettings(patch);
  const invite = `${location.origin}${location.pathname}?room=${view.code}`;
  const canStart = view.players.length >= MIN_PLAYERS;

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,#14532d,#020617_70%)] px-4 py-6">
      <div className="mx-auto grid max-w-3xl gap-4 desk:grid-cols-2">
        <section className="space-y-4 rounded-3xl bg-slate-900/85 p-5 ring-1 ring-white/10">
          <div>
            <div className="text-xs tracking-wide text-white/50">房間代碼</div>
            <div className="font-mono text-4xl font-black tracking-[0.25em] text-amber-300">{view.code}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={invite} label="複製邀請連結" />
            <CopyButton text={view.code} label="複製代碼" />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-bold">玩家 {view.players.length} / 9</h2>
              {host && (
                <div className="flex gap-1.5 text-xs">
                  <button type="button" onClick={api.addBot} className="rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 hover:bg-white/20">
                    + 電腦玩家
                  </button>
                  <button type="button" onClick={api.removeBot} className="rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 hover:bg-white/20">
                    − 電腦玩家
                  </button>
                </div>
              )}
            </div>
            <ul className="grid grid-cols-2 gap-1.5">
              {view.players.map((p) => (
                <li key={p.seat} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${p.isMe ? 'bg-amber-400/15 ring-1 ring-amber-300/40' : 'bg-white/5'}`}>
                  <span className="text-xl">{p.avatar}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.isBot && '🤖 '}
                    {p.name}
                  </span>
                  {p.isHost && <span title="房主">👑</span>}
                  {!p.connected && <span className="text-[10px] text-rose-300">離線</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl bg-slate-900/85 p-5 ring-1 ring-white/10">
          <h2 className="font-bold">比賽設定{!host && <span className="ml-2 text-xs font-normal text-white/40">由房主設定</span>}</h2>
          <p className="mb-2 text-xs text-white/40">起始籌碼 {STARTING_STACK.toLocaleString('en-US')}，第 4 級起大盲位代付前注</p>
          <div className="divide-y divide-white/5">
            <NumberSetting label="每級盲注時間" unit="分鐘" k="levelMinutes" value={settings.levelMinutes} disabled={!host} onChange={(v) => set({ levelMinutes: v })} />
            <NumberSetting label="行動計時" unit="秒" k="actionSeconds" value={settings.actionSeconds} disabled={!host} onChange={(v) => set({ actionSeconds: v })} />
            <NumberSetting label="時間銀行（整場共用）" unit="秒" k="timeBankSeconds" value={settings.timeBankSeconds} disabled={!host} onChange={(v) => set({ timeBankSeconds: v })} />
            <NumberSetting label="比賽時間上限" unit="分鐘" k="timeLimitMinutes" value={settings.timeLimitMinutes} disabled={!host} onChange={(v) => set({ timeLimitMinutes: v })} />
            <label className="flex items-center justify-between py-2.5">
              <span className="text-sm text-white/80">前 3 級可重新進場一次</span>
              <input id="rebuy" type="checkbox" checked={settings.allowRebuy} disabled={!host} onChange={(e) => set({ allowRebuy: e.target.checked })} className="h-5 w-5 accent-amber-400" />
            </label>
            <div className="space-y-1.5 py-2.5">
              <span className="text-sm text-white/80">時間到時</span>
              <div className="grid grid-cols-2 gap-1.5 text-sm">
                {(
                  [
                    ['sudden-death', '決勝模式', '每 2 分鐘盲注跳兩級'],
                    ['chip-count', '依籌碼排名', '打完當手即結束'],
                  ] as const
                ).map(([mode, title, desc]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={!host}
                    onClick={() => set({ timeLimitMode: mode })}
                    className={`rounded-xl px-2.5 py-2 text-left ring-1 transition ${settings.timeLimitMode === mode ? 'bg-amber-400/20 ring-amber-300/60' : 'bg-white/5 ring-white/10'} ${host ? 'hover:bg-white/10' : ''}`}
                  >
                    <div className="font-semibold">{title}</div>
                    <div className="text-[11px] text-white/50">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {host ? (
            <button
              type="button"
              disabled={!canStart}
              onClick={api.start}
              className="mt-3 w-full rounded-xl bg-linear-to-b from-amber-300 to-amber-500 py-3.5 text-lg font-black text-slate-900 shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            >
              {canStart ? '開始比賽' : '至少需要 2 位玩家'}
            </button>
          ) : (
            <p className="mt-3 rounded-xl bg-white/5 py-3 text-center text-sm text-white/60">等待房主開始比賽…</p>
          )}
          <button type="button" onClick={api.leave} className="mt-2 w-full py-2 text-xs text-white/40 hover:text-white/70">
            離開房間
          </button>
        </section>
      </div>
    </div>
  );
}
