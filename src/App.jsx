import { useState } from 'react';
import Lobby from './components/Lobby';
import TopBar from './components/TopBar';
import PokerTable from './components/PokerTable';
import HandPanel from './components/HandPanel';
import ActionPanel from './components/ActionPanel';
import ActionLog from './components/ActionLog';
import { useSocketTable } from './hooks/useSocketTable';
import { BIG_BLIND } from '../shared/constants';
import { bestHand, HAND_NAMES } from '../shared/handEvaluator';

function GameScreen({ table }) {
  const { game, flights, connected, act, addBot, removeBot, removeFlight } = table;
  const [felt, setFelt] = useState('green');
  const hero = game.players[game.heroIndex];
  const isMyTurn = game.phase === 'betting' && game.heroIndex >= 0 && game.turnIndex === game.heroIndex;
  const potTotal = game.pot + game.players.reduce((sum, p) => sum + (p?.bet ?? 0), 0);
  const handName = hero?.cards[0] && game.board.length >= 3 ? HAND_NAMES[bestHand([...hero.cards, ...game.board])[0]] : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#1e293b,#020617_70%)] select-none">
      <TopBar
        room={game.room}
        handId={game.handId}
        street={game.street}
        phase={game.phase}
        connected={connected}
        felt={felt}
        onFeltChange={setFelt}
        onAddBot={addBot}
        onRemoveBot={removeBot}
      />

      {/* 直式手機：牌桌在上、操作區在下；橫式手機：操作區移到右側 */}
      <div className="flex min-h-0 flex-1 flex-col short:flex-row">
        <PokerTable game={game} flights={flights} felt={felt} onFlightDone={removeFlight} />

        <footer
          className="flex shrink-0 flex-col items-center gap-2 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]
            short:w-72 short:justify-center short:py-2 short:pr-[max(0.5rem,env(safe-area-inset-right))]
            desk:grid desk:grid-cols-[1fr_auto_1fr] desk:items-end desk:gap-6 desk:px-6 desk:pb-5"
        >
          <ActionLog entries={game.log} className="hidden desk:block" />
          {hero ? (
            <>
              <HandPanel cards={hero.cards} folded={hero.folded} handName={handName} />
              <ActionPanel
                hero={hero}
                currentBet={game.currentBet}
                minRaise={game.minRaise}
                potTotal={potTotal}
                bigBlind={BIG_BLIND}
                enabled={isMyTurn}
                waitingFor={game.phase === 'betting' ? game.players[game.turnIndex]?.name : null}
                onAction={act}
                className="max-w-md desk:justify-self-end"
              />
            </>
          ) : (
            <div className="rounded-2xl bg-slate-900/85 px-4 py-3 text-center text-sm text-white/70 ring-1 ring-white/10 desk:col-span-2">
              牌桌已滿，你正在旁觀。有人離開後重新整理頁面即可入座。
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const table = useSocketTable();

  if (!table.session) return <Lobby onJoin={table.join} />;
  if (!table.game) {
    return <div className="grid h-full place-items-center text-white/60">{table.connected ? '入座中…' : '連線到伺服器中…'}</div>;
  }
  return <GameScreen table={table} />;
}
