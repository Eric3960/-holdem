import { randomInt } from 'node:crypto';
import type { Card } from '../../shared/types';

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const s of 'shdc') for (const r of '23456789TJQKA') d.push(r + s);
  return d;
}

/** Fisher–Yates；預設使用密碼學亂數，測試時可注入 */
export function shuffle<T>(items: T[], rand: (n: number) => number = randomInt): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
