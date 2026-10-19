import type { SeatView } from '../../shared/types';
import PlayingCard from './PlayingCard';
import TurnTimer from './TurnTimer';
import { pct } from '../utils/format';

const fmt = (n: number) => n.toLocaleString('en-US');

const ACTION_STYLE: Record<string, string> = {
  棄牌: 'bg-slate-600',
  過牌: 'bg-sky-600',
  跟注: 'bg-sky-600',
  下注: 'bg-amber-500 text-slate-900',
  加注: 'bg-amber-500 text-slate-900',
  全下: 'bg-rose-600',
  贏家: 'bg-emerald-500 text-slate-900',
  淘汰: 'bg-rose-900 text-rose-100',
  重新進場: 'bg-emerald-700',
};

export interface SeatTimer {
  key: string;
  seconds: number;
  elapsed: number;
  bank: boolean;
}

interface Props {
  player: SeatView;
  pos: { x: number; y: number };
  isButton: boolean;
  blind: 'SB' | 'BB' | null;
  isTurn: boolean;
  isWinner: boolean;
  timer: SeatTimer | null;
}

export default function PlayerSeat({ player: p, pos, isButton, blind, isTurn, isWinner, timer }: Props) {
  const dimmed = p.folded || p.eliminated || (!p.inHand && !p.eliminated);
  const revealed = p.cards.some(Boolean);

  return (
    <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={pct(pos)}>
      <div className={`relative flex flex-col items-center transition duration-300 ${dimmed ? 'opacity-45 grayscale' : ''}`}>
        {/* 其他玩家的底牌：牌背，攤牌或亮牌時翻開 */}
        {!p.isMe && !p.folded && p.cards.length > 0 && (
          <div className={`absolute left-1/2 flex -translate-x-1/2 transition-all ${revealed ? 'z-20 -top-[2.6em]' : '-top-[1.3em]'}`}>
            {p.cards.map((c, k) => (
              <PlayingCard key={k} card={c} size={revealed ? 'sm' : 'xs'} className={k ? '-ml-[0.9em] rotate-6' : '-rotate-6'} />
            ))}
          </div>
        )}

        <div
          className={`relative z-10 grid h-[4em] w-[4em] place-items-center rounded-full border-2 bg-linear-to-br from-slate-600 to-slate-800 shadow-lg
            ${isTurn ? 'animate-glow border-amber-300' : isWinner ? 'border-emerald-400 ring-[0.25em] ring-emerald-400/60' : 'border-white/25'}`}
        >
          <span className="text-[2em] leading-none">{p.avatar}</span>
          {isTurn && timer && <TurnTimer key={timer.key} seconds={timer.seconds} elapsed={timer.elapsed} bank={timer.bank} />}
          {isButton && (
            <span className="absolute -right-[0.35em] -bottom-[0.1em] grid h-[1.5em] w-[1.5em] place-items-center rounded-full bg-white font-black text-slate-900 shadow ring-1 ring-black/30">
              <span className="text-[0.75em]">D</span>
            </span>
          )}
          {blind && (
            <span className={`absolute -left-[0.45em] -bottom-[0.1em] grid h-[1.5em] min-w-[1.5em] place-items-center rounded-full px-[0.2em] font-black shadow ring-1 ring-black/30 ${blind === 'SB' ? 'bg-sky-300 text-sky-950' : 'bg-amber-300 text-amber-950'}`}>
              <span className="text-[0.6em]">{blind}</span>
            </span>
          )}
        </div>

        <div className={`relative z-10 -mt-[0.5em] w-[6.4em] rounded-[0.6em] border bg-black/75 px-[0.4em] py-[0.15em] text-center shadow-lg backdrop-blur-sm ${isTurn ? 'border-amber-300/70' : 'border-white/10'}`}>
          <div className="truncate text-[0.8em] text-white/85">
            {p.isBot && '🤖 '}
            {p.isMe ? `${p.name}（我）` : p.name}
          </div>
          <div className="text-[0.9em] font-bold tabular-nums text-amber-300">
            {p.eliminated ? (p.place ? `第 ${p.place} 名` : '已淘汰') : p.allIn ? 'ALL-IN' : fmt(p.stack)}
          </div>
        </div>

        {(!p.connected || p.away) && (
          <span className="absolute top-[0.2em] left-1/2 z-20 -translate-x-1/2 rounded-full bg-rose-600 px-[0.5em] text-[0.65em] font-bold leading-[1.6] whitespace-nowrap">
            {!p.connected ? '離線' : '離席'}
          </span>
        )}

        {p.lastAction && (
          <div
            key={p.lastAction}
            className={`absolute -bottom-[1.3em] z-20 animate-pop-in rounded-full px-[0.6em] text-[0.7em] font-bold leading-[1.6] whitespace-nowrap shadow ${ACTION_STYLE[p.lastAction] ?? 'bg-slate-700'}`}
          >
            {p.lastAction}
          </div>
        )}
      </div>
    </div>
  );
}
