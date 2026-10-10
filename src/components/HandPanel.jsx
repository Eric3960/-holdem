import PlayingCard, { CardSlot } from './PlayingCard';

// 自己的兩張底牌 + 目前牌型
export default function HandPanel({ cards, folded, handName }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-end">
        {cards.length === 0 && [0, 1].map((i) => <CardSlot key={i} size="hero" />)}
        {cards.map((c, i) => (
          <PlayingCard
            key={c}
            card={c}
            size="hero"
            dim={folded}
            className={`animate-deal ${i === 0 ? '-rotate-6' : '-ml-[0.5em] rotate-6'}`}
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <div className="flex h-5 items-center text-xs">
        {folded ? (
          <span className="text-white/50">已棄牌，等待下一手</span>
        ) : (
          handName && (
            <span className="rounded-full bg-black/50 px-2.5 py-0.5 font-semibold text-amber-200 ring-1 ring-amber-300/30">{handName}</span>
          )
        )}
      </div>
    </div>
  );
}
