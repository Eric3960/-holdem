import { useState } from 'react';

// 圍繞頭像的倒數外框；以 key 重新掛載即可重新計時。
// elapsed：依伺服器剩餘時間接續倒數；bank：正在使用時間銀行（藍色）
export default function TurnTimer({ seconds, elapsed = 0, bank = false }: { seconds: number; elapsed?: number; bank?: boolean }) {
  const [delay] = useState(-Math.max(0, elapsed));
  return (
    <div className="pointer-events-none absolute -inset-[0.35em]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgb(0 0 0 / 0.4)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength="100"
          className={bank ? 'turn-timer-ring bank' : 'turn-timer-ring'}
          style={{ animationDuration: `${seconds}s`, animationDelay: `${delay}s` }}
        />
      </svg>
    </div>
  );
}
