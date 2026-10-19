import type { BlindLevel, PlayerIntent } from '../../shared/types';
import { advance, applyAction, createHand, playerAt, showdown, type HandState } from './hand';

/** holes 依座位排序給每位玩家的底牌，接著是 5 張公牌 */
export const deckOf = (holes: string[][], board: string[]) => [...holes.flat(), ...board];

export const level = (sb: number, bb: number, ante = 0): BlindLevel => ({ level: 1, sb, bb, ante });

export function hand(stacks: Record<number, number>, button: number, lv: BlindLevel, holes?: string[][], board?: string[]) {
  const seats = Object.entries(stacks).map(([seat, stack]) => ({ seat: Number(seat), stack }));
  return createHand({ seats, button, level: lv, deck: holes && board ? deckOf(holes, board) : undefined });
}

export function act(s: HandState, seat: number, intent: PlayerIntent): HandState {
  const r = applyAction(s, seat, intent);
  if (!r.ok) throw new Error(`seat ${seat} ${intent.type}: ${r.error}`);
  return r.state;
}

/** 一路推進到結算完成 */
export function finish(s: HandState): HandState {
  let cur = s;
  for (let guard = 0; guard < 20 && cur.phase !== 'complete'; guard++) {
    if (cur.phase === 'street-end') cur = advance(cur);
    else if (cur.phase === 'showdown') cur = showdown(cur);
    else throw new Error(`還有人需要行動：座位 ${cur.toAct}`);
  }
  return cur;
}

export const stackOf = (s: HandState, seat: number) => playerAt(s, seat).stack;
