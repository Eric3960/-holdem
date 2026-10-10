import { useEffect, useRef } from 'react';
import { ChipStack } from './Chip';

// 用 Web Animations API 讓籌碼從 from 飛到 to（座標為牌桌百分比）
export default function FlyingChip({ from, to, amount, onDone }) {
  const ref = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const anim = ref.current.animate(
      [
        { left: `${from.x}%`, top: `${from.y}%`, transform: 'translate(-50%, -50%) scale(1)' },
        { left: `${to.x}%`, top: `${to.y}%`, transform: 'translate(-50%, -50%) scale(0.85)' },
      ],
      { duration: 450, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'forwards' },
    );
    // 分頁在背景時 onfinish 可能不觸發，用計時器保底，避免籌碼卡在桌上
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        doneRef.current();
      }
    };
    anim.onfinish = finish;
    const fallback = setTimeout(finish, 600);
    return () => {
      clearTimeout(fallback);
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-30"
      style={{ left: `${from.x}%`, top: `${from.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <ChipStack amount={amount} />
    </div>
  );
}
