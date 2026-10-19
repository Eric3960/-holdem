import { describe, expect, it } from 'vitest';
import { bestHand, compareScore, handName } from '../../shared/handEvaluator';

const score = (cards: string) => bestHand(cards.split(' '));
const beats = (a: string, b: string) => compareScore(score(a), score(b)) > 0;

describe('牌型判斷', () => {
  const ladder = [
    ['高牌', 'As Kd 9c 7h 3s 2d 4c'],
    ['一對', 'As Ad 9c 7h 3s 2d 4c'.replace('4c', 'Jc')],
    ['兩對', 'As Ad 9c 9h 3s 2d Jc'],
    ['三條', 'As Ad Ac 9h 3s 2d Jc'],
    ['順子', '5s 6d 7c 8h 9s 2d Jc'],
    ['同花', 'As Ks 9s 7s 3s 2d Jc'],
    ['葫蘆', 'As Ad Ac 9h 9s 2d Jc'],
    ['四條', 'As Ad Ac Ah 9s 2d Jc'],
    ['同花順', '5s 6s 7s 8s 9s 2d Jc'],
  ];

  it.each(ladder)('辨識 %s', (name, cards) => {
    expect(handName(score(cards))).toBe(name);
  });

  it('牌型由小到大依序比較', () => {
    for (let i = 1; i < ladder.length; i++) expect(beats(ladder[i][1], ladder[i - 1][1])).toBe(true);
  });

  it('A-2-3-4-5 是順子，且是最小的順子', () => {
    expect(handName(score('As 2d 3c 4h 5s 9d Kc'))).toBe('順子');
    expect(beats('2s 3d 4c 5h 6s 9d Kc', 'As 2d 3c 4h 5s 9d Kc')).toBe(true);
  });

  it('A-2-3-4-5 同花順', () => {
    expect(handName(score('As 2s 3s 4s 5s 9d Kc'))).toBe('同花順');
  });

  it('K-A-2 不能連成順子', () => {
    expect(handName(score('Qs Kd Ac 2h 3s 8d 9c'))).toBe('高牌');
  });

  it('同牌型比踢腳', () => {
    expect(beats('As Ad Kc 7h 3s 2d 4c', 'As Ad Qc 7h 3s 2d 4c')).toBe(true); // 一對 A，K 踢腳勝 Q
    expect(beats('Ks Kd 9c 9h As 2d 4c', 'Ks Kd 9c 9h Qs 2d 4c')).toBe(true); // 兩對比第五張
    expect(beats('9s 9d 9c 2h 2s Kd 4c', '8s 8d 8c Ah As Kd 4c')).toBe(true); // 葫蘆先比三條
    expect(beats('As Ks 9s 7s 4s 2d 3c', 'As Ks 9s 7s 3s 2d 4c')).toBe(true); // 同花逐張比
  });

  it('七選五：最佳五張相同即平手（公牌打）', () => {
    expect(compareScore(score('2c 3d As Ks Qs Js Ts'), score('4h 5h As Ks Qs Js Ts'))).toBe(0);
    expect(compareScore(score('2c 3d 9s 9h 7c 7d Ah'), score('2h 3c 9d 9c 7h 7s As'))).toBe(0);
  });

  it('花色不分大小', () => {
    expect(compareScore(score('As Ks Qs Js 9s 2d 3c'), score('Ah Kh Qh Jh 9h 2d 3c'))).toBe(0);
  });
});
