const SUITS = { s: ['♠', false], h: ['♥', true], d: ['♦', true], c: ['♣', false] };

// 卡片尺寸全部以 em 計算，只要改 font-size 就能縮放
const SIZE = {
  xs: 'text-[0.62em]',
  sm: 'text-[0.95em]',
  md: 'text-[1.15em]',
  hero: 'text-[19px] desk:text-[26px] short:text-[16px]',
};

// card 為 null 時顯示牌背，例如 'Ah'、'Td'
export default function PlayingCard({ card, size = 'md', dim = false, className = '', style }) {
  const base = `relative w-[2.5em] h-[3.5em] shrink-0 rounded-[0.28em] shadow-[0_0.15em_0.4em_rgb(0_0_0/0.45)] ${SIZE[size]} ${className}`;

  if (!card) {
    return (
      <div className={`${base} bg-linear-to-br from-rose-600 to-rose-900 p-[0.18em] ring-1 ring-black/30`} style={style}>
        <div className="h-full w-full rounded-[0.18em] border border-white/40 bg-[repeating-linear-gradient(45deg,rgb(255_255_255/0.13)_0_3px,transparent_3px_6px)]" />
      </div>
    );
  }

  const [suit, red] = SUITS[card[1]];
  const rank = card[0] === 'T' ? '10' : card[0];
  return (
    <div
      className={`${base} bg-white ring-1 ring-black/10 ${red ? 'text-red-600' : 'text-slate-900'} ${dim ? 'brightness-50' : ''}`}
      style={style}
    >
      <div className="absolute left-[0.18em] top-[0.12em] flex flex-col items-center font-bold leading-[0.95]">
        <span className="text-[0.95em] tracking-tighter">{rank}</span>
        <span className="text-[0.75em]">{suit}</span>
      </div>
      <span className="absolute right-[0.12em] bottom-[0.02em] text-[1.6em] leading-none">{suit}</span>
    </div>
  );
}

export function CardSlot({ size = 'md' }) {
  return <div className={`w-[2.5em] h-[3.5em] shrink-0 rounded-[0.28em] border border-dashed border-white/20 ${SIZE[size]}`} />;
}
