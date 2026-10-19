import { ChipStack } from './Chip';
import { fmt } from '../utils/format';

export default function Pot({ amount, label = '底池' }) {
  return (
    <div className={`flex items-center gap-[0.45em] rounded-full bg-black/45 px-[0.8em] py-[0.3em] whitespace-nowrap ring-1 ring-white/10 transition-opacity ${amount ? '' : 'opacity-50'}`}>
      <ChipStack amount={amount} />
      <span className="text-[0.8em] text-white/60">{label}</span>
      <span key={amount} className="animate-pop-in font-bold tabular-nums text-amber-300">{fmt(amount)}</span>
    </div>
  );
}
