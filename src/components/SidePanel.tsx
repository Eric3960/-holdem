import { useState } from 'react';
import type { TableView } from '../../shared/types';

// 側欄：手牌紀錄（最近 20 手）與淘汰順序。桌機固定在右側，手機為抽屜
export default function SidePanel({ view, open, onClose }: { view: TableView; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'history' | 'out'>('history');
  const { eliminations } = view.tournament;

  const body = (
    <div className="flex h-full min-h-0 flex-col bg-slate-950/95 desk:bg-slate-950/60">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 p-2 text-sm">
        {(
          [
            ['history', '手牌紀錄'],
            ['out', `淘汰順序（${eliminations.length}）`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-1.5 ${tab === key ? 'bg-white/15 font-semibold' : 'text-white/55 hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="ml-auto rounded-lg px-3 py-1.5 text-white/60 hover:bg-white/10 desk:hidden" aria-label="關閉">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-xs">
        {tab === 'history' ? (
          view.history.length === 0 ? (
            <p className="text-white/40">比賽開始後會在這裡顯示每一手的動作與結果。</p>
          ) : (
            <div className="space-y-3">
              {view.history.map((h) => (
                <section key={h.handNo}>
                  <h3 className="mb-1 font-semibold text-amber-200">第 {h.handNo} 手</h3>
                  <ul className="space-y-0.5 text-white/70">
                    {h.lines.map((line, i) => (
                      <li key={i} className={line.startsWith('—') ? 'pt-0.5 text-white/40' : line.includes('贏得') ? 'font-semibold text-emerald-300' : line.includes('淘汰') ? 'text-rose-300' : ''}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )
        ) : eliminations.length === 0 ? (
          <p className="text-white/40">還沒有人被淘汰。</p>
        ) : (
          <ol className="space-y-1">
            {eliminations.map((e) => (
              <li key={`${e.seat}-${e.handNo}`} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
                <span className="w-10 font-bold tabular-nums text-white/60">{e.place ? `#${e.place}` : ''}</span>
                <span className="flex-1">{e.name}</span>
                <span className="text-white/40">第 {e.handNo} 手</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-l border-white/10 desk:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 desk:hidden" onClick={onClose}>
          <div className="h-full w-[85%] max-w-sm" onClick={(e) => e.stopPropagation()}>
            {body}
          </div>
        </div>
      )}
    </>
  );
}
