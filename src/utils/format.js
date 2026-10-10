export const fmt = (n) => n.toLocaleString('en-US');
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const pct = (p) => ({ left: `${p.x}%`, top: `${p.y}%` });
