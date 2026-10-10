import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { Table } from './table.js';
import { AVATARS, MAX_SEATS, MIN_SEATS } from '../shared/constants.js';

const PORT = Number(process.env.PORT) || 3001;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/healthz', (req, res) => res.send('ok'));

// 正式環境由同一個服務提供前端頁面
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const tables = new Map();

function broadcast(table) {
  for (const { socket, playerId } of table.sockets.values()) {
    socket.emit('state', { ...table.viewFor(playerId), flights: table.flights });
  }
  table.flights = [];
}

function getTable(room, seatCount) {
  let table = tables.get(room);
  if (!table) {
    const count = Math.min(MAX_SEATS, Math.max(MIN_SEATS, Number(seatCount) || MAX_SEATS));
    table = new Table(room, count, broadcast);
    tables.set(room, table);
    console.log(`[room ${room}] created (${count} seats)`);
  }
  clearTimeout(table.expireTimer);
  return table;
}

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

io.on('connection', (socket) => {
  let table = null;
  let playerId = null;

  const detach = () => {
    if (!table) return;
    table.sockets.delete(socket.id);
    const stillHere = [...table.sockets.values()].some((s) => s.playerId === playerId);
    if (!stillHere) table.disconnect(playerId);
    if (table.sockets.size === 0) {
      const t = table;
      t.expireTimer = setTimeout(() => {
        if (t.sockets.size === 0) {
          t.destroy();
          tables.delete(t.id);
          console.log(`[room ${t.id}] closed`);
        }
      }, EMPTY_ROOM_TTL_MS);
    }
    table = null;
  };

  socket.on('join', (msg = {}, ack) => {
    const room = clean(msg.room, 16).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'main';
    const name = clean(msg.name, 12) || '玩家';
    const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[0];
    const token = clean(msg.token, 64);
    if (!token) return;

    detach();
    table = getTable(room, msg.seatCount);
    playerId = token;
    table.sockets.set(socket.id, { socket, playerId });
    const seat = table.join(token, name, avatar);
    if (typeof ack === 'function') ack({ room, seat });
  });

  socket.on('act', (action) => table?.act(playerId, action));
  socket.on('addBot', () => table?.addBot());
  socket.on('removeBot', () => table?.removeBot());
  socket.on('disconnect', detach);
});

server.listen(PORT, () => console.log(`Hold'em server on http://localhost:${PORT}`));
