// 錦標賽規則的純函式：級別時鐘、時間上限、淘汰名次、重新進場資格
import type { RoomSettings } from '../../shared/types';
import { REBUY_MAX_LEVEL } from '../../shared/types';

export const SUDDEN_DEATH_STEP_MS = 2 * 60_000;

export interface ClockState {
  level: number;
  /** 距離開賽多少 ms 時會升到下一級；null 表示不再升級 */
  nextChangeAt: number | null;
  overtime: boolean;
}

/** 依已進行時間計算目前級別（新級別在下一手開始時才生效，由呼叫端處理） */
export function levelAt(elapsedMs: number, settings: RoomSettings): ClockState {
  const L = settings.levelMinutes * 60_000;
  const T = settings.timeLimitMinutes * 60_000;
  const t = Math.max(0, elapsedMs);

  if (t < T || settings.timeLimitMode === 'chip-count') {
    const level = Math.floor(t / L) + 1;
    return { level, nextChangeAt: level * L, overtime: t >= T };
  }
  // 決勝模式：到達時間上限立刻跳兩級，之後每 2 分鐘再跳兩級
  const base = Math.floor((T - 1) / L) + 1;
  const jumps = 1 + Math.floor((t - T) / SUDDEN_DEATH_STEP_MS);
  return { level: base + 2 * jumps, nextChangeAt: T + jumps * SUDDEN_DEATH_STEP_MS, overtime: true };
}

export interface BustRecord {
  seat: number;
  startStack: number; // 該手開始前的籌碼
}

/** 同一手被淘汰的一組玩家（依淘汰先後存成陣列） */
export type BustGroup = { handNo: number; players: BustRecord[] };

export interface Placed {
  seat: number;
  place: number;
}

/**
 * 計算名次（同分同名次，例如 1、2、2、4）。
 * alive：仍有籌碼的玩家；rankAlive=false 時比賽未結束，存活者不排名但佔用前面的名次。
 * 淘汰者：越晚淘汰名次越前；同一手淘汰時，開局籌碼多者名次較前。
 */
export function standings(alive: { seat: number; stack: number }[], busts: BustGroup[], rankAlive: boolean): Placed[] {
  const out: Placed[] = [];
  let next = 1;

  const rankBlock = <T extends { seat: number }>(list: T[], key: (x: T) => number) => {
    const sorted = [...list].sort((a, b) => key(b) - key(a));
    sorted.forEach((x, i) => {
      const place = i > 0 && key(sorted[i - 1]) === key(x) ? out[out.length - 1].place : next + i;
      out.push({ seat: x.seat, place });
    });
    next += sorted.length;
  };

  if (rankAlive) rankBlock(alive, (x) => x.stack);
  else next += alive.length;

  for (let g = busts.length - 1; g >= 0; g--) rankBlock(busts[g].players, (x) => x.startStack);
  return out;
}

export function canRebuy(
  p: { eliminated: boolean; rebuys: number; bustLevel: number | null },
  settings: RoomSettings,
  currentLevel: number,
) {
  return (
    settings.allowRebuy &&
    p.eliminated &&
    p.rebuys === 0 &&
    p.bustLevel !== null &&
    p.bustLevel <= REBUY_MAX_LEVEL &&
    currentLevel <= REBUY_MAX_LEVEL
  );
}
