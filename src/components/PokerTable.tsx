import { Fragment, useMemo, useRef } from 'react';
import type { Flight, TableView } from '../../shared/types';
import PlayerSeat, { type SeatTimer } from './PlayerSeat';
import CommunityCards from './CommunityCards';
import Pot from './Pot';
import BetChips from './BetChips';
import FlyingChip from './FlyingChip';
import { useElementSize } from '../hooks/useElementSize';
import { getTableLayout } from '../utils/seatLayout';
import { clamp, pct } from '../utils/format';

const FELTS: Record<string, string> = {
  green: 'bg-[radial-gradient(ellipse_at_center,#22a05a_0%,#137a40_45%,#0b4d28_100%)]',
  blue: 'bg-[radial-gradient(ellipse_at_center,#2f6fd6_0%,#1e3a8a_50%,#0f1d4a_100%)]',
};

interface Props {
  view: TableView;
  flights: Flight[];
  felt: string;
  serverNow: number;
  onFlightDone: (id: number) => void;
}

export default function PokerTable({ view, flights, felt, serverNow, onFlightDone }: Props) {
  const { players, hand, turn, tournament } = view;
  const heroSeat = Math.max(0, view.mySeat); // 自己固定在正下方；旁觀者以 0 號座位為視角
  const stageRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(stageRef);

  // 直式螢幕用直立橢圓，橫式用橫向橢圓；牌桌依容器等比縮放
  const portrait = width > 0 && width < height * 1.1;
  const ratio = portrait ? 0.68 : 1.9;
  let w = width;
  let h = width / ratio;
  if (h > height) {
    h = height;
    w = height * ratio;
  }
  const fontSize = portrait ? clamp(w / 31, 9, 15) : clamp(Math.min(w / 80, h / 42), 8, 16);

  const n = players.length;
  const layout = useMemo(() => getTableLayout(n, portrait), [n, portrait]);
  const at = (seat: number) => layout.seats[(seat - heroSeat + n) % n];

  const flightPath = (f: Flight) => {
    const s = at(f.seat);
    switch (f.kind) {
      case 'bet':
        return [s.seat, s.bet];
      case 'ante':
        return [s.seat, layout.pot];
      case 'collect':
        return [s.bet, layout.pot];
      case 'refund':
        return [s.bet, s.seat];
      case 'win':
        return [layout.pot, s.seat];
    }
  };

  const timer: SeatTimer | null =
    turn && hand
      ? {
          key: `${hand.handNo}-${turn.seat}-${turn.deadline}`,
          seconds: turn.totalMs / 1000,
          elapsed: (turn.totalMs - (turn.deadline - serverNow)) / 1000,
          bank: turn.usingBank,
        }
      : null;

  const banner = (() => {
    if (hand?.phase === 'complete' && hand.resultText) return { text: `🏆 ${hand.resultText}`, tone: 'text-amber-300 ring-amber-300/40' };
    if (tournament.message) return { text: tournament.message, tone: 'text-white/80 ring-white/10' };
    if (!hand && tournament.status === 'running') return { text: '比賽開始！準備發牌…', tone: 'text-white/80 ring-white/10' };
    return null;
  })();

  return (
    <div ref={stageRef} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {w > 0 && (
        <div className="relative" style={{ width: w, height: h, fontSize }}>
          <div
            className={`absolute rounded-full bg-linear-to-b from-[#5a3a22] via-[#3b2414] to-[#1f120a] p-[1.1em] shadow-[0_1.5em_3em_rgb(0_0_0/0.6),inset_0_0.15em_0.2em_rgb(255_255_255/0.15)]
              ${portrait ? 'inset-x-[10%] inset-y-[6%]' : 'inset-x-[6%] inset-y-[9%]'}`}
          >
            <div className={`relative h-full w-full rounded-full ${FELTS[felt]} shadow-[inset_0_0_2.5em_rgb(0_0_0/0.65)]`}>
              <div className="absolute inset-[7%] rounded-full border border-white/10" />
            </div>
          </div>

          {/* 中央：底池（有邊池時分開）+ 公牌 */}
          <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-wrap justify-center gap-[0.4em]" style={{ ...pct(layout.pot), width: '60%' }}>
            {hand && hand.pots.length > 0 ? hand.pots.map((p) => <Pot key={p.label} amount={p.amount} label={p.label} />) : <Pot amount={0} label="底池" />}
          </div>
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(layout.board)}>
            <CommunityCards cards={hand?.board ?? []} visible={hand?.board.length ?? 0} size={portrait ? 'sm' : 'md'} />
          </div>

          {banner && (
            <div className={`absolute z-30 max-w-[80%] -translate-x-1/2 -translate-y-1/2 animate-pop-in rounded-2xl bg-black/75 px-[1em] py-[0.35em] text-center text-[0.95em] font-bold ring-1 ${banner.tone}`} style={pct(layout.banner)}>
              {banner.text}
            </div>
          )}

          {players.map((p) => {
            const pos = at(p.seat);
            return (
              <Fragment key={p.seat}>
                <PlayerSeat
                  player={p}
                  pos={pos.seat}
                  isButton={hand?.button === p.seat}
                  blind={hand?.sb === p.seat ? 'SB' : hand?.bb === p.seat ? 'BB' : null}
                  isTurn={turn?.seat === p.seat}
                  isWinner={!!hand?.winners.includes(p.seat)}
                  timer={timer}
                />
                {p.bet > 0 && <BetChips key={`${p.seat}-${p.bet}`} amount={p.bet} pos={pos.bet} />}
              </Fragment>
            );
          })}

          {flights.map((f) => {
            const [from, to] = flightPath(f);
            return <FlyingChip key={f.id} from={from} to={to} amount={f.amount} onDone={() => onFlightDone(f.id)} />;
          })}
        </div>
      )}
    </div>
  );
}
