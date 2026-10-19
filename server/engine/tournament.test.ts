import { describe, expect, it } from 'vitest';
import { blindLevel } from '../../shared/blinds';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { canRebuy, levelAt, standings } from './tournament';

const MIN = 60_000;

describe('盲注結構', () => {
  it('前 12 級依表格，之後每級 ×1.5 取整到 100', () => {
    expect(blindLevel(1)).toEqual({ level: 1, sb: 100, bb: 200, ante: 0 });
    expect(blindLevel(4)).toEqual({ level: 4, sb: 300, bb: 600, ante: 600 });
    expect(blindLevel(12)).toEqual({ level: 12, sb: 4000, bb: 8000, ante: 8000 });
    expect(blindLevel(13)).toEqual({ level: 13, sb: 6000, bb: 12000, ante: 12000 });
    expect(blindLevel(14).sb).toBe(9000);
  });
});

describe('級別時鐘', () => {
  const s = { ...DEFAULT_SETTINGS, levelMinutes: 8, timeLimitMinutes: 75 };

  it('每 8 分鐘升一級', () => {
    expect(levelAt(0, s)).toMatchObject({ level: 1, nextChangeAt: 8 * MIN });
    expect(levelAt(8 * MIN, s).level).toBe(2);
    expect(levelAt(74 * MIN, s)).toMatchObject({ level: 10, overtime: false });
  });

  it('決勝模式：到達上限立即跳兩級，之後每 2 分鐘再跳兩級', () => {
    expect(levelAt(75 * MIN, s)).toMatchObject({ level: 12, overtime: true, nextChangeAt: 77 * MIN });
    expect(levelAt(77 * MIN, s).level).toBe(14);
    expect(levelAt(80 * MIN, s).level).toBe(16);
  });

  it('籌碼排名模式：超過上限只標記 overtime，級別照常', () => {
    const c = { ...s, timeLimitMode: 'chip-count' as const };
    expect(levelAt(76 * MIN, c)).toMatchObject({ level: 10, overtime: true });
  });
});

describe('名次', () => {
  it('同一手多人淘汰：開局籌碼較多者名次較高', () => {
    const r = standings(
      [{ seat: 0, stack: 30000 }, { seat: 1, stack: 10000 }, { seat: 2, stack: 5000 }],
      [{ handNo: 9, players: [{ seat: 3, startStack: 1000 }, { seat: 4, startStack: 3000 }] }],
      false,
    );
    expect(r).toEqual([
      { seat: 4, place: 4 },
      { seat: 3, place: 5 },
    ]);
  });

  it('開局籌碼相同則並列，越晚淘汰名次越前', () => {
    const r = standings(
      [{ seat: 0, stack: 50000 }],
      [
        { handNo: 3, players: [{ seat: 5, startStack: 2000 }] },
        { handNo: 8, players: [{ seat: 1, startStack: 4000 }, { seat: 2, startStack: 4000 }] },
      ],
      true,
    );
    expect(r).toEqual([
      { seat: 0, place: 1 },
      { seat: 1, place: 2 },
      { seat: 2, place: 2 },
      { seat: 5, place: 4 },
    ]);
  });

  it('依籌碼排名結束：存活者依籌碼排序', () => {
    const r = standings([{ seat: 0, stack: 100 }, { seat: 1, stack: 900 }], [], true);
    expect(r).toEqual([
      { seat: 1, place: 1 },
      { seat: 0, place: 2 },
    ]);
  });
});

describe('重新進場', () => {
  const p = { eliminated: true, rebuys: 0, bustLevel: 2 };
  it('前 3 級淘汰且目前仍在第 3 級內才可以，限一次', () => {
    expect(canRebuy(p, DEFAULT_SETTINGS, 3)).toBe(true);
    expect(canRebuy(p, DEFAULT_SETTINGS, 4)).toBe(false);
    expect(canRebuy({ ...p, bustLevel: 4 }, DEFAULT_SETTINGS, 3)).toBe(false);
    expect(canRebuy({ ...p, rebuys: 1 }, DEFAULT_SETTINGS, 2)).toBe(false);
    expect(canRebuy(p, { ...DEFAULT_SETTINGS, allowRebuy: false }, 2)).toBe(false);
  });
});
