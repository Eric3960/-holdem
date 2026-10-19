import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server, type Socket } from 'socket.io';
import type { Ack, ClientToServer, ServerToClient } from '../shared/types';
import { AVATARS } from '../shared/types';
import { Room, TIME_SCALE } from './room';
import { buildView } from './view';

const PORT = Number(process.env.PORT) || 3001;
const EMPTY_ROOM_TTL_MS = 30 * 60_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易看錯的 I、O、0、1
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();
const server = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(server);

app.get('/healthz', (_req, res) => res.send('ok'));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

interface Conn {
  socket: Socket<ClientToServer, ServerToClient>;
  token: string;
}
const rooms = new Map<string, Room>();
const conns = new Map<Room, Map<string, Conn>>();
const expiry = new Map<Room, NodeJS.Timeout>();

function broadcast(room: Room) {
  for (const { socket, token } of conns.get(room)?.values() ?? []) {
    socket.emit('state', { ...buildView(room, token), flights: room.flights });
  }
  room.flights = [];
}

function newCode() {
  let code;
  do code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  while (rooms.has(code));
  return code;
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const reply = (ack: unknown, res: Ack) => typeof ack === 'function' && ack(res);

io.on('connection', (socket) => {
  let room: Room | null = null;
  let token = '';

  const detach = () => {
    if (!room) return;
    const r = room;
    const list = conns.get(r)!;
    list.delete(socket.id);
    if (![...list.values()].some((c) => c.token === token)) r.disconnect(token);
    if (list.size === 0) {
      expiry.set(
        r,
        setTimeout(() => {
          if (conns.get(r)?.size) return;
          r.destroy();
          rooms.delete(r.code);
          conns.delete(r);
          console.log(`[${r.code}] closed`);
        }, EMPTY_ROOM_TTL_MS),
      );
    }
    room = null;
  };

  socket.on('join', (req, ack) => {
    const name = clean(req?.name, 12) || '玩家';
    const avatar = AVATARS.includes(req?.avatar) ? req.avatar : AVATARS[0];
    const t = clean(req?.token, 64);
    if (!t) return reply(ack, { ok: false, error: '缺少玩家識別碼' });

    let target: Room | undefined;
    if (req.code) {
      target = rooms.get(clean(req.code, 6).toUpperCase());
      if (!target) return reply(ack, { ok: false, error: '找不到這個房間，請確認代碼' });
    } else {
      target = new Room(newCode(), t, broadcast);
      rooms.set(target.code, target);
      conns.set(target, new Map());
      console.log(`[${target.code}] created`);
    }

    detach();
    room = target;
    token = t;
    clearTimeout(expiry.get(room));
    conns.get(room)!.set(socket.id, { socket, token });
    const r = room.join(token, name, avatar);
    if (!r.ok) {
      conns.get(room)!.delete(socket.id);
      room = null;
      return reply(ack, r);
    }
    reply(ack, { ok: true, code: target.code });
  });

  socket.on('updateSettings', (patch) => room?.updateSettings(token, patch ?? {}));
  socket.on('addBot', () => room?.addBot(token));
  socket.on('removeBot', () => room?.removeBot(token));
  socket.on('start', (ack) => reply(ack, room ? room.start(token) : { ok: false, error: '尚未加入房間' }));
  socket.on('act', (intent, ack) => reply(ack, room ? room.act(token, intent ?? { type: 'fold' }) : { ok: false, error: '尚未加入房間' }));
  socket.on('rebuy', () => room?.rebuy(token));
  socket.on('setAway', (away) => room?.setAway(token, !!away));
  socket.on('showCards', () => room?.showCards(token));
  socket.on('disconnect', detach);
});

server.listen(PORT, () => console.log(`Hold'em tournament server on http://localhost:${PORT}${TIME_SCALE > 1 ? ` (TIME_SCALE=${TIME_SCALE})` : ''}`));
