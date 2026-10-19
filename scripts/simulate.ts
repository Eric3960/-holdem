// 模擬一整場錦標賽：TIME_SCALE=60 npx tsx server/index.ts 後執行 npx tsx scripts/simulate.ts
import { io, type Socket } from 'socket.io-client';
import type { TableView } from '../shared/types';

const URL = process.env.URL ?? 'http://localhost:3001';
const stats = { states: 0, leaks: 0, chipErrors: 0, rejected: 0, illegalAccepted: 0, rebuys: 0, maxLevel: 0, hands: 0, reconnectOk: false };
let last: TableView | null = null;
let rebuyTotal = 0;

function client(name: string, code: string | undefined, onCode?: (c: string) => void): Promise<Socket> {
  return new Promise((resolve) => {
    const token = `sim-${name}`;
    const s: Socket = io(URL, { transports: ['websocket'] });
    s.on('connect', () =>
      s.emit('join', { code, name, avatar: '🦊', token }, (r: { ok: boolean; code?: string; error?: string }) => {
        if (!r.ok) throw new Error(r.error);
        onCode?.(r.code!);
        resolve(s);
      }),
    );
    s.on('state', (v: TableView) => {
      stats.states++;
      last = v;
      stats.maxLevel = Math.max(stats.maxLevel, v.hand?.level.level ?? 0);
      stats.hands = Math.max(stats.hands, v.hand?.handNo ?? 0);
      // 安全性：下注中不該看到別人的底牌
      if (v.hand?.phase === 'betting' && v.players.some((p) => !p.isMe && p.cards.some(Boolean))) stats.leaks++;
      // 籌碼守恆（下注中檢查）
      if (v.hand?.phase === 'betting') {
        const total = v.players.reduce((a, p) => a + p.stack + p.bet, 0) + v.hand.pots.reduce((a, p) => a + p.amount, 0);
        const expected = (v.tournament.entrants + rebuyTotal) * 10000;
        if (total % 10000 !== 0 || total < expected - 10000 * stats.rebuys) stats.chipErrors++;
      }
      if (v.tournament.canRebuy && Math.random() < 0.5) {
        stats.rebuys++;
        rebuyTotal++;
        s.emit('rebuy');
      }
      if (v.legal && v.turn?.seat === v.mySeat) {
        const L = v.legal;
        setTimeout(() => {
          // 偶爾故意送出不合法的加注，確認伺服器會拒絕
          if (Math.random() < 0.1 && (L.canRaise || L.canBet) && L.minRaiseTo < L.maxRaiseTo) {
            s.emit('act', { type: L.canBet ? 'bet' : 'raise', amount: L.minRaiseTo - 1 }, (r: { ok: boolean }) => (r.ok ? stats.illegalAccepted++ : stats.rejected++));
            return;
          }
          const r = Math.random();
          let intent;
          if ((L.canRaise || L.canBet) && r < 0.08) intent = { type: 'allin' };
          else if ((L.canRaise || L.canBet) && r < 0.25) intent = { type: L.canBet ? 'bet' : 'raise', amount: L.minRaiseTo + Math.floor(Math.random() * (L.maxRaiseTo - L.minRaiseTo) * 0.3) };
          else if (L.canCheck) intent = { type: 'check' };
          else if (r < 0.75) intent = { type: 'call' };
          else intent = { type: 'fold' };
          s.emit('act', intent, () => {});
        }, 30);
      }
    });
  });
}

let code = '';
const host = await client('Host', undefined, (c) => (code = c));
const others = await Promise.all(['P2', 'P3', 'P4'].map((n) => client(n, code)));
host.emit('addBot');
host.emit('addBot');
host.emit('updateSettings', { levelMinutes: 4, timeLimitMinutes: 30, timeLimitMode: (process.env.MODE as any) ?? 'sudden-death' });
await new Promise((r) => setTimeout(r, 300));
host.emit('start', (r: { ok: boolean; error?: string }) => console.log('start:', r));

// 斷線重連：P2 斷線 3 秒後用同一個 token 回來
setTimeout(async () => {
  const seatBefore = last ? (others[0] as any) : null;
  others[0].disconnect();
  await new Promise((r) => setTimeout(r, 3000));
  const s2 = await client('P2', code);
  s2.once('state', (v: TableView) => (stats.reconnectOk = v.mySeat >= 0 && v.players[v.mySeat].name === 'P2' && v.players[v.mySeat].connected));
}, 8000);

const deadline = Date.now() + 420_000;
while (Date.now() < deadline && last?.tournament.status !== 'finished') await new Promise((r) => setTimeout(r, 500));
const v = last as TableView | null;
console.log(JSON.stringify({ mode: process.env.MODE ?? 'sudden-death', ...stats, status: v?.tournament.status, endReason: v?.tournament.endReason, standings: v?.tournament.standings?.map((s) => `${s.place}. ${s.name} ${s.stack}`) }, null, 1));
process.exit(0);
