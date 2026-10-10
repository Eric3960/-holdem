export default function ActionLog({ entries, className = '' }) {
  return (
    <div className={`h-36 w-full max-w-xs overflow-hidden rounded-xl bg-black/30 p-3 text-xs ring-1 ring-white/10 ${className}`}>
      <div className="mb-1.5 font-semibold text-white/40">牌局紀錄</div>
      <ul className="space-y-0.5">
        {entries.slice(0, 7).map((line, i) => (
          <li key={entries.length - i} className={`truncate ${i === 0 ? 'text-white' : 'text-white/55'}`}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
