import { ChipStack } from './Chip';
import { fmt, pct } from '../utils/format';

// 玩家本輪下注金額；延遲出現，讓飛行中的籌碼先「落地」
export default function BetChips({ amount, pos }) {
  return (
    <div
      className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 animate-pop-in items-center gap-[0.3em] [animation-delay:400ms]"
      style={pct(pos)}
    >
      <ChipStack amount={amount} />
      <span className="rounded-full bg-black/55 px-[0.5em] py-[0.05em] text-[0.8em] font-bold tabular-nums">{fmt(amount)}</span>
    </div>
  );
}
