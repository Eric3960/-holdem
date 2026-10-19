export interface Contribution {
  seat: number;
  total: number;
  folded: boolean;
}

export interface Pot {
  amount: number;
  eligible: number[]; // 有資格比牌的座位
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** 依各玩家本手投入總額分層：主池 → 邊池 1 → 邊池 2… */
export function buildPots(contributions: Contribution[]): Pot[] {
  const levels = [...new Set(contributions.map((c) => c.total).filter((t) => t > 0))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = contributions.reduce((sum, c) => sum + Math.max(0, Math.min(c.total, level) - prev), 0);
    const eligible = contributions.filter((c) => !c.folded && c.total >= level).map((c) => c.seat);
    const last = pots[pots.length - 1];
    // 資格相同的層合併；沒有人有資格的層（已棄牌者多投入的部分）併入上一層
    if (last && (eligible.length === 0 || sameSet(last.eligible, eligible))) last.amount += amount;
    else pots.push({ amount, eligible });
    prev = level;
  }
  return pots.filter((p) => p.amount > 0);
}

/**
 * 平分底池。winners 需依「莊家左邊開始」的順序排列，
 * 除不盡的零頭全部給第一位（莊家左邊最近的贏家）。
 */
export function splitPot(amount: number, winners: number[]): Map<number, number> {
  const share = Math.floor(amount / winners.length);
  const remainder = amount - share * winners.length;
  return new Map(winners.map((seat, i) => [seat, share + (i === 0 ? remainder : 0)]));
}
