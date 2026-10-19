// 依玩家身分產生畫面資料。安全性集中在這裡：
// 只有自己的底牌、或已亮出的牌才會出現在資料中；未翻開的公牌與牌堆永遠不送出。
import type { HandView, SeatView, TableView, TournamentView } from '../shared/types';
import { blindLevel } from '../shared/blinds';
import { collectedPots, legalActions } from './engine/hand';
import { canRebuy, standings } from './engine/tournament';
import type { Room } from './room';

const fmt = (n: number) => n.toLocaleString('en-US');

export function buildView(room: Room, token: string): TableView {
  const now = Date.now();
  const me = room.playerOf(token);
  const mySeat = me?.seat ?? -1;
  const h = room.hand;
  const finished = room.status === 'finished';
  const clock = room.clock(now);

  const places = new Map(
    standings(
      room.alive.map((p) => ({ seat: p.seat, stack: p.stack })),
      room.busts,
      finished,
    ).map((x) => [x.seat, x.place]),
  );

  const revealed = new Set(room.shown);
  for (const e of h?.events ?? []) if (e.t === 'reveal') revealed.add(e.seat);

  const players: SeatView[] = room.players.map((p) => {
    const hp = h?.players.find((x) => x.seat === p.seat);
    return {
      seat: p.seat,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      isHost: p.token === room.hostToken,
      isMe: p.seat === mySeat,
      stack: hp ? hp.stack : p.stack,
      bet: hp?.bet ?? 0,
      inHand: !!hp,
      folded: hp?.folded ?? false,
      allIn: hp?.allIn ?? false,
      connected: p.isBot || p.connected,
      away: p.away,
      eliminated: p.eliminated,
      place: places.get(p.seat) ?? null,
      timeBank: Math.ceil(p.timeBankMs / 1000),
      cards: hp ? (p.seat === mySeat || revealed.has(p.seat) ? hp.cards : hp.cards.map(() => null)) : [],
      lastAction: p.lastAction,
    };
  });

  let hand: HandView | null = null;
  if (h) {
    const complete = h.phase === 'complete';
    const pots = complete ? [] : collectedPots(h);
    const winners = [...new Set((h.results ?? []).flatMap((r) => r.winners))];
    const live = h.players.filter((p) => !p.folded);
    const won = new Map<number, number>();
    for (const e of h.events) if (e.t === 'win') won.set(e.seat, (won.get(e.seat) ?? 0) + e.amount);
    const handName = h.results?.find((r) => r.hand)?.hand;
    hand = {
      handNo: room.handNo,
      level: h.level,
      street: h.street,
      phase: h.phase,
      board: h.board,
      pots: pots.map((p, i) => ({ amount: p.amount, label: pots.length === 1 ? '底池' : i === 0 ? '主池' : `邊池 ${i}` })),
      toAct: h.toAct,
      currentBet: h.currentBet,
      button: h.button,
      sb: h.sb,
      bb: h.bb,
      winners,
      resultText: complete
        ? [...won].map(([seat, amt]) => `${room.players[seat].name} 贏得 ${fmt(amt)}`).join('、') + (handName ? `（${handName}）` : '')
        : null,
      canShow: complete && live.length === 1 && live[0].seat === mySeat && !room.shown.has(mySeat),
    };
  }

  const busted = room.busts.flatMap((g) => g.players.map((b) => ({ seat: b.seat, name: room.players[b.seat].name, place: places.get(b.seat) ?? null, handNo: g.handNo })));

  const tournament: TournamentView = {
    status: room.status,
    settings: room.settings,
    startedAt: room.startedAt,
    level: blindLevel(room.status === 'lobby' ? 1 : clock.level),
    nextLevelAt: room.startedAt && clock.nextChangeAt !== null ? room.realTime(clock.nextChangeAt) : null,
    timeLimitAt: room.startedAt ? room.realTime(room.settings.timeLimitMinutes * 60_000) : null,
    overtime: room.status !== 'lobby' && clock.overtime,
    timeScale: room.status === 'lobby' ? 1 : Number(process.env.TIME_SCALE) || 1,
    entrants: room.players.length,
    remaining: room.alive.length,
    eliminations: busted.reverse(),
    standings: finished
      ? [...places].sort((a, b) => a[1] - b[1]).map(([seat, place]) => {
          const p = room.players[seat];
          return { place, seat, name: p.name, avatar: p.avatar, stack: p.stack };
        })
      : null,
    endReason: room.endReason,
    canRebuy: !!me && room.status === 'running' && canRebuy(me, room.settings, clock.level),
    rebuyWaitUntil: room.rebuyWaitUntil,
    message: room.rebuyWaitUntil ? '等待被淘汰的玩家決定是否重新進場…' : null,
  };

  return {
    code: room.code,
    mySeat,
    isHost: token === room.hostToken,
    serverNow: now,
    players,
    hand,
    legal: h && mySeat >= 0 ? legalActions(h, mySeat) : null,
    turn: room.turn ? { seat: room.turn.seat, deadline: room.turn.deadline, usingBank: room.turn.usingBank, totalMs: room.turn.totalMs } : null,
    tournament,
    history: room.history,
    flights: [],
  };
}
