import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, Flight, PlayerIntent, RoomSettings, ServerToClient, TableView } from '../../shared/types';

type AppSocket = Socket<ServerToClient, ClientToServer>;

export interface Profile {
  name: string;
  avatar: string;
}

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* 私密瀏覽等情況下無法儲存，不影響遊玩 */
    }
  },
};

/** 同一個瀏覽器固定使用同一組 playerToken，斷線或重新整理後能回到原座位 */
function playerToken() {
  let t = store.get('holdem-token');
  if (!t) {
    t = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    store.set('holdem-token', t);
  }
  return t;
}

export function loadProfile(): Profile | null {
  try {
    const p = JSON.parse(store.get('holdem-profile') ?? 'null');
    return p?.name ? p : null;
  } catch {
    return null;
  }
}

export const lastRoom = () => store.get('holdem-last-room');

export function useRoom() {
  const [view, setView] = useState<TableView | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef<AppSocket | null>(null);
  const sessionRef = useRef<{ code?: string; profile: Profile } | null>(null);

  const flash = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError((e) => (e === msg ? null : e)), 3000);
  }, []);

  const emitJoin = useCallback(() => {
    const s = socketRef.current;
    const session = sessionRef.current;
    if (!s || !session) return;
    s.emit('join', { code: session.code, ...session.profile, token: playerToken() }, (res: Ack) => {
      if (!res.ok) {
        flash(res.error);
        sessionRef.current = null;
        setView(null);
        return;
      }
      if (res.code) {
        session.code = res.code;
        store.set('holdem-last-room', res.code);
        history.replaceState(null, '', `?room=${res.code}`);
      }
    });
  }, [flash]);

  useEffect(() => {
    const s: AppSocket = io();
    socketRef.current = s;
    s.on('connect', () => {
      setConnected(true);
      emitJoin(); // 網路中斷後自動重新加入
    });
    s.on('disconnect', () => setConnected(false));
    s.on('state', (v) => {
      setClockOffset(v.serverNow - Date.now());
      setView(v);
      if (v.flights.length) setFlights((f) => [...f, ...v.flights]);
    });
    return () => {
      s.disconnect();
    };
  }, [emitJoin]);

  const join = useCallback(
    (profile: Profile, code?: string) => {
      store.set('holdem-profile', JSON.stringify(profile));
      sessionRef.current = { code: code?.trim().toUpperCase() || undefined, profile };
      emitJoin();
    },
    [emitJoin],
  );

  const leave = useCallback(() => {
    sessionRef.current = null;
    setView(null);
    setFlights([]);
    history.replaceState(null, '', location.pathname);
    socketRef.current?.disconnect().connect();
  }, []);

  const withAck = (res: Ack) => !res.ok && flash(res.error);
  const s = () => socketRef.current;

  return {
    view,
    flights,
    connected,
    error,
    clockOffset,
    join,
    leave,
    removeFlight: useCallback((id: number) => setFlights((f) => f.filter((x) => x.id !== id)), []),
    act: (intent: PlayerIntent) => s()?.emit('act', intent, withAck),
    start: () => s()?.emit('start', withAck),
    updateSettings: (patch: Partial<RoomSettings>) => s()?.emit('updateSettings', patch),
    addBot: () => s()?.emit('addBot'),
    removeBot: () => s()?.emit('removeBot'),
    rebuy: () => s()?.emit('rebuy'),
    setAway: (away: boolean) => s()?.emit('setAway', away),
    showCards: () => s()?.emit('showCards'),
  };
}

export type RoomApi = ReturnType<typeof useRoom>;

/** 每秒更新的伺服器時間，用來顯示倒數 */
export function useServerNow(offset: number, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(id);
  }, [offset, intervalMs]);
  return now;
}
