// 一張牌桌的權威狀態。洗牌、發牌、計時、比牌都只在伺服器上進行，
// 客戶端只會收到自己的底牌（攤牌時才公開其他人的）。
import { bestHand, compareScore, HAND_NAMES } from '../shared/handEvaluator.js';
import { BIG_BLIND, BOARD_COUNT, SMALL_BLIND, STARTING_STACK, STREET_LABEL, TURN_SECONDS } from '../shared/constants.js';

const NEXT_STREET = { preflop: 'flop', flop: 'turn', turn: 'river' };
const BOT_NAMES = ['Alice', '阿明', 'Bob', '小美', 'Lucky7', 'Kenji', '老王', 'Sofia', 'Max'];
const BOT_AVATARS = ['🦊', '🐼', '🐯', '🐰', '🐸', '🦁', '🐨', '🐙', '🐵'];
const DISCONNECT_GRACE_MS = 30_000;

const fmt = (n) => n.toLocaleString('en-US');

function newDeck() {
  const d = [];
  for (const s of 'shdc') for (const r of '23456789TJQKA') d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export class Table {
  constructor(id, seatCount, onChange) {
    this.id = id;
    this.seatCount = seatCount;
    this.onChange = onChange;
    this.seats = Array(seatCount).fill(null);
    this.sockets = new Map(); // socketId → { socket, playerId }
    this.dealerIndex = -1;
    this.handId = 0;
    this.actionSeq = 0;
    this.botSeq = 0;
    this.flightSeq = 0;
    this.flights = []; // 尚未送出的籌碼動畫事件
    this.log = [];
    this.timer = null;
    this.resetHandState();
  }

  resetHandState() {
    Object.assign(this, {
      phase: 'waiting', // waiting → betting → roundEnd → (betting | awarding) → handOver
      street: 'preflop',
      board: [],
      pot: 0,
      currentBet: 0,
      minRaise: BIG_BLIND,
      acted: [],
      turnIndex: -1,
      turnDeadline: 0,
      result: null,
    });
  }

  // ---------- 入座 / 離開 ----------

  seatOf(id) {
    return this.seats.findIndex((p) => p?.id === id);
  }

  newPlayer(id, name, avatar, isBot) {
    return {
      id, name, avatar, isBot,
      chips: STARTING_STACK, bet: 0, total: 0,
      folded: false, allIn: false, inHand: false, cards: [],
      lastAction: this.phase === 'waiting' ? null : '等待中',
      connected: true, leaving: false,
    };
  }

  join(id, name, avatar) {
    const existing = this.seatOf(id);
    if (existing >= 0) {
      Object.assign(this.seats[existing], { connected: true, leaving: false, name, avatar });
      this.changed();
      return existing;
    }
    const i = this.seats.findIndex((s) => !s);
    if (i < 0) {
      this.changed(); // 桌滿：以旁觀者身分收到狀態
      return -1;
    }
    this.seats[i] = this.newPlayer(id, name, avatar, false);
    this.addLog(`${name} 入座`);
    this.changed();
    return i;
  }

  addBot() {
    const i = this.seats.findIndex((s) => !s);
    if (i < 0) return;
    const used = new Set(this.seats.filter(Boolean).map((p) => p.name));
    const k = Math.max(0, BOT_NAMES.findIndex((n) => !used.has(n)));
    this.seats[i] = this.newPlayer(`bot-${++this.botSeq}`, `${BOT_NAMES[k]}`, BOT_AVATARS[k], true);
    this.addLog(`🤖 ${BOT_NAMES[k]} 入座`);
    this.changed();
  }

  removeBot() {
    const bot = [...this.seats].reverse().find((p) => p?.isBot && !p.leaving);
    if (bot) this.leave(bot.id);
  }

  disconnect(id) {
    const p = this.seats[this.seatOf(id)];
    if (!p) return;
    p.connected = false;
    this.changed();
    setTimeout(() => {
      if (!p.connected && this.seats.includes(p)) this.leave(p.id);
    }, DISCONNECT_GRACE_MS);
  }

  leave(id) {
    const i = this.seatOf(id);
    const p = this.seats[i];
    if (!p) return;
    const handRunning = !['waiting', 'handOver'].includes(this.phase);
    if (p.inHand && handRunning) {
      p.leaving = true; // 輪到他時自動棄牌，這手結束後移除
    } else {
      this.seats[i] = null;
      this.addLog(`${p.name} 離開`);
    }
    this.changed();
  }

  get humanCount() {
    return this.seats.filter((p) => p && !p.isBot && p.connected).length;
  }

  // ---------- 牌局流程 ----------

  addLog(line) {
    this.log = [line, ...this.log].slice(0, 40);
  }

  flight(kind, playerIndex, amount) {
    if (amount > 0) this.flights.push({ id: ++this.flightSeq, kind, playerIndex, amount });
  }

  canPlay(p) {
    return p && !p.leaving && (p.connected || p.isBot) && p.chips > 0;
  }

  canStart() {
    return this.humanCount > 0 && this.seats.filter((p) => this.canPlay(p)).length >= 2;
  }

  nextInHand(from) {
    for (let k = 1; k <= this.seatCount; k++) {
      const i = (from + k + this.seatCount) % this.seatCount;
      if (this.seats[i]?.inHand) return i;
    }
    return -1;
  }

  nextToAct(from) {
    for (let k = 1; k <= this.seatCount; k++) {
      const i = (from + k) % this.seatCount;
      const p = this.seats[i];
      if (p?.inHand && !p.folded && !p.allIn) return i;
    }
    return -1;
  }

  setTurn(i) {
    this.actionSeq++;
    if (i < 0) {
      this.phase = 'roundEnd';
      this.turnIndex = -1;
    } else {
      this.turnIndex = i;
      this.turnDeadline = Date.now() + TURN_SECONDS * 1000;
    }
  }

  commit(i, amount) {
    const p = this.seats[i];
    const paid = Math.min(amount, p.chips);
    p.chips -= paid;
    p.bet += paid;
    p.total += paid;
    if (p.chips === 0) p.allIn = true;
    this.flight('bet', i, paid);
    return paid;
  }

  startHand() {
    for (const p of this.seats) {
      if (p && !p.leaving && p.chips < BIG_BLIND) {
        p.chips = STARTING_STACK; // 朋友局：輸光自動補碼
        this.addLog(`${p.name} 補碼 $${fmt(STARTING_STACK)}`);
      }
    }
    const deck = newDeck();
    for (const p of this.seats) {
      if (!p) continue;
      const play = this.canPlay(p);
      Object.assign(p, {
        bet: 0, total: 0, folded: false, allIn: false, inHand: play,
        cards: play ? [deck.pop(), deck.pop()] : [],
        lastAction: play ? null : '等待中',
      });
    }

    this.resetHandState();
    this.handId++;
    this.dealerIndex = this.nextInHand(this.dealerIndex < 0 ? -1 : this.dealerIndex);
    const headsUp = this.seats.filter((p) => p?.inHand).length === 2;
    const sb = headsUp ? this.dealerIndex : this.nextInHand(this.dealerIndex);
    const bb = this.nextInHand(sb);
    this.commit(sb, SMALL_BLIND);
    this.seats[sb].lastAction = '小盲';
    this.commit(bb, BIG_BLIND);
    this.seats[bb].lastAction = '大盲';

    Object.assign(this, { phase: 'betting', board: deck.splice(0, 5), currentBet: BIG_BLIND });
    this.addLog(`— 第 ${this.handId} 手開始 —`);
    this.setTurn(this.nextToAct(bb));
  }

  act(playerId, action) {
    if (this.phase !== 'betting' || this.seats[this.turnIndex]?.id !== playerId) return;
    const type = ['fold', 'check', 'call', 'raise'].includes(action?.type) ? action.type : 'fold';
    this.applyAction(type, Math.floor(Number(action?.amount)) || 0);
    this.changed();
  }

  applyAction(type, amount) {
    const i = this.turnIndex;
    const p = this.seats[i];
    const toCall = this.currentBet - p.bet;
    let label;
    let text;

    if (type === 'raise') {
      const target = Math.min(amount, p.bet + p.chips);
      if (target <= this.currentBet) {
        type = toCall > 0 ? 'call' : 'check';
      } else {
        this.commit(i, target - p.bet);
        if (target - this.currentBet >= this.minRaise) this.minRaise = target - this.currentBet;
        label = p.allIn ? 'All-in' : this.currentBet === 0 ? '下注' : '加注';
        text = `${label} $${fmt(target)}`;
        this.currentBet = target;
        this.acted = [];
      }
    }
    if (type === 'check' && toCall > 0) type = 'call';
    if (type === 'call') {
      const paid = this.commit(i, toCall);
      label = p.allIn ? 'All-in' : '跟注';
      text = `${label} $${fmt(paid)}`;
    } else if (type === 'check') {
      label = text = '過牌';
    } else if (type === 'fold') {
      p.folded = true;
      label = text = '棄牌';
    }

    p.lastAction = label;
    this.acted.push(p.id);
    this.addLog(`${p.name} ${text}`);

    if (this.isRoundComplete()) {
      this.actionSeq++;
      this.phase = 'roundEnd';
      this.turnIndex = -1;
    } else {
      this.setTurn(this.nextToAct(i));
    }
  }

  isRoundComplete() {
    const live = this.seats.filter((p) => p?.inHand && !p.folded);
    if (live.length <= 1) return true;
    const canAct = live.filter((p) => !p.allIn);
    if (canAct.length === 0) return true;
    if (canAct.length === 1 && canAct[0].bet >= this.currentBet) return true;
    return canAct.every((p) => this.acted.includes(p.id) && p.bet === this.currentBet);
  }

  endRound() {
    this.seats.forEach((p, i) => {
      if (!p?.inHand) return;
      if (p.bet > 0) {
        this.pot += p.bet;
        this.flight('collect', i, p.bet);
        p.bet = 0;
      }
      if (!p.folded && !p.allIn) p.lastAction = null;
    });
    Object.assign(this, { currentBet: 0, minRaise: BIG_BLIND, acted: [], turnIndex: -1 });

    const live = this.seats.filter((p) => p?.inHand && !p.folded);
    if (live.length === 1) {
      this.phase = 'awarding';
    } else if (this.street === 'river') {
      this.street = 'showdown';
      this.phase = 'awarding';
      this.addLog('— 攤牌 —');
    } else {
      this.street = NEXT_STREET[this.street];
      this.addLog(`— ${STREET_LABEL[this.street]} —`);
      // 剩一人可行動（其他人 All-in）→ 停在 roundEnd，自動發完公牌
      if (live.filter((p) => !p.allIn).length > 1) {
        this.phase = 'betting';
        this.setTurn(this.nextToAct(this.dealerIndex));
      }
    }
  }

  // 依各玩家投入總額切分主池 / 邊池
  award() {
    const inHand = this.seats.map((p, i) => ({ p, i })).filter((x) => x.p?.inHand);
    const live = inHand.filter((x) => !x.p.folded);
    const won = new Map();
    let handName = null;

    if (live.length === 1) {
      won.set(live[0].i, this.pot);
    } else {
      const score = new Map(live.map((x) => [x.i, bestHand([...x.p.cards, ...this.board])]));
      const levels = [...new Set(live.map((x) => x.p.total))].sort((a, b) => a - b);
      let prev = 0;
      let distributed = 0;
      for (const level of levels) {
        const amount = inHand.reduce((s, x) => s + Math.max(0, Math.min(x.p.total, level) - prev), 0);
        const eligible = live.filter((x) => x.p.total >= level);
        const best = eligible.reduce((b, x) => (compareScore(score.get(x.i), b) > 0 ? score.get(x.i) : b), score.get(eligible[0].i));
        const winners = eligible.filter((x) => compareScore(score.get(x.i), best) === 0);
        const share = Math.floor(amount / winners.length);
        winners.forEach((x, k) => {
          won.set(x.i, (won.get(x.i) ?? 0) + share + (k === 0 ? amount - share * winners.length : 0));
        });
        distributed += amount;
        prev = level;
      }
      if (this.pot > distributed) {
        const first = won.keys().next().value;
        won.set(first, won.get(first) + this.pot - distributed);
      }
      const top = live.reduce((b, x) => (compareScore(score.get(x.i), b) > 0 ? score.get(x.i) : b), score.get(live[0].i));
      handName = HAND_NAMES[top[0]];
    }

    const parts = [];
    for (const [i, amount] of won) {
      if (amount <= 0) continue;
      const p = this.seats[i];
      p.chips += amount;
      p.lastAction = '贏家';
      this.flight('win', i, amount);
      parts.push(`${p.name} 贏得 $${fmt(amount)}`);
    }
    const text = `${parts.join('、')}${handName ? `（${handName}）` : ''}`;
    this.result = { winners: [...won.keys()], text };
    this.pot = 0;
    this.phase = 'handOver';
    this.addLog(text);
  }

  finishHand() {
    this.seats.forEach((p, i) => {
      if (p?.leaving) {
        this.seats[i] = null;
        this.addLog(`${p.name} 離開`);
      }
    });
    if (this.canStart()) {
      this.startHand();
    } else {
      this.resetHandState();
      this.seats.forEach((p) => p && Object.assign(p, { inHand: false, cards: [], bet: 0, folded: false, allIn: false, lastAction: null }));
    }
  }

  botDecide() {
    const p = this.seats[this.turnIndex];
    const toCall = this.currentBet - p.bet;
    const potTotal = this.pot + this.seats.reduce((s, x) => s + (x?.bet ?? 0), 0);
    const sized = this.currentBet + Math.round((potTotal * (0.5 + Math.random() * 0.5)) / 10) * 10;
    const raiseTo = Math.min(p.bet + p.chips, Math.max(this.currentBet + this.minRaise, sized));
    const r = Math.random();
    if (toCall === 0) return r < 0.72 ? ['check'] : ['raise', raiseTo];
    if (r < 0.18) return ['fold'];
    if (r < 0.88 || p.chips <= toCall) return ['call'];
    return ['raise', raiseTo];
  }

  // 依目前階段排定下一個自動步驟（電腦行動、逾時、發下一街…）
  schedule() {
    clearTimeout(this.timer);
    const later = (ms, fn) => {
      this.timer = setTimeout(() => {
        fn();
        this.changed();
      }, Math.max(0, ms));
    };

    switch (this.phase) {
      case 'waiting':
        if (this.canStart()) later(1500, () => this.canStart() && this.startHand());
        break;
      case 'betting': {
        const p = this.seats[this.turnIndex];
        if (p.isBot) {
          later(900 + Math.random() * 1500, () => this.applyAction(...this.botDecide()));
        } else {
          const away = !p.connected || p.leaving;
          const timeoutAction = () => this.applyAction(this.currentBet > p.bet ? 'fold' : 'check');
          later(away ? 1500 : this.turnDeadline - Date.now(), timeoutAction);
        }
        break;
      }
      case 'roundEnd':
        later(650, () => this.endRound());
        break;
      case 'awarding':
        later(this.street === 'showdown' ? 1400 : 700, () => this.award());
        break;
      case 'handOver':
        later(3500, () => this.finishHand());
        break;
    }
  }

  changed() {
    this.schedule();
    this.onChange(this);
  }

  destroy() {
    clearTimeout(this.timer);
  }

  // ---------- 送給特定玩家的畫面（隱藏別人的底牌與未翻開的公牌） ----------

  viewFor(playerId) {
    const heroIndex = this.seatOf(playerId);
    const reveal = this.street === 'showdown' && ['awarding', 'handOver'].includes(this.phase);
    return {
      room: this.id,
      seatCount: this.seatCount,
      heroIndex,
      players: this.seats.map((p, i) => {
        if (!p) return null;
        const show = i === heroIndex || (reveal && p.inHand && !p.folded);
        return {
          id: i,
          name: p.name,
          avatar: p.avatar,
          isBot: p.isBot,
          isHero: i === heroIndex,
          chips: p.chips,
          bet: p.bet,
          folded: p.folded,
          allIn: p.allIn,
          inHand: p.inHand,
          connected: p.connected,
          lastAction: p.lastAction,
          cards: show ? p.cards : p.cards.map(() => null),
        };
      }),
      board: this.board.slice(0, this.phase === 'waiting' ? 0 : BOARD_COUNT[this.street]),
      street: this.street,
      phase: this.phase,
      pot: this.pot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerIndex: this.dealerIndex,
      turnIndex: this.turnIndex,
      turnEndsIn: this.phase === 'betting' ? Math.max(0, this.turnDeadline - Date.now()) : 0,
      turnSeconds: TURN_SECONDS,
      actionSeq: this.actionSeq,
      handId: this.handId,
      result: this.result,
      log: this.log,
    };
  }
}
