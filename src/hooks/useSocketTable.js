import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// 每個分頁一個身分；重新整理後用同一個 token 回到原座位
function getToken() {
  try {
    let t = sessionStorage.getItem('holdem-token');
    if (!t) {
      t = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('holdem-token', t);
    }
    return t;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export function useSocketTable() {
  const [session, setSession] = useState(null); // { room, name, avatar, seatCount }
  const [game, setGame] = useState(null);
  const [flights, setFlights] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    const socket = io();
    socketRef.current = socket;
    const token = getToken();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { ...session, token });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('state', (s) => {
      setGame({ ...s, receivedAt: Date.now() });
      if (s.flights.length) setFlights((f) => [...f, ...s.flights]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  const emit = useCallback((event, payload) => socketRef.current?.emit(event, payload), []);

  return {
    session,
    join: setSession,
    game,
    flights,
    connected,
    act: useCallback((action) => emit('act', action), [emit]),
    addBot: useCallback(() => emit('addBot'), [emit]),
    removeBot: useCallback(() => emit('removeBot'), [emit]),
    removeFlight: useCallback((id) => setFlights((f) => f.filter((x) => x.id !== id)), []),
  };
}
