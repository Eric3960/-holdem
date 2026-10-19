import { useState } from 'react';
import Home from './components/Home';
import RoomLobby from './components/RoomLobby';
import InfoBar from './components/InfoBar';
import PokerTable from './components/PokerTable';
import HandPanel from './components/HandPanel';
import ActionPanel from './components/ActionPanel';
import SidePanel from './components/SidePanel';
import FinalResults from './components/FinalResults';
import { lastRoom, loadProfile, useRoom, useServerNow, type RoomApi } from './hooks/useRoom';
import { bestHand, handName } from '../shared/handEvaluator';
import type { TableView } from '../shared/types';

function GameScreen({ view, api }: { view: TableView; api: RoomApi }) {
  const [felt, setFelt] = useState('green');
  const [sideOpen, setSideOpen] = useState(false);
  const now = useServerNow(api.clockOffset, 500);
  const me = view.players[view.mySeat];
  const board = view.hand?.board ?? [];
  const myCards = me?.cards.filter((c): c is string => !!c) ?? [];
  const currentHand = myCards.length === 2 && board.length >= 3 ? handName(bestHand([...myCards, ...board])) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#1e293b,#020617_70%)] select-none">
      <InfoBar
        view={view}
        now={now}
        connected={api.connected}
        onToggleSide={() => setSideOpen((o) => !o)}
        onToggleAway={() => me && api.setAway(!me.away)}
        felt={felt}
        onFelt={() => setFelt((f) => (f === 'green' ? 'blue' : 'green'))}
      />

      <div className="flex min-h-0 flex-1">
        {/* 直式手機：牌桌在上、操作區在下；橫式手機：操作區移到右側；桌機另有右側欄 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col short:flex-row">
          <PokerTable view={view} flights={api.flights} felt={felt} serverNow={now} onFlightDone={api.removeFlight} />

          <footer
            className="flex shrink-0 flex-col items-center gap-2 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]
              short:w-72 short:justify-center short:py-2 short:pr-[max(0.5rem,env(safe-area-inset-right))]
              desk:flex-row desk:items-end desk:justify-center desk:gap-6 desk:px-6 desk:pb-5"
          >
            {me && !me.eliminated && <HandPanel cards={myCards} folded={me.folded} handName={currentHand} />}
            <ActionPanel
              view={view}
              now={now}
              onAct={api.act}
              onRebuy={api.rebuy}
              onShow={api.showCards}
              onAway={api.setAway}
              className="max-w-md"
            />
          </footer>
        </div>
        <SidePanel view={view} open={sideOpen} onClose={() => setSideOpen(false)} />
      </div>

      <FinalResults view={view} onLeave={api.leave} />
    </div>
  );
}

export default function App() {
  const api = useRoom();
  const urlCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? null;
  const [autoJoined, setAutoJoined] = useState(false);

  // 重新整理頁面：同一個瀏覽器、同一個房間 → 自動回到原座位
  const profile = loadProfile();
  if (!autoJoined && api.connected && !api.view && profile && urlCode && urlCode === lastRoom()) {
    setAutoJoined(true);
    api.join(profile, urlCode);
  }

  const { view } = api;
  if (!view) return <Home initialProfile={profile} initialCode={urlCode} error={api.error} onJoin={api.join} />;

  return (
    <>
      {view.tournament.status === 'lobby' ? <RoomLobby view={view} api={api} /> : <GameScreen view={view} api={api} />}
      {api.error && (
        <div className="fixed top-14 left-1/2 z-[60] -translate-x-1/2 animate-pop-in rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold shadow-xl">{api.error}</div>
      )}
    </>
  );
}
