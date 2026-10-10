import { useState } from 'react';

// 圍繞頭像的倒數外框；以 key 重新掛載即可重新計時。
// elapsed：中途加入或重新連線時，從伺服器剩餘時間接續倒數
export default function TurnTimer({ seconds, elapsed = 0 }) {
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
          className="turn-timer-ring"
          style={{ animationDuration: `${seconds}s`, animationDelay: `${delay}s` }}
        />
      </svg>
    </div>
  );
}
