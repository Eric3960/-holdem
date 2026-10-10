import PlayingCard from './PlayingCard';
import TurnTimer from './TurnTimer';
import { fmt, pct } from '../utils/format';

const ACTION_STYLE = {
  棄牌: 'bg-slate-600',
  過牌: 'bg-sky-600',
  跟注: 'bg-sky-600',
  下注: 'bg-amber-500 text-slate-900',
  加注: 'bg-amber-500 text-slate-900',
  'All-in': 'bg-rose-600',
  贏家: 'bg-emerald-500 text-slate-900',
  等待中: 'bg-slate-700 text-white/70',
};

export default function PlayerSeat({ player, pos, isDealer, isTurn, isWinner, revealCards, turnKey, turnSeconds, turnElapsed }) {
  const { name, avatar, chips, folded, allIn, lastAction, cards, isHero, isBot, inHand, connected } = player;
  const dimmed = folded || !inHand;

  return (
    <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={pct(pos)}>
      <div className={`relative flex flex-col items-center transition duration-300 ${dimmed ? 'opacity-45 grayscale' : ''}`}>
        {/* 其他玩家的底牌（自己的底牌顯示在下方操作區） */}
        {!isHero && !folded && cards.length > 0 && (
          <div className={`absolute left-1/2 flex -translate-x-1/2 transition-all ${revealCards ? 'z-20 -top-[2.6em]' : '-top-[1.3em]'}`}>
            {cards.map((c, k) => (
              <PlayingCard
                key={k}
                card={revealCards ? c : null}
                size={revealCards ? 'sm' : 'xs'}
                className={k ? '-ml-[0.9em] rotate-6' : '-rotate-6'}
              />
            ))}
          </div>
        )}

        {/* 頭像 + 計時外框 */}
        <div
          className={`relative z-10 grid h-[4em] w-[4em] place-items-center rounded-full border-2 bg-linear-to-br from-slate-600 to-slate-800 shadow-lg
            ${isTurn ? 'animate-glow border-amber-300' : isWinner ? 'border-emerald-400 ring-[0.25em] ring-emerald-400/60' : 'border-white/25'}`}
        >
          <span className="text-[2em] leading-none">{avatar}</span>
          {isTurn && <TurnTimer key={turnKey} seconds={turnSeconds} elapsed={turnElapsed} />}
          {isDealer && (
            <span className="absolute -right-[0.35em] -bottom-[0.1em] grid h-[1.5em] w-[1.5em] place-items-center rounded-full bg-white font-black text-slate-900 shadow ring-1 ring-black/30">
              <span className="text-[0.75em]">D</span>
            </span>
          )}
        </div>

        {/* 名牌：名稱 + 剩餘籌碼 */}
        <div
          className={`relative z-10 -mt-[0.5em] w-[6.2em] rounded-[0.6em] border bg-black/75 px-[0.4em] py-[0.15em] text-center shadow-lg backdrop-blur-sm
            ${isTurn ? 'border-amber-300/70' : 'border-white/10'}`}
        >
          <div className="truncate text-[0.8em] text-white/85">
            {isBot && '🤖 '}
            {isHero ? `${name}（我）` : name}
          </div>
          <div className="text-[0.9em] font-bold tabular-nums text-amber-300">{allIn ? 'ALL-IN' : `$${fmt(chips)}`}</div>
        </div>

        {!connected && (
          <span className="absolute top-[0.2em] left-1/2 z-20 -translate-x-1/2 rounded-full bg-rose-600 px-[0.5em] text-[0.65em] font-bold leading-[1.6]">離線</span>
        )}

        {lastAction && (
          <div
            key={lastAction}
            className={`absolute -bottom-[1.3em] z-20 animate-pop-in whitespace-nowrap rounded-full px-[0.6em] text-[0.7em] font-bold leading-[1.6] shadow ${ACTION_STYLE[lastAction] ?? 'bg-slate-700'}`}
          >
            {lastAction}
          </div>
        )}
      </div>
    </div>
  );
}
