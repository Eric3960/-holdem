// 一個房間（一場錦標賽）：大廳 → 比賽中 → 結束。
// 規則全部交給 engine；這裡只負責玩家、計時器、時間銀行與事件轉換。
import { randomInt } from 'node:crypto';
import type { Flight, HandRecord, PlayerIntent, RoomSettings } from '../shared/types';
import { DEFAULT_SETTINGS, MAX_PLAYERS, MIN_PLAYERS, SETTING_LIMITS, STARTING_STACK } from '../shared/types';
import { blindLevel } from '../shared/blinds';
import { advance, applyAction, createHand, legalActions, nextButton, showdown, type HandState } from './engine/hand';
import { canRebuy, levelAt, type BustGroup } from './engine/tournament';
import { describeEvent } from './describe';

/** 測試用加速時鐘：TIME_SCALE=20 時，錦標賽時鐘快 20 倍（行動計時不受影響） */
export const TIME_SCALE = Math.max(1, Number(process.env.TIME_SCALE) || 1);

const LOBBY_DISCONNECT_MS = 60_000;
const NEXT_HAND_DELAY_MS = 3500;
const REBUY_WAIT_MS = 30_000;
const AWAY_ACT_DELAY_MS = 400;
const HISTORY_SIZE = 20;

export interface RoomPlayer {
  token: string;
  seat: number;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  away: boolean;
  stack: number;
  timeBankMs: number;
  rebuys: number;
  eliminated: boolean;
  bustLevel: number | null;
  lastAction: string | null;
}

export interface Turn {
  seat: number;
  deadline: number;
  usingBank: boolean;
  bankStart: number;
  totalMs: number;
}

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

const BOT_NAMES = ['Alice', '阿明', 'Bob', '小美', 'Lucky7', 'Kenji', '老王', 'Sofia', 'Max'];
const BOT_AVATARS = ['🦊', '🐼', '🐯', '🐰', '🐸', '🦁', '🐨', '🐙', '🐵'];

export class Room {
  status: 'lobby' | 'running' | 'finished' = 'lobby';
  settings: RoomSettings = { ...DEFAULT_SETTINGS };
  players: RoomPlayer[] = []; // 陣列索引 = 座位
  startedAt: number | null = null;
  button = -1;
  handNo = 0;
  hand: HandState | null = null;
  busts: BustGroup[] = [];
  history: HandRecord[] = [];
  turn: Turn | null = null;
  nextHandAt: number | null = null;
  rebuyWaitUntil: number | null = null;
  endReason: string | null = null;
  shown = new Set<number>();
  flights: Flight[] = [];
  private flightSeq = 0;
  private eventCursor = 0;
  private timer: NodeJS.Timeout | undefined;
  private botSeq = 0;

  constructor(
    public code: string,
    public hostToken: string,
    private onChange: (room: Room) => void,
  ) {}

  // ---------- 時鐘 ----------

  elapsed(now = Date.now()) {
    return this.startedAt === null ? 0 : (now - this.startedAt) * TIME_SCALE;
  }

  clock(now = Date.now()) {
    return levelAt(this.elapsed(now), this.settings);
  }

  /** 錦標賽時鐘上的毫秒 → 真實時間戳 */
  realTime(elapsedMs: number) {
    return (this.startedAt ?? Date.now()) + elapsedMs / TIME_SCALE;
  }

  get alive() {
    return this.players.filter((p) => !p.eliminated);
  }

  playerOf(token: string) {
    return this.players.find((p) => p.token === token);
  }

  // ---------- 大廳 ----------

  join(token: string, name: string, avatar: string): Result {
    const existing = this.playerOf(token);
    if (existing) {
      existing.connected = true;
      if (this.status === 'lobby') Object.assign(existing, { name, avatar });
      this.ensureHost();
      this.changed();
      return { ok: true };
    }
    if (this.status !== 'lobby') {
      this.changed(); // 以旁觀者身分收到畫面
      return { ok: true };
    }
    if (this.players.length >= MAX_PLAYERS) return fail('房間已滿（最多 9 人）');
    this.addPlayer(token, name, avatar, false);
    this.changed();
    return { ok: true };
  }

  private addPlayer(token: string, name: string, avatar: string, isBot: boolean) {
    this.players.push({
      token,
      seat: this.players.length,
      name,
      avatar,
      isBot,
      connected: true,
      away: false,
      stack: STARTING_STACK,
      timeBankMs: this.settings.timeBankSeconds * 1000,
      rebuys: 0,
      eliminated: false,
      bustLevel: null,
      lastAction: null,
    });
  }

  private removeFromLobby(token: string) {
    this.players = this.players.filter((p) => p.token !== token);
    this.players.forEach((p, i) => (p.seat = i));
    this.ensureHost();
  }

  /** 房主斷線時移交給下一位在線玩家 */
  private ensureHost() {
    const host = this.playerOf(this.hostToken);
    if (host?.connected) return;
    const next = this.players.find((p) => !p.isBot && p.connected);
    if (next) this.hostToken = next.token;
  }

  disconnect(token: string) {
    const p = this.playerOf(token);
    if (!p) return;
    p.connected = false;
    this.ensureHost();
    if (this.status === 'lobby') {
      setTimeout(() => {
        if (this.status === 'lobby' && !p.connected) {
          this.removeFromLobby(token);
          this.changed();
        }
      }, LOBBY_DISCONNECT_MS);
    }
    this.changed();
  }

  updateSettings(token: string, patch: Partial<RoomSettings>): Result {
    if (token !== this.hostToken) return fail('只有房主可以修改設定');
    if (this.status !== 'lobby') return fail('比賽已開始');
    const s = { ...this.settings };
    for (const key of ['levelMinutes', 'actionSeconds', 'timeBankSeconds', 'timeLimitMinutes'] as const) {
      const v = Number(patch[key]);
      if (patch[key] !== undefined && Number.isFinite(v)) {
        const [min, max] = SETTING_LIMITS[key];
        s[key] = Math.min(max, Math.max(min, Math.round(v)));
      }
    }
    if (typeof patch.allowRebuy === 'boolean') s.allowRebuy = patch.allowRebuy;
    if (patch.timeLimitMode === 'sudden-death' || patch.timeLimitMode === 'chip-count') s.timeLimitMode = patch.timeLimitMode;
    this.settings = s;
    for (const p of this.players) p.timeBankMs = s.timeBankSeconds * 1000;
    this.changed();
    return { ok: true };
  }

  addBot(token: string): Result {
    if (token !== this.hostToken || this.status !== 'lobby') return fail('只有房主能在開賽前加入電腦玩家');
    if (this.players.length >= MAX_PLAYERS) return fail('房間已滿');
    const used = new Set(this.players.map((p) => p.name));
    const k = Math.max(0, BOT_NAMES.findIndex((n) => !used.has(n)));
    this.addPlayer(`bot-${++this.botSeq}`, BOT_NAMES[k], BOT_AVATARS[k], true);
    this.changed();
    return { ok: true };
  }

  removeBot(token: string): Result {
    if (token !== this.hostToken || this.status !== 'lobby') return fail('只有房主能在開賽前移除電腦玩家');
    const bot = [...this.players].reverse().find((p) => p.isBot);
    if (bot) this.removeFromLobby(bot.token);
    this.changed();
    return { ok: true };
  }

  start(token: string): Result {
    if (token !== this.hostToken) return fail('只有房主可以開始比賽');
    if (this.status !== 'lobby') return fail('比賽已經開始');
    if (this.players.length < MIN_PLAYERS) return fail('至少需要 2 位玩家');
    this.status = 'running';
    this.startedAt = Date.now();
    for (const p of this.players) Object.assign(p, { stack: STARTING_STACK, timeBankMs: this.settings.timeBankSeconds * 1000 });
    this.nextHandAt = Date.now() + 2000;
    this.changed();
    return { ok: true };
  }

  // ---------- 比賽中的玩家操作 ----------

  act(token: string, intent: PlayerIntent): Result {
    const p = this.playerOf(token);
    if (!p || !this.hand) return fail('目前不能行動');
    const r = this.perform(p.seat, intent);
    this.changed();
    return r;
  }

  setAway(token: string, away: boolean) {
    const p = this.playerOf(token);
    if (!p || this.status === 'lobby') return;
    p.away = away;
    this.changed();
  }

  rebuy(token: string): Result {
    const p = this.playerOf(token);
    if (!p || this.status !== 'running' || !canRebuy(p, this.settings, this.clock().level)) return fail('目前不能重新進場');
    Object.assign(p, { stack: STARTING_STACK, eliminated: false, rebuys: 1, bustLevel: null, lastAction: '重新進場' });
    this.busts = this.busts
      .map((g) => ({ ...g, players: g.players.filter((b) => b.seat !== p.seat) }))
      .filter((g) => g.players.length > 0);
    this.addHistoryLine(`${p.name} 重新進場（${STARTING_STACK.toLocaleString('en-US')}）`);
    if (this.rebuyWaitUntil && this.alive.length >= MIN_PLAYERS) {
      this.rebuyWaitUntil = null;
      this.nextHandAt = Date.now() + 2000;
    }
    this.changed();
    return { ok: true };
  }

  showCards(token: string) {
    const p = this.playerOf(token);
    const h = this.hand;
    if (!p || !h || h.phase !== 'complete') return;
    const live = h.players.filter((x) => !x.folded);
    if (live.length === 1 && live[0].seat === p.seat && !this.shown.has(p.seat)) {
      this.shown.add(p.seat);
      this.addHistoryLine(`${p.name} 選擇亮牌`);
      this.changed();
    }
  }

  // ---------- 牌局流程 ----------

  private perform(seat: number, intent: PlayerIntent): Result {
    if (!this.hand) return fail('目前沒有進行中的牌局');
    const r = applyAction(this.hand, seat, intent);
    if (!r.ok) return r;
    const t = this.turn;
    if (t?.usingBank) {
      const p = this.players[seat];
      p.timeBankMs = Math.max(0, p.timeBankMs - (Date.now() - t.bankStart));
    }
    this.hand = r.state;
    this.progress();
    return { ok: true };
  }

  private autoAct(seat: number) {
    if (!this.hand) return;
    const legal = legalActions(this.hand, seat);
    if (legal) this.perform(seat, { type: legal.canCheck ? 'check' : 'fold' });
  }

  private startHand() {
    this.nextHandAt = null;
    const clock = this.clock();
    if (this.settings.timeLimitMode === 'chip-count' && clock.overtime) return this.finish('時間到，依籌碼多寡排名');
    const alive = this.alive;
    if (alive.length < MIN_PLAYERS) return this.finish('冠軍誕生');

    const seats = alive.map((p) => p.seat);
    this.button = this.button < 0 ? seats[randomInt(seats.length)] : nextButton(seats, this.button);
    const level = blindLevel(clock.level);
    this.hand = createHand({ seats: alive.map((p) => ({ seat: p.seat, stack: p.stack })), button: this.button, level });
    this.handNo++;
    this.eventCursor = 0;
    this.shown.clear();
    for (const p of this.players) p.lastAction = null;
    const ante = level.ante ? `，前注 ${level.ante}` : '';
    this.history.unshift({ handNo: this.handNo, level: level.level, lines: [`級別 ${level.level}：盲注 ${level.sb}/${level.bb}${ante}`] });
    this.history.length = Math.min(this.history.length, HISTORY_SIZE);
    this.progress();
  }

  /** 每次牌局狀態改變後：轉換事件、處理計時、結算 */
  private progress() {
    const h = this.hand!;
    for (const e of h.events.slice(this.eventCursor)) {
      const d = describeEvent(e, h, (seat) => this.players[seat].name);
      if (d.flight) this.flights.push({ id: ++this.flightSeq, ...d.flight });
      if (d.line) this.addHistoryLine(d.line);
      if (d.lastAction !== undefined) this.players[d.seat!].lastAction = d.lastAction;
      if (e.t === 'street') {
        for (const hp of h.players) if (!hp.folded && !hp.allIn) this.players[hp.seat].lastAction = null;
      }
    }
    this.eventCursor = h.events.length;

    if (h.phase === 'betting') {
      const ms = this.settings.actionSeconds * 1000;
      this.turn = { seat: h.toAct, deadline: Date.now() + ms, usingBank: false, bankStart: 0, totalMs: ms };
    } else {
      this.turn = null;
    }
    if (h.phase === 'complete') this.finishHand();
  }

  private finishHand() {
    const h = this.hand!;
    const busted = h.players.filter((hp) => hp.stack === 0);
    for (const hp of h.players) this.players[hp.seat].stack = hp.stack;
    if (busted.length) {
      this.busts.push({ handNo: this.handNo, players: busted.map((hp) => ({ seat: hp.seat, startStack: hp.startStack })) });
      for (const hp of busted) {
        Object.assign(this.players[hp.seat], { eliminated: true, bustLevel: h.level.level, lastAction: '淘汰' });
        this.addHistoryLine(`${this.players[hp.seat].name} 被淘汰`);
      }
    }

    const clock = this.clock();
    if (this.alive.length < MIN_PLAYERS) {
      const waiting = this.players.some((p) => !p.isBot && p.connected && canRebuy(p, this.settings, clock.level));
      if (waiting) this.rebuyWaitUntil = Date.now() + REBUY_WAIT_MS;
      else this.finish('冠軍誕生');
    } else if (this.settings.timeLimitMode === 'chip-count' && clock.overtime) {
      this.finish('時間到，依籌碼多寡排名');
    } else {
      this.nextHandAt = Date.now() + NEXT_HAND_DELAY_MS;
    }
  }

  private finish(reason: string) {
    this.status = 'finished';
    this.endReason = reason;
    this.nextHandAt = null;
    this.rebuyWaitUntil = null;
    this.turn = null;
  }

  private addHistoryLine(line: string) {
    this.history[0]?.lines.push(line);
  }

  // ---------- 排程：依目前狀態安排下一個自動步驟 ----------

  private schedule() {
    clearTimeout(this.timer);
    if (this.status !== 'running') return;
    const later = (ms: number, fn: () => void) => {
      this.timer = setTimeout(() => {
        fn();
        this.changed();
      }, Math.max(0, ms));
    };
    const now = Date.now();

    if (this.rebuyWaitUntil) {
      return later(this.rebuyWaitUntil - now, () => this.alive.length < MIN_PLAYERS && this.finish('冠軍誕生'));
    }
    const h = this.hand;
    if (!h || h.phase === 'complete') {
      if (this.nextHandAt) later(this.nextHandAt - now, () => this.startHand());
      return;
    }
    if (h.phase === 'street-end') {
      return later(h.runout ? 1100 : 700, () => {
        this.hand = advance(this.hand!);
        this.progress();
      });
    }
    if (h.phase === 'showdown') {
      return later(1500, () => {
        this.hand = showdown(this.hand!);
        this.progress();
      });
    }

    // betting
    const actor = this.players[h.toAct];
    const turn = this.turn!;
    if (actor.isBot) return later(900 + Math.random() * 1600, () => this.botAct(actor.seat));
    if (!actor.connected || actor.away) return later(AWAY_ACT_DELAY_MS, () => this.autoAct(actor.seat));
    later(turn.deadline - now, () => {
      if (!turn.usingBank && actor.timeBankMs > 0) {
        // 行動時間用完 → 開始扣時間銀行
        Object.assign(turn, { usingBank: true, bankStart: turn.deadline, deadline: turn.deadline + actor.timeBankMs, totalMs: actor.timeBankMs });
      } else {
        if (turn.usingBank) actor.timeBankMs = 0;
        this.autoAct(actor.seat);
      }
    });
  }

  private botAct(seat: number) {
    const h = this.hand!;
    const legal = legalActions(h, seat);
    if (!legal) return;
    const pot = h.players.reduce((s, p) => s + p.total, 0);
    const sized = (frac: number) => Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round((h.currentBet + pot * frac) / 100) * 100));
    const r = Math.random();
    const aggressive = legal.canBet || legal.canRaise;
    let intent: PlayerIntent;
    if (legal.canCheck) intent = r < 0.7 || !aggressive ? { type: 'check' } : { type: legal.canBet ? 'bet' : 'raise', amount: sized(0.6) };
    else if (r < 0.2) intent = { type: 'fold' };
    else if (r < 0.9 || !aggressive) intent = { type: 'call' };
    else intent = { type: 'raise', amount: sized(1) };
    if (!this.perform(seat, intent).ok) this.autoAct(seat);
  }

  changed() {
    this.schedule();
    this.onChange(this);
  }

  destroy() {
    clearTimeout(this.timer);
  }
}
