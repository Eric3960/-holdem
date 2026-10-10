const RANKS = '23456789TJQKA';
export const HAND_NAMES = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順'];

// 回傳可比較的分數陣列：[牌型, ...比大小用的點數]
function score5(cards) {
  const vals = cards.map((c) => RANKS.indexOf(c[0]) + 2).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  let straightHigh = 0;
  if (new Set(vals).size === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if (vals.join() === '14,5,4,3,2') straightHigh = 5;
  }
  const counts = {};
  vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([v, c]) => [c, +v])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const kickers = groups.map((g) => g[1]);

  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, ...kickers];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...kickers];
  if (flush) return [5, ...vals];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...kickers];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...kickers];
  if (groups[0][0] === 2) return [1, ...kickers];
  return [0, ...vals];
}

export function compareScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

// 5~7 張牌中挑最佳 5 張
export function bestHand(cards) {
  let best = null;
  const pick = (start, combo) => {
    if (combo.length === 5) {
      const s = score5(combo);
      if (!best || compareScore(s, best) > 0) best = s;
      return;
    }
    for (let i = start; i < cards.length; i++) pick(i + 1, [...combo, cards[i]]);
  };
  pick(0, []);
  return best;
}
