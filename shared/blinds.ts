import type { BlindLevel } from './types';

// 級別 4 起採 BB ante（大盲位一人代付，金額 = 大盲）
const TABLE: [number, number, number][] = [
  [100, 200, 0],
  [150, 300, 0],
  [200, 400, 0],
  [300, 600, 600],
  [400, 800, 800],
  [600, 1200, 1200],
  [800, 1600, 1600],
  [1000, 2000, 2000],
  [1500, 3000, 3000],
  [2000, 4000, 4000],
  [3000, 6000, 6000],
  [4000, 8000, 8000],
];

const round100 = (n: number) => Math.max(100, Math.round(n / 100) * 100);

export function blindLevel(level: number): BlindLevel {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= TABLE.length) {
    const [sb, bb, ante] = TABLE[lv - 1];
    return { level: lv, sb, bb, ante };
  }
  // 第 13 級以後：每級約 ×1.5，取整到 100
  let sb = TABLE[TABLE.length - 1][0];
  for (let i = TABLE.length; i < lv; i++) sb = round100(sb * 1.5);
  return { level: lv, sb, bb: sb * 2, ante: sb * 2 };
}
