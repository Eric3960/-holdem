// 單手牌的純函式引擎：不碰網路、計時器或亂數以外的副作用。
// 每個函式都回傳新的 state，原 state 不會被修改。
import type { ActionType, BlindLevel, Card, LegalActions, PlayerIntent, Street } from '../../shared/types';
import { bestHand, compareScore, handName, type Score } from '../../shared/handEvaluator';
import { newDeck, shuffle } from './deck';
import { buildPots, splitPot } from './pots';

export interface HandPlayer {
  seat: number;
  stack: number;
  startStack: number;
  bet: number; // 本輪下注
  total: number; // 本手總投入（含前注）
  cards: Card[];
  folded: boolean;
  allIn: boolean;
  acted: boolean; // 本輪是否已主動行動（付盲注不算）
  actedSeq: number; // 行動當下的完整加注序號，用來判斷加注權是否重新開放
}

export type HandPhase = 'betting' | 'street-end' | 'showdown' | 'complete';

export type HandEvent =
  | { t: 'post'; seat: number; kind: 'sb' | 'bb' | 'ante'; amount: number; allIn: boolean }
  | { t: 'act'; seat: number; action: ActionType; amount: number; to: number; allIn: boolean }
  | { t: 'collect'; seat: number; amount: number }
  | { t: 'refund'; seat: number; amount: number }
  | { t: 'street'; street: Street; cards: Card[] }
  | { t: 'reveal'; seat: number; cards: Card[] }
  | { t: 'win'; seat: number; amount: number; pot: number; hand: string | null };

export interface PotResult {
  amount: number;
  eligible: number[];
  winners: number[];
  hand: string | null;
}

export interface HandState {
  players: HandPlayer[]; // 依座位排序
  button: number;
  sb: number;
  bb: number;
  level: BlindLevel;
  pendingBoard: Card[]; // 尚未翻開的公牌，只存在伺服器
  board: Card[];
  street: Street;
  phase: HandPhase;
  toAct: number; // 座位號，-1 代表沒有人需要行動
  currentBet: number;
  lastFullRaise: number; // 最小加注額
  fullRaiseSeq: number;
  runout: boolean; // 已無人能下注，自動發完公牌
  results: PotResult[] | null;
  events: HandEvent[];
}

export type ActionResult = { ok: true; state: HandState } | { ok: false; error: string };

const NEXT_STREET: Record<Street, Street | null> = { preflop: 'flop', flop: 'turn', turn: 'river', river: null };
const BOARD_SIZE: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

// ---------- 小工具 ----------

export const playerAt = (s: HandState, seat: number) => s.players.find((p) => p.seat === seat)!;

/** 從某座位的下一位開始順時針排列（該座位若在其中會排最後） */
export function clockwiseAfter<T extends { seat: number }>(list: T[], seat: number): T[] {
  const sorted = [...list].sort((a, b) => a.seat - b.seat);
  const i = sorted.findIndex((p) => p.seat > seat);
  const start = i < 0 ? 0 : i;
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

const live = (s: HandState) => s.players.filter((p) => !p.folded);
const canAct = (p: HandPlayer) => !p.folded && !p.allIn;
const needsAction = (s: HandState, p: HandPlayer) => canAct(p) && (!p.acted || p.bet < s.currentBet);

function put(p: HandPlayer, amount: number) {
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.bet += paid;
  p.total += paid;
  if (p.stack === 0) p.allIn = true;
  return paid;
}

export function isBettingComplete(s: HandState): boolean {
  const alive = live(s);
  if (alive.length <= 1) return true;
  const actors = alive.filter((p) => !p.allIn);
  if (actors.length === 0) return true;
  if (actors.length === 1 && actors[0].bet >= s.currentBet) return true;
  return actors.every((p) => p.acted && p.bet === s.currentBet);
}

function nextTurn(s: HandState, fromSeat: number) {
  if (isBettingComplete(s)) {
    s.phase = 'street-end';
    s.toAct = -1;
  } else {
    s.phase = 'betting';
    s.toAct = clockwiseAfter(s.players, fromSeat).find((p) => needsAction(s, p))!.seat;
  }
}

// ---------- 開局 ----------

export interface NewHandInput {
  seats: { seat: number; stack: number }[]; // 存活且有籌碼的玩家
  button: number;
  level: BlindLevel;
  /** 測試用：指定牌序。第 k 位（依座位排序）拿 deck[2k]、deck[2k+1]，接著 5 張為公牌 */
  deck?: Card[];
}

/** 莊家按鈕順時針移到下一位存活玩家（簡化規則，不處理 dead button） */
export function nextButton(aliveSeats: number[], previous: number): number {
  return clockwiseAfter(aliveSeats.map((seat) => ({ seat })), previous)[0].seat;
}

export function blindSeats(seats: number[], button: number) {
  if (seats.length === 2) {
    // 單挑：莊家放小盲
    const other = seats.find((x) => x !== button)!;
    return { sb: button, bb: other };
  }
  const order = clockwiseAfter(seats.map((seat) => ({ seat })), button);
  return { sb: order[0].seat, bb: order[1].seat };
}

export function createHand({ seats, button, level, deck }: NewHandInput): HandState {
  if (seats.length < 2) throw new Error('至少需要 2 位玩家');
  const cards = deck ?? shuffle(newDeck());
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  const players: HandPlayer[] = sorted.map((x, k) => ({
    seat: x.seat,
    stack: x.stack,
    startStack: x.stack,
    bet: 0,
    total: 0,
    cards: [cards[2 * k], cards[2 * k + 1]],
    folded: false,
    allIn: false,
    acted: false,
    actedSeq: -1,
  }));
  const { sb, bb } = blindSeats(sorted.map((x) => x.seat), button);

  const s: HandState = {
    players,
    button,
    sb,
    bb,
    level,
    pendingBoard: cards.slice(2 * players.length, 2 * players.length + 5),
    board: [],
    street: 'preflop',
    phase: 'betting',
    toAct: -1,
    currentBet: level.bb,
    lastFullRaise: level.bb,
    fullRaiseSeq: 0,
    runout: false,
    results: null,
    events: [],
  };

  // 籌碼不足時以剩餘籌碼全下；BB ante 由大盲位在付完大盲後代付
  const sbp = playerAt(s, sb);
  s.events.push({ t: 'post', seat: sb, kind: 'sb', amount: put(sbp, level.sb), allIn: sbp.allIn });
  const bbp = playerAt(s, bb);
  s.events.push({ t: 'post', seat: bb, kind: 'bb', amount: put(bbp, level.bb), allIn: bbp.allIn });
  if (level.ante > 0 && bbp.stack > 0) {
    const ante = Math.min(level.ante, bbp.stack);
    bbp.stack -= ante;
    bbp.total += ante; // 前注是死錢：計入總投入，但不算本輪下注
    if (bbp.stack === 0) bbp.allIn = true;
    s.events.push({ t: 'post', seat: bb, kind: 'ante', amount: ante, allIn: bbp.allIn });
  }

  nextTurn(s, bb);
  return s;
}

// ---------- 下注 ----------

export function legalActions(s: HandState, seat: number): LegalActions | null {
  if (s.phase !== 'betting' || s.toAct !== seat) return null;
  const p = playerAt(s, seat);
  const toCall = Math.max(0, s.currentBet - p.bet);
  const maxTo = p.bet + p.stack;
  const othersCanRespond = s.players.some((o) => o.seat !== seat && canAct(o));
  const reopened = !p.acted || p.actedSeq < s.fullRaiseSeq;
  const canAggress = p.stack > toCall && othersCanRespond && reopened;
  const minTo = s.currentBet === 0 ? s.level.bb : s.currentBet + s.lastFullRaise;
  return {
    canFold: true,
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, p.stack),
    canBet: canAggress && s.currentBet === 0,
    canRaise: canAggress && s.currentBet > 0,
    minRaiseTo: Math.min(minTo, maxTo),
    maxRaiseTo: maxTo,
  };
}

export function applyAction(prev: HandState, seat: number, intent: PlayerIntent): ActionResult {
  const legal = legalActions(prev, seat);
  if (!legal) return { ok: false, error: '還沒輪到你' };
  const s = structuredClone(prev);
  const p = playerAt(s, seat);
  let type = intent.type;
  let to = Math.floor(Number(intent.amount));

  if (type === 'allin') {
    if (p.bet + p.stack <= s.currentBet) type = 'call';
    else if (legal.canBet || legal.canRaise) {
      type = s.currentBet === 0 ? 'bet' : 'raise';
      to = legal.maxRaiseTo;
    } else return { ok: false, error: '目前不能加注，只能跟注或棄牌' };
  }

  let paid = 0;
  switch (type) {
    case 'fold':
      p.folded = true;
      break;
    case 'check':
      if (!legal.canCheck) return { ok: false, error: '需要跟注，不能過牌' };
      break;
    case 'call':
      if (legal.canCheck) return { ok: false, error: '沒有人下注，請選擇過牌' };
      paid = put(p, legal.callAmount);
      break;
    case 'bet':
    case 'raise': {
      if (type === 'bet' ? !legal.canBet : !legal.canRaise) return { ok: false, error: type === 'bet' ? '目前不能下注' : '目前不能加注' };
      if (!Number.isFinite(to)) return { ok: false, error: '金額不正確' };
      if (to > legal.maxRaiseTo) return { ok: false, error: '籌碼不足' };
      if (to < legal.minRaiseTo) return { ok: false, error: `最少要${type === 'bet' ? '下注' : '加注到'} ${legal.minRaiseTo}` };
      const increase = to - s.currentBet;
      paid = put(p, to - p.bet);
      // 完整加注才更新最小加注額並重新開放加注權；不足額的全下不會
      if (increase >= s.lastFullRaise) {
        s.lastFullRaise = increase;
        s.fullRaiseSeq++;
      }
      s.currentBet = to;
      break;
    }
    default:
      return { ok: false, error: '未知的動作' };
  }

  p.acted = true;
  p.actedSeq = s.fullRaiseSeq;
  s.events.push({ t: 'act', seat, action: p.allIn && type !== 'fold' ? 'allin' : type, amount: paid, to: p.bet, allIn: p.allIn });
  nextTurn(s, seat);
  return { ok: true, state: s };
}

// ---------- 推進街道 / 攤牌 ----------

/** 退回沒人跟的下注，再把本輪下注收進底池 */
function collectBets(s: HandState) {
  const bets = s.players.map((p) => p.bet).sort((a, b) => b - a);
  if (bets[0] > (bets[1] ?? 0)) {
    const top = s.players.find((p) => p.bet === bets[0])!;
    const refund = bets[0] - (bets[1] ?? 0);
    top.bet -= refund;
    top.total -= refund;
    top.stack += refund;
    if (top.stack > 0) top.allIn = false;
    s.events.push({ t: 'refund', seat: top.seat, amount: refund });
  }
  for (const p of s.players) {
    if (p.bet > 0) s.events.push({ t: 'collect', seat: p.seat, amount: p.bet });
    p.bet = 0;
    p.acted = false;
    p.actedSeq = -1;
  }
  s.currentBet = 0;
  s.lastFullRaise = s.level.bb;
  s.fullRaiseSeq = 0;
}

function revealLive(s: HandState) {
  const shown = new Set(s.events.flatMap((e) => (e.t === 'reveal' ? [e.seat] : [])));
  for (const p of clockwiseAfter(live(s), s.button)) {
    if (!shown.has(p.seat)) s.events.push({ t: 'reveal', seat: p.seat, cards: p.cards });
  }
}

/** street-end 時呼叫：收籌碼並發下一街，或進入攤牌 / 結算 */
export function advance(prev: HandState): HandState {
  if (prev.phase !== 'street-end') return prev;
  const s = structuredClone(prev);
  collectBets(s);

  if (live(s).length === 1) return settle(s);

  // 剩不到兩人能行動 → 亮牌並自動發完公牌
  if (!s.runout && live(s).filter((p) => !p.allIn).length <= 1) {
    s.runout = true;
    revealLive(s);
  }

  const next = NEXT_STREET[s.street];
  if (!next) {
    revealLive(s);
    s.phase = 'showdown';
    s.toAct = -1;
    return s;
  }

  s.street = next;
  const cards = s.pendingBoard.slice(s.board.length, BOARD_SIZE[next]);
  s.board = [...s.board, ...cards];
  s.events.push({ t: 'street', street: next, cards });

  if (s.runout) {
    s.phase = 'street-end';
    s.toAct = -1;
  } else {
    nextTurn(s, s.button); // 翻牌後由莊家左手邊第一位開始
  }
  return s;
}

/** showdown 時呼叫：比牌並分配每個底池 */
export function showdown(prev: HandState): HandState {
  if (prev.phase !== 'showdown') return prev;
  return settle(structuredClone(prev));
}

function settle(s: HandState): HandState {
  const pots = buildPots(s.players.map((p) => ({ seat: p.seat, total: p.total, folded: p.folded })));
  const alive = live(s);
  const scores = new Map<number, Score>();
  if (alive.length > 1) for (const p of alive) scores.set(p.seat, bestHand([...p.cards, ...s.board]));
  const leftOfButton = clockwiseAfter(s.players, s.button).map((p) => p.seat);

  s.results = pots.map((pot, i) => {
    let winners: number[];
    let hand: string | null = null;
    if (pot.eligible.length === 1) {
      winners = pot.eligible;
    } else {
      const best = pot.eligible.reduce<Score>((b, seat) => (compareScore(scores.get(seat)!, b) > 0 ? scores.get(seat)! : b), scores.get(pot.eligible[0])!);
      winners = pot.eligible.filter((seat) => compareScore(scores.get(seat)!, best) === 0);
      hand = handName(best);
    }
    winners.sort((a, b) => leftOfButton.indexOf(a) - leftOfButton.indexOf(b));
    for (const [seat, amount] of splitPot(pot.amount, winners)) {
      playerAt(s, seat).stack += amount;
      s.events.push({ t: 'win', seat, amount, pot: i, hand: alive.length > 1 ? hand : null });
    }
    return { amount: pot.amount, eligible: pot.eligible, winners, hand };
  });

  for (const p of s.players) p.allIn = false;
  s.phase = 'complete';
  s.toAct = -1;
  return s;
}

/** 已收進底池的金額（不含本輪桌上的下注），分成主池與邊池 */
export function collectedPots(s: HandState) {
  return buildPots(s.players.map((p) => ({ seat: p.seat, total: p.total - p.bet, folded: p.folded })));
}
