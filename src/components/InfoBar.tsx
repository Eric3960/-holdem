import type { TableView } from '../../shared/types';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function Stat({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className="text-[10px] tracking-wide text-white/45">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

interface Props {
  view: TableView;
  now: number;
  connected: boolean;
  onToggleSide: () => void;
  onToggleAway: () => void;
  felt: string;
  onFelt: () => void;
  controls?: React.ReactNode;
}

export default function InfoBar({ view, now, connected, onToggleSide, onToggleAway, felt, onFelt, controls }: Props) {
  const t = view.tournament;
  const lv = t.level;
  const scale = t.timeScale;
  const me = view.players[view.mySeat];
  const canAway = me && !me.eliminated && t.status === 'running';
  const elapsed = t.startedAt ? (now - t.startedAt) * scale : 0;
  const toLimit = t.timeLimitAt ? (t.timeLimitAt - now) * scale : 0;

  return (
    <header className="shrink-0 border-b border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs backdrop-blur desk:px-5">
      <div className="flex items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'animate-pulse bg-rose-500'}`} title={connected ? '已連線' : '重新連線中'} />
          <span className="font-mono font-bold text-amber-300">{view.code}</span>
        </div>
        <Stat label="級別" value={lv.level} />
        <Stat label="盲注" value={`${lv.sb.toLocaleString('en-US')}/${lv.bb.toLocaleString('en-US')}${lv.ante ? ` (${lv.ante.toLocaleString('en-US')})` : ''}`} />
        <Stat label={t.overtime && t.settings.timeLimitMode === 'sudden-death' ? '下次跳級' : '下一級'} value={t.nextLevelAt ? mmss((t.nextLevelAt - now) * scale) : '—'} className={t.overtime ? 'text-rose-300' : ''} />
        <Stat label="剩餘" value={`${t.remaining}/${t.entrants}`} />
        <Stat label="已進行" value={mmss(elapsed)} className="hidden sm:flex" />
        <Stat label={t.overtime ? '已超時' : '距時間上限'} value={t.overtime ? (t.settings.timeLimitMode === 'sudden-death' ? '決勝中' : '本手結束') : mmss(toLimit)} className={`hidden sm:flex ${t.overtime ? 'text-rose-300' : ''}`} />

        <div className="ml-auto flex items-center gap-1.5">
          {canAway && (
            <button type="button" onClick={onToggleAway} className={`rounded-md px-2 py-1 ring-1 ring-white/15 ${me.away ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-white/10 hover:bg-white/20'}`}>
              {me.away ? '回座' : '離席'}
            </button>
          )}
          {controls}
          <button type="button" onClick={onFelt} className="rounded-md bg-white/10 px-2 py-1.5 ring-1 ring-white/15" aria-label="切換桌布顏色">
            <span className={`block h-3 w-3 rounded-full ${felt === 'green' ? 'bg-emerald-500' : 'bg-blue-600'}`} />
          </button>
          <button type="button" onClick={onToggleSide} className="rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 hover:bg-white/20 desk:hidden">
            紀錄
          </button>
        </div>
      </div>
      {scale > 1 && <div className="mt-0.5 text-[10px] text-amber-300/70">測試模式：錦標賽時鐘 ×{scale}</div>}
    </header>
  );
}
