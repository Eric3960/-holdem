import type { TableView } from '../../shared/types';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function FinalResults({ view, onLeave }: { view: TableView; onLeave: () => void }) {
  const t = view.tournament;
  if (t.status !== 'finished' || !t.standings) return null;
  const winner = t.standings[0];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-pop-in rounded-3xl bg-slate-900 p-6 shadow-2xl ring-1 ring-amber-300/30">
        <div className="text-center">
          <div className="text-5xl">{winner.avatar}</div>
          <div className="mt-2 text-2xl font-black text-amber-300">{winner.name} 奪冠！</div>
          <div className="text-sm text-white/50">{t.endReason}</div>
        </div>
        <ol className="mt-5 max-h-[50vh] space-y-1.5 overflow-y-auto">
          {t.standings.map((s) => (
            <li key={s.seat} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.seat === view.mySeat ? 'bg-amber-400/15 ring-1 ring-amber-300/40' : 'bg-white/5'}`}>
              <span className="w-8 text-center font-bold tabular-nums">{MEDAL[s.place - 1] ?? `#${s.place}`}</span>
              <span className="text-xl">{s.avatar}</span>
              <span className="flex-1 truncate">{s.name}</span>
              {s.stack > 0 && <span className="text-sm tabular-nums text-amber-300">{s.stack.toLocaleString('en-US')}</span>}
            </li>
          ))}
        </ol>
        <button type="button" onClick={onLeave} className="mt-5 w-full rounded-xl bg-linear-to-b from-amber-300 to-amber-500 py-3 font-bold text-slate-900 active:scale-[0.98]">
          回到首頁
        </button>
      </div>
    </div>
  );
}
