const COLORS = [
  [500, 'bg-violet-600'],
  [100, 'bg-slate-900'],
  [25, 'bg-emerald-600'],
  [5, 'bg-red-600'],
  [0, 'bg-sky-600'],
];

export default function Chip({ value = 0, className = '', style }) {
  const color = COLORS.find(([min]) => value >= min)[1];
  return (
    <span
      className={`inline-block h-[1.25em] w-[1.25em] rounded-full border-[0.22em] border-dashed border-white/90 ${color} shadow-[0_0.1em_0.2em_rgb(0_0_0/0.5)] ring-1 ring-black/40 ${className}`}
      style={style}
    />
  );
}

export function ChipStack({ amount, className = '' }) {
  const count = amount >= 500 ? 3 : amount >= 100 ? 2 : 1;
  return (
    <span className={`relative inline-block w-[1.25em] ${className}`} style={{ height: `${1.25 + (count - 1) * 0.22}em` }}>
      {Array.from({ length: count }, (_, k) => (
        <Chip key={k} value={amount} className="absolute left-0" style={{ bottom: `${k * 0.22}em` }} />
      ))}
    </span>
  );
}
