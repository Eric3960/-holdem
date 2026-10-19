import { useEffect, useState } from 'react';
import type { PlayerIntent, TableView } from '../../shared/types';

const fmt = (n: number) => n.toLocaleString('en-US');

const TONES = {
  fold: 'from-rose-500 to-rose-700 text-white',
  call: 'from-sky-500 to-sky-700 text-white',
  raise: 'from-amber-300 to-amber-500 text-slate-900',
};

function ActionButton({ tone, title, sub, hotkey, disabled, onClick }: { tone: keyof typeof TONES; title: string; sub?: string; hotkey: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl bg-linear-to-b px-2 py-1.5 font-bold shadow-lg shadow-black/30 ring-1 ring-white/20 transition
        hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:saturate-0 disabled:active:scale-100 ${TONES[tone]}`}
    >
      <span className="text-base leading-tight">{title}</span>
      {sub && <span className="text-xs font-semibold tabular-nums opacity-85">{sub}</span>}
      <kbd className="absolute top-1 right-1.5 hidden text-[10px] font-normal opacity-50 desk:block">{hotkey}</kbd>
    </button>
  );
}

const Small = ({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={`rounded-lg bg-white/10 font-semibold ring-1 ring-white/10 transition hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-25 ${className}`}
    {...props}
  />
);

interface Props {
  view: TableView;
  now: number;
  onAct: (intent: PlayerIntent) => void;
  onRebuy: () => void;
  onShow: () => void;
  onAway: (away: boolean) => void;
  className?: string;
}

export default function ActionPanel({ view, now, onAct, onRebuy, onShow, onAway, className = '' }: Props) {
  const me = view.players[view.mySeat];
  const legal = view.legal;
  const hand = view.hand;
  const t = view.tournament;
  const step = hand?.level.sb ?? 100;

  const minTo = legal?.minRaiseTo ?? 0;
  const maxTo = legal?.maxRaiseTo ?? 0;
  const aggressive = !!legal && (legal.canBet || legal.canRaise);
  const [raiseTo, setRaiseTo] = useState(minTo);
  useEffect(() => setRaiseTo(minTo), [minTo, view.turn?.deadline]);

  const clampTo = (v: number) => Math.min(maxTo, Math.max(minTo, Math.round(v / step) * step));
  const currentBet = hand?.currentBet ?? 0;
  const potTotal = (hand?.pots.reduce((s, p) => s + p.amount, 0) ?? 0) + view.players.reduce((s, p) => s + p.bet, 0);
  const potSized = (frac: number) => clampTo(currentBet + (potTotal + (legal?.callAmount ?? 0)) * frac);
  const presets: [string, number][] = [
    ['½ 底池', potSized(0.5)],
    ['¾ 底池', potSized(0.75)],
    ['底池', potSized(1)],
    ['全下', maxTo],
  ];

  const isAllIn = raiseTo >= maxTo;
  const fold = () => legal && onAct({ type: 'fold' });
  const checkCall = () => legal && onAct({ type: legal.canCheck ? 'check' : 'call' });
  const raise = () => aggressive && onAct(isAllIn ? { type: 'allin' } : { type: legal!.canBet ? 'bet' : 'raise', amount: raiseTo });

  // 桌機快捷鍵：F 棄牌、C 過牌/跟注、R 下注/加注
  useEffect(() => {
    if (!legal) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'f') fold();
      else if (k === 'c') checkCall();
      else if (k === 'r') raise();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const box = `w-full space-y-2 rounded-2xl bg-slate-900/85 p-2.5 shadow-xl ring-1 ring-white/10 backdrop-blur desk:p-3 ${className}`;

  // 旁觀者 / 已淘汰 / 離席：顯示狀態而非操作按鈕
  if (!me) return <div className={`${box} text-center text-sm text-white/60`}>比賽進行中，你正在旁觀。</div>;
  if (me.eliminated) {
    return (
      <div className={`${box} text-center`}>
        <p className="text-sm text-white/70">你已被淘汰{me.place ? `（第 ${me.place} 名）` : ''}，可以繼續觀戰。</p>
        {t.canRebuy && (
          <button type="button" onClick={onRebuy} className="w-full rounded-xl bg-linear-to-b from-emerald-400 to-emerald-600 py-3 font-bold text-slate-900 active:scale-[0.98]">
            重新進場（10,000 籌碼，限一次）
          </button>
        )}
      </div>
    );
  }
  if (me.away) {
    return (
      <div className={`${box} text-center`}>
        <p className="text-sm text-white/70">你目前離席中。輪到你時會自動過牌或棄牌，但仍要付盲注。</p>
        <button type="button" onClick={() => onAway(false)} className="w-full rounded-xl bg-linear-to-b from-amber-300 to-amber-500 py-3 font-bold text-slate-900">
          回到座位
        </button>
      </div>
    );
  }

  const turn = view.turn;
  const myTurn = !!legal;
  const remaining = turn ? Math.max(0, Math.ceil((turn.deadline - now) / 1000)) : 0;
  const waitingFor = turn ? view.players[turn.seat]?.name : null;
  const status = myTurn
    ? `輪到你了 · ${turn?.usingBank ? `時間銀行 ${remaining} 秒` : `${remaining} 秒`}${!turn?.usingBank ? ` · 時間銀行 ${me.timeBank} 秒` : ''}`
    : !me.inHand
      ? '下一手開始時會發牌給你'
      : me.folded
        ? '本手已棄牌'
        : waitingFor
          ? `等待 ${waitingFor} 行動…`
          : t.message ?? '…';

  return (
    <div className={box}>
      <div className={`text-center text-xs ${myTurn ? `font-semibold ${turn?.usingBank ? 'text-sky-300' : 'text-amber-300'}` : 'text-white/50'}`}>{status}</div>

      {hand?.canShow && (
        <button type="button" onClick={onShow} className="w-full rounded-lg bg-white/10 py-2 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/20">
          亮牌給大家看
        </button>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {presets.map(([label, to]) => (
          <Small key={label} disabled={!aggressive} onClick={() => setRaiseTo(to)} className={`py-1.5 text-xs ${aggressive && raiseTo === to ? 'bg-amber-400/30 ring-amber-300/60' : ''}`}>
            {label}
          </Small>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Small disabled={!aggressive} onClick={() => setRaiseTo((v) => clampTo(v - (hand?.level.bb ?? 0)))} className="h-8 w-8 text-lg leading-none" aria-label="減少">
          −
        </Small>
        <input
          id="raise-amount"
          type="range"
          min={minTo}
          max={maxTo}
          step={step}
          value={raiseTo}
          disabled={!aggressive}
          onChange={(e) => setRaiseTo(clampTo(Number(e.target.value)))}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-not-allowed disabled:opacity-25"
          aria-label="下注金額"
        />
        <Small disabled={!aggressive} onClick={() => setRaiseTo((v) => (v + (hand?.level.bb ?? 0) >= maxTo ? maxTo : clampTo(v + (hand?.level.bb ?? 0))))} className="h-8 w-8 text-lg leading-none" aria-label="增加">
          +
        </Small>
        <span className={`w-16 text-right text-sm font-bold tabular-nums ${aggressive ? 'text-amber-300' : 'text-white/25'}`}>{aggressive ? fmt(raiseTo) : '—'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ActionButton tone="fold" title="棄牌" sub="Fold" hotkey="F" disabled={!myTurn} onClick={fold} />
        {legal && !legal.canCheck ? (
          <ActionButton tone="call" title={legal.callAmount >= me.stack ? '全下跟注' : '跟注'} sub={fmt(legal.callAmount)} hotkey="C" disabled={!myTurn} onClick={checkCall} />
        ) : (
          <ActionButton tone="call" title="過牌" sub="Check" hotkey="C" disabled={!myTurn} onClick={checkCall} />
        )}
        <ActionButton
          tone="raise"
          title={isAllIn ? '全下' : legal?.canBet ? '下注' : '加注到'}
          sub={aggressive ? fmt(raiseTo) : undefined}
          hotkey="R"
          disabled={!aggressive}
          onClick={raise}
        />
      </div>
    </div>
  );
}
