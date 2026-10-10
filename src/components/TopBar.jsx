import { useState } from 'react';
import { BIG_BLIND, SMALL_BLIND, STREET_LABEL } from '../../shared/constants';

export default function TopBar({ room, handId, street, phase, connected, felt, onFeltChange, onAddBot, onRemoveBot }) {
  const [copied, setCopied] = useState(false);
  const invite = `${location.origin}${location.pathname}?room=${room}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('複製邀請連結', invite);
    }
  };

  const btn = 'rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 transition hover:bg-white/20 active:scale-95';

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 bg-slate-950/70 px-3 backdrop-blur short:h-9 desk:gap-3 desk:px-5">
      <div className="font-black tracking-tight text-amber-300">♠</div>
      <div className="flex min-w-0 items-center gap-2 text-xs text-white/60 desk:gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-400' : 'animate-pulse bg-rose-500'}`} title={connected ? '已連線' : '重新連線中'} />
        <span className="font-mono text-white/90">{room}</span>
        <span className="hidden sm:inline">
          盲注 {SMALL_BLIND}/{BIG_BLIND}
        </span>
        {handId > 0 && <span className="hidden sm:inline">#{handId}</span>}
        <span className="truncate text-white/90">{phase === 'waiting' ? '等待玩家' : STREET_LABEL[street]}</span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
        <button type="button" onClick={copy} className={`${btn} ${copied ? 'bg-emerald-500/30' : ''}`}>
          {copied ? '已複製 ✓' : '邀請朋友'}
        </button>
        <button type="button" onClick={onAddBot} className={btn} aria-label="加入電腦玩家">
          +🤖
        </button>
        <button type="button" onClick={onRemoveBot} className={btn} aria-label="移除電腦玩家">
          −🤖
        </button>
        <button type="button" onClick={() => onFeltChange(felt === 'green' ? 'blue' : 'green')} className={btn} aria-label="切換桌布顏色">
          <span className={`inline-block h-3 w-3 rounded-full align-middle ${felt === 'green' ? 'bg-emerald-500' : 'bg-blue-600'}`} />
        </button>
      </div>
    </header>
  );
}
