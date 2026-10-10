import { Fragment, useMemo, useRef } from 'react';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import Pot from './Pot';
import BetChips from './BetChips';
import FlyingChip from './FlyingChip';
import { useElementSize } from '../hooks/useElementSize';
import { getTableLayout } from '../utils/seatLayout';
import { clamp, pct } from '../utils/format';

const FELTS = {
  green: 'bg-[radial-gradient(ellipse_at_center,#22a05a_0%,#137a40_45%,#0b4d28_100%)]',
  blue: 'bg-[radial-gradient(ellipse_at_center,#2f6fd6_0%,#1e3a8a_50%,#0f1d4a_100%)]',
};

function EmptySeat({ pos }) {
  return (
    <div
      className="absolute grid h-[3.6em] w-[3.6em] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-white/15 bg-black/20 text-[1em]"
      style={pct(pos)}
    >
      <span className="text-[0.7em] text-white/35">空位</span>
    </div>
  );
}

export default function PokerTable({ game, flights, felt = 'green', onFlightDone }) {
  const { players, board, street, pot, dealerIndex, turnIndex, phase, result, actionSeq, turnSeconds, turnEndsIn } = game;
  const heroIndex = Math.max(0, game.heroIndex); // 旁觀者以 0 號座位為視角
  const turnElapsed = turnSeconds - turnEndsIn / 1000 + (Date.now() - game.receivedAt) / 1000;
  const stageRef = useRef(null);
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
  // 桌內所有元素以 em 為單位，跟著牌桌大小縮放
  const fontSize = portrait ? clamp(w / 31, 9, 15) : clamp(Math.min(w / 80, h / 42), 8, 16);

  const n = players.length;
  const layout = useMemo(() => getTableLayout(n, portrait), [n, portrait]);
  const at = (i) => layout.seats[(i - heroIndex + n) % n];

  const flightPath = (f) => {
    const s = at(f.playerIndex);
    if (f.kind === 'bet') return [s.seat, s.bet];
    if (f.kind === 'collect') return [s.bet, layout.pot];
    return [layout.pot, s.seat];
  };

  return (
    <div ref={stageRef} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {w > 0 && (
        <div className="relative" style={{ width: w, height: h, fontSize }}>
          {/* 桌緣 + 桌布 */}
          <div
            className={`absolute rounded-full bg-linear-to-b from-[#5a3a22] via-[#3b2414] to-[#1f120a] p-[1.1em] shadow-[0_1.5em_3em_rgb(0_0_0/0.6),inset_0_0.15em_0.2em_rgb(255_255_255/0.15)]
              ${portrait ? 'inset-x-[10%] inset-y-[6%]' : 'inset-x-[6%] inset-y-[9%]'}`}
          >
            <div className={`relative h-full w-full rounded-full ${FELTS[felt]} shadow-[inset_0_0_2.5em_rgb(0_0_0/0.65)]`}>
              <div className="absolute inset-[7%] rounded-full border border-white/10" />
            </div>
          </div>

          {/* 中央：底池 + 公牌 */}
          <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={pct(layout.pot)}>
            <Pot amount={pot} />
          </div>
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(layout.board)}>
            <CommunityCards cards={board} visible={board.length} size={portrait ? 'sm' : 'md'} />
          </div>

          {phase === 'waiting' && (
            <div
              className="absolute z-30 max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/60 px-[1em] py-[0.4em] text-center text-[0.9em] text-white/80"
              style={pct(layout.banner)}
            >
              等待其他玩家入座…（至少 2 人開局）
              <div className="text-[0.85em] text-white/50">點右上「邀請朋友」分享連結，或按 +🤖 加入電腦玩家</div>
            </div>
          )}

          {phase === 'handOver' && result && (
            <div
              className="absolute z-30 max-w-[80%] -translate-x-1/2 -translate-y-1/2 animate-pop-in rounded-2xl bg-black/75 px-[1em] py-[0.35em] text-center text-[0.95em] font-bold text-amber-300 ring-1 ring-amber-300/40"
              style={pct(layout.banner)}
            >
              🏆 {result.text}
            </div>
          )}

          {/* 座位 + 各自的下注籌碼 */}
          {players.map((p, i) => {
            const pos = at(i);
            if (!p) return <EmptySeat key={`empty-${i}`} pos={pos.seat} />;
            return (
              <Fragment key={p.id}>
                <PlayerSeat
                  player={p}
                  pos={pos.seat}
                  isDealer={i === dealerIndex}
                  isTurn={phase === 'betting' && i === turnIndex}
                  isWinner={phase === 'handOver' && result?.winners.includes(i)}
                  revealCards={street === 'showdown' && !p.folded}
                  turnKey={actionSeq}
                  turnSeconds={turnSeconds}
                  turnElapsed={turnElapsed}
                />
                {p.bet > 0 && <BetChips key={`${p.id}-${p.bet}`} amount={p.bet} pos={pos.bet} />}
              </Fragment>
            );
          })}

          {/* 飛行中的籌碼 */}
          {flights.map((f) => {
            const [from, to] = flightPath(f);
            return <FlyingChip key={f.id} from={from} to={to} amount={f.amount} onDone={() => onFlightDone(f.id)} />;
          })}
        </div>
      )}
    </div>
  );
}
