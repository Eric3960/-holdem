import { useEffect, useRef, useState } from 'react';
import type { TableView } from '../../shared/types';
import { applyPrefs, audio, installUnlock, loadPrefs, savePrefs, sfx, type AudioPrefs } from './sound';
import { startMusic, stopMusic } from './music';

/** 音效 / 音樂設定，並依設定開關背景音樂 */
export function useAudioPrefs() {
  const [prefs, setPrefs] = useState<AudioPrefs>(loadPrefs);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => installUnlock(() => setUnlocked(true)), []);

  useEffect(() => {
    savePrefs(prefs);
    applyPrefs(prefs);
    if (prefs.music && unlocked) startMusic();
    else stopMusic();
  }, [prefs, unlocked]);

  const update = (patch: Partial<AudioPrefs>) => {
    audio().resume(); // 由點擊觸發，順便解鎖
    setPrefs((p) => ({ ...p, ...patch }));
  };
  return { prefs, update };
}

/** 比對前後兩次畫面，播放對應的音效 */
export function useGameSounds(view: TableView | null, serverNow: number) {
  const prev = useRef<TableView | null>(null);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!view || !p || p.code !== view.code) return; // 剛載入或換房間時不補播

    for (const f of view.flights) {
      if (f.kind === 'bet' || f.kind === 'ante' || f.kind === 'refund') sfx.bet(f.amount);
    }
    if (view.flights.some((f) => f.kind === 'collect')) sfx.collect();
    const wins = view.flights.filter((f) => f.kind === 'win');
    if (wins.length) sfx.win(wins.some((f) => f.seat === view.mySeat));

    const h = view.hand;
    const ph = p.hand;
    if (h && h.handNo !== ph?.handNo) sfx.newHand();
    else if (h && ph && h.board.length > ph.board.length) {
      for (let i = 0; i < h.board.length - ph.board.length; i++) sfx.deal(i * 0.12);
    }

    for (const s of view.players) {
      const before = p.players[s.seat]?.lastAction;
      if (s.lastAction === before) continue;
      if (s.lastAction === '過牌') sfx.check();
      else if (s.lastAction === '棄牌') sfx.fold();
      else if (s.lastAction === '全下') sfx.allIn();
    }

    const myTurnNow = view.turn?.seat === view.mySeat && view.mySeat >= 0;
    const myTurnBefore = p.turn?.seat === p.mySeat && p.mySeat >= 0;
    if (myTurnNow && (!myTurnBefore || (p.hand?.handNo !== h?.handNo))) sfx.yourTurn();

    const t = view.tournament;
    if (t.status === 'running' && p.tournament.status === 'running' && t.level.level > p.tournament.level.level) sfx.levelUp();
    if (t.eliminations.length > p.tournament.eliminations.length) sfx.bust();
    if (t.status === 'finished' && p.tournament.status !== 'finished') sfx.fanfare();
  }, [view]);

  // 自己的回合最後 5 秒：每秒滴答一聲
  useEffect(() => {
    const turn = view?.turn;
    if (!turn || turn.seat !== view.mySeat) {
      lastTick.current = null;
      return;
    }
    const left = Math.ceil((turn.deadline - serverNow) / 1000);
    if (left >= 1 && left <= 5 && left !== lastTick.current) {
      lastTick.current = left;
      sfx.tick(left);
    }
  }, [view, serverNow]);
}
