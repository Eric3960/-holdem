import PlayingCard, { CardSlot } from './PlayingCard';

export default function CommunityCards({ cards, visible, size = 'md' }) {
  return (
    <div className="flex gap-[0.35em]">
      {Array.from({ length: 5 }, (_, i) =>
        i < visible ? (
          <PlayingCard
            key={cards[i]}
            card={cards[i]}
            size={size}
            className="animate-deal"
            style={{ animationDelay: `${i < 3 ? i * 120 : 0}ms` }}
          />
        ) : (
          <CardSlot key={`slot-${i}`} size={size} />
        ),
      )}
    </div>
  );
}
