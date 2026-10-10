import { useEffect, useState } from 'react';
import { fmt } from '../utils/format';

const STEP = 10;

const TONES = {
  fold: 'from-rose-500 to-rose-700 text-white',
  call: 'from-sky-500 to-sky-700 text-white',
  raise: 'from-amber-300 to-amber-500 text-slate-900',
};

function ActionButton({ tone, title, sub, hotkey, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl bg-linear-to-b px-2 py-1.5 font-bold shadow-lg shadow-black/30 ring-1 ring-white/20 transition
        hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:saturate-50 disabled:active:scale-100 ${TONES[tone]}`}
    >
      <span className="text-sm leading-tight desk:text-base">{title}</span>
      {sub && <span className="text-[11px] font-semibold tabular-nums opacity-80">{sub}</span>}
      {hotkey && <kbd className="absolute top-1 right-1.5 hidden text-[10px] font-normal opacity-50 desk:block">{hotkey}</kbd>}
    </button>
  );
}

const SmallButton = ({ className = '', ...props }) => (
  <button
    type="button"
    className={`rounded-lg bg-white/10 font-semibold ring-1 ring-white/10 transition hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-30 ${className}`}
    {...props}
  />
);

export default function ActionPanel({ hero, currentBet, minRaise, potTotal, bigBlind, enabled, waitingFor, onAction, className = '' }) {
  const toCall = Math.max(0, currentBet - hero.bet);
  const callAmount = Math.min(toCall, hero.chips);
  const maxTo = hero.bet + hero.chips;
  const minTo = Math.min(maxTo, currentBet === 0 ? bigBlind : currentBet + minRaise);
  const canRaise = enabled && hero.chips > toCall;

  const [raiseTo, setRaiseTo] = useState(minTo);
  useEffect(() => setRaiseTo(minTo), [minTo, enabled]);

  const clampTo = (v) => Math.min(maxTo, Math.max(minTo, Math.round(v / STEP) * STEP));
  const potRaise = (frac) => currentBet + (potTotal + toCall) * frac;
  const presets = [
    ['½ 池', clampTo(potRaise(0.5))],
    ['¾ 池', clampTo(potRaise(0.75))],
    ['底池', clampTo(potRaise(1))],
    ['All-in', maxTo],
  ];

  const fold = () => onAction({ type: 'fold' });
  const checkOrCall = () => onAction({ type: toCall === 0 ? 'check' : 'call' });
  const raise = () => onAction({ type: 'raise', amount: raiseTo });

  // 桌機快捷鍵：F 棄牌、C 過牌/跟注、R 加注
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'f') fold();
      else if (k === 'c') checkOrCall();
      else if (k === 'r' && canRaise) raise();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const status = !hero.inHand
    ? '下一手開始時會發牌給你'
    : hero.folded
      ? '本手已棄牌'
    : enabled
      ? toCall > 0
        ? `輪到你了 · 需跟注 $${fmt(callAmount)}`
        : '輪到你了'
      : waitingFor
        ? `等待 ${waitingFor} 行動…`
        : '發牌中…';

  return (
    <div className={`w-full space-y-2 rounded-2xl bg-slate-900/85 p-2 shadow-xl ring-1 ring-white/10 backdrop-blur desk:p-3 ${className}`}>
      <div className={`text-center text-xs ${enabled ? 'font-semibold text-amber-300' : 'text-white/50'}`}>{status}</div>

      {/* 快捷金額 */}
      <div className="grid grid-cols-4 gap-1.5">
        {presets.map(([label, to]) => (
          <SmallButton key={label} disabled={!canRaise} onClick={() => setRaiseTo(to)} className={`py-1 text-xs ${raiseTo === to && canRaise ? 'bg-amber-400/30 ring-amber-300/60' : ''}`}>
            {label}
          </SmallButton>
        ))}
      </div>

      {/* 金額拉桿 */}
      <div className="flex items-center gap-2">
        <SmallButton disabled={!canRaise} onClick={() => setRaiseTo((v) => clampTo(v - bigBlind))} className="h-7 w-7 text-lg leading-none">
          −
        </SmallButton>
        <input
          type="range"
          min={minTo}
          max={maxTo}
          step={STEP}
          value={raiseTo}
          disabled={!canRaise}
          onChange={(e) => setRaiseTo(Number(e.target.value))}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="加注金額"
        />
        <SmallButton disabled={!canRaise} onClick={() => setRaiseTo((v) => clampTo(v + bigBlind))} className="h-7 w-7 text-lg leading-none">
          +
        </SmallButton>
        <span className={`w-14 text-right text-sm font-bold tabular-nums ${canRaise ? 'text-amber-300' : 'text-white/30'}`}>{fmt(raiseTo)}</span>
      </div>

      {/* 主要操作 */}
      <div className="grid grid-cols-3 gap-2">
        <ActionButton tone="fold" title="棄牌" sub="Fold" hotkey="F" disabled={!enabled} onClick={fold} />
        {toCall === 0 ? (
          <ActionButton tone="call" title="過牌" sub="Check" hotkey="C" disabled={!enabled} onClick={checkOrCall} />
        ) : (
          <ActionButton tone="call" title={callAmount >= hero.chips ? 'All-in' : '跟注'} sub={`$${fmt(callAmount)}`} hotkey="C" disabled={!enabled} onClick={checkOrCall} />
        )}
        <ActionButton
          tone="raise"
          title={raiseTo >= maxTo ? 'All-in' : currentBet === 0 ? '下注' : '加注至'}
          sub={`$${fmt(raiseTo)}`}
          hotkey="R"
          disabled={!canRaise}
          onClick={raise}
        />
      </div>
    </div>
  );
}
