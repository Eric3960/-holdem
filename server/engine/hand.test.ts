import { describe, expect, it } from 'vitest';
import { advance, applyAction, collectedPots, legalActions, nextButton, playerAt } from './hand';
import { buildPots, splitPot } from './pots';
import { act, finish, hand, level, stackOf } from './testUtils';

const LV = level(100, 200);
const BOARD_ROYAL = ['As', 'Ks', 'Qs', 'Js', 'Ts']; // 公牌同花大順：所有人平手
const BOARD_DRY = ['2c', '7d', '9h', 'Jc', '4s'];

describe('邊池', () => {
  it('buildPots：三人不同籌碼全下', () => {
    const pots = buildPots([
      { seat: 0, total: 1000, folded: false },
      { seat: 1, total: 3000, folded: false },
      { seat: 2, total: 3000, folded: false },
      { seat: 3, total: 500, folded: true },
    ]);
    expect(pots).toEqual([
      { amount: 3500, eligible: [0, 1, 2] }, // 1000×3 + 棄牌者的 500
      { amount: 4000, eligible: [1, 2] },
    ]);
  });

  it('三人不同籌碼全下：分池結算，多出的下注退回', () => {
    // 座位 0：5,000（最弱）、座位 1：1,000（最強）、座位 2：3,000（次強）
    let s = hand({ 0: 5000, 1: 1000, 2: 3000 }, 0, LV, [['3c', '8s'], ['Ah', 'Ad'], ['Kh', 'Kd']], BOARD_DRY);
    expect(s.toAct).toBe(0);
    s = act(s, 0, { type: 'allin' });
    s = act(s, 1, { type: 'allin' }); // 籌碼不足，等同全下跟注
    s = act(s, 2, { type: 'allin' });
    s = finish(s);

    expect(s.results!.map((r) => [r.amount, r.winners])).toEqual([
      [3000, [1]], // 主池
      [4000, [2]], // 邊池
    ]);
    expect(stackOf(s, 1)).toBe(3000);
    expect(stackOf(s, 2)).toBe(4000);
    expect(stackOf(s, 0)).toBe(2000); // 沒人跟的 2,000 退回
    expect(s.events.some((e) => e.t === 'refund' && e.seat === 0 && e.amount === 2000)).toBe(true);
  });

  it('全員全下後自動亮牌並發完公牌', () => {
    let s = hand({ 0: 1000, 1: 1000 }, 0, LV, [['Ah', 'Ad'], ['Kh', 'Kd']], BOARD_DRY);
    s = act(s, 0, { type: 'allin' });
    s = act(s, 1, { type: 'call' });
    s = advance(s);
    expect(s.runout).toBe(true);
    expect(s.events.filter((e) => e.t === 'reveal')).toHaveLength(2);
    expect(s.board).toHaveLength(3);
    expect(s.phase).toBe('street-end'); // 不需要任何人行動
  });

  it('桌上下注與已收進的底池分開計算', () => {
    let s = hand({ 0: 5000, 1: 5000, 2: 5000 }, 0, LV);
    s = act(s, 0, { type: 'raise', amount: 600 });
    expect(collectedPots(s)).toEqual([]);
    s = act(s, 1, { type: 'call' });
    s = act(s, 2, { type: 'call' });
    s = advance(s);
    expect(collectedPots(s)).toEqual([{ amount: 1800, eligible: [0, 1, 2] }]);
  });
});

describe('最小加注與不完整全下', () => {
  it('最小下注為一個大盲，最小加注額為上一次完整加注的差額', () => {
    let s = hand({ 0: 5000, 1: 5000, 2: 5000 }, 0, LV);
    expect(legalActions(s, 0)!.minRaiseTo).toBe(400);
    expect(applyAction(s, 0, { type: 'raise', amount: 300 }).ok).toBe(false);
    s = act(s, 0, { type: 'raise', amount: 600 }); // 加了 400
    expect(legalActions(s, 1)!.minRaiseTo).toBe(1000);
    expect(applyAction(s, 1, { type: 'raise', amount: 999 }).ok).toBe(false);
    s = act(s, 1, { type: 'call' });
    s = act(s, 2, { type: 'call' });
    s = advance(s);
    expect(legalActions(s, 1)).toMatchObject({ canBet: true, canRaise: false, minRaiseTo: 200 });
    expect(applyAction(s, 1, { type: 'bet', amount: 150 }).ok).toBe(false);
  });

  it('不足一個完整加注的全下，不會重新開放已行動玩家的加注權', () => {
    // 座位 1（小盲）只有 700：加注到 700 只比 600 多 100，不是完整加注
    let s = hand({ 0: 5000, 1: 700, 2: 5000 }, 0, LV);
    s = act(s, 0, { type: 'raise', amount: 600 });
    s = act(s, 1, { type: 'allin' });
    expect(s.currentBet).toBe(700);
    expect(s.lastFullRaise).toBe(400); // 最小加注額不變
    expect(legalActions(s, 2)).toMatchObject({ canRaise: true, minRaiseTo: 1100 }); // 還沒行動過的大盲可以加注
    s = act(s, 2, { type: 'call' });
    expect(legalActions(s, 0)).toMatchObject({ canRaise: false, callAmount: 100 });
    expect(applyAction(s, 0, { type: 'raise', amount: 2000 }).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'allin' }).ok).toBe(false);
    s = act(s, 0, { type: 'call' });
    expect(s.phase).toBe('street-end');
  });

  it('完整加注會重新開放加注權', () => {
    let s = hand({ 0: 5000, 1: 5000, 2: 5000 }, 0, LV);
    s = act(s, 0, { type: 'raise', amount: 600 });
    s = act(s, 1, { type: 'fold' });
    s = act(s, 2, { type: 'raise', amount: 1000 });
    expect(legalActions(s, 0)).toMatchObject({ canRaise: true, minRaiseTo: 1400 });
  });

  it('其他人都已全下時只能跟注或棄牌', () => {
    let s = hand({ 0: 5000, 1: 1000, 2: 5000 }, 0, LV);
    s = act(s, 0, { type: 'fold' });
    s = act(s, 1, { type: 'allin' });
    expect(legalActions(s, 2)).toMatchObject({ canRaise: false, callAmount: 800 });
  });

  it('同一輪連續加注與河牌全部過牌', () => {
    let s = hand({ 0: 9000, 1: 9000 }, 0, LV, [['2h', '3d'], ['4h', '5d']], BOARD_DRY);
    s = act(s, 0, { type: 'raise', amount: 500 });
    s = act(s, 1, { type: 'raise', amount: 1200 });
    s = act(s, 0, { type: 'raise', amount: 2600 });
    s = act(s, 1, { type: 'call' });
    for (let street = 0; street < 3; street++) {
      s = advance(s);
      s = act(s, 1, { type: 'check' });
      s = act(s, 0, { type: 'check' });
    }
    s = finish(s);
    expect(s.results![0].amount).toBe(5200);
  });
});

describe('單挑（2 人）', () => {
  it('莊家放小盲，翻牌前先行動、翻牌後最後行動', () => {
    let s = hand({ 3: 5000, 7: 5000 }, 3, LV);
    expect(s.sb).toBe(3);
    expect(s.bb).toBe(7);
    expect(s.toAct).toBe(3);
    s = act(s, 3, { type: 'call' });
    expect(s.toAct).toBe(7); // 大盲的選擇權
    s = act(s, 7, { type: 'check' });
    s = advance(s);
    expect(s.toAct).toBe(7);
    s = act(s, 7, { type: 'check' });
    expect(s.toAct).toBe(3);
  });

  it('按鈕順時針移到下一位存活玩家', () => {
    expect(nextButton([1, 4, 6], 4)).toBe(6);
    expect(nextButton([1, 4, 6], 6)).toBe(1);
    expect(nextButton([1, 4, 6], 5)).toBe(6); // 原莊家已淘汰
  });
});

describe('平分底池', () => {
  it('splitPot：零頭給第一位', () => {
    expect([...splitPot(1001, [5, 2, 8])]).toEqual([
      [5, 335],
      [2, 333],
      [8, 333],
    ]);
  });

  it('除不盡的零頭給莊家左邊最近的贏家', () => {
    // 盲注 25/50：座位 0 跟注、小盲棄牌、大盲過牌 → 底池 125，座位 0 與 2 平分
    let s = hand({ 0: 5000, 1: 5000, 2: 5000 }, 0, level(25, 50), [['2h', '3d'], ['4h', '5d'], ['6h', '7d']], BOARD_ROYAL);
    s = act(s, 0, { type: 'call' });
    s = act(s, 1, { type: 'fold' });
    s = act(s, 2, { type: 'check' });
    for (let street = 0; street < 3; street++) {
      s = advance(s);
      s = act(s, 2, { type: 'check' });
      s = act(s, 0, { type: 'check' });
    }
    s = finish(s);
    expect(s.results![0].winners).toEqual([2, 0]); // 莊家（0）左邊是 1、2，所以 2 優先
    expect(stackOf(s, 2)).toBe(5000 - 50 + 63);
    expect(stackOf(s, 0)).toBe(5000 - 50 + 62);
  });
});

describe('盲注與前注不足', () => {
  it('付不起小盲 / 大盲時以剩餘籌碼全下', () => {
    const s = hand({ 0: 5000, 1: 60, 2: 150 }, 0, LV);
    expect(playerAt(s, 1)).toMatchObject({ bet: 60, stack: 0, allIn: true });
    expect(playerAt(s, 2)).toMatchObject({ bet: 150, stack: 0, allIn: true });
    expect(s.currentBet).toBe(200); // 其他人仍要跟完整大盲
    expect(legalActions(s, 0)!.callAmount).toBe(200);
  });

  it('大盲付完大盲後，前注以剩餘籌碼全下', () => {
    const s = hand({ 0: 5000, 1: 5000, 2: 700 }, 0, level(300, 600, 600));
    const bb = playerAt(s, 2);
    expect(bb).toMatchObject({ bet: 600, total: 700, stack: 0, allIn: true });
    expect(s.events.find((e) => e.t === 'post' && e.kind === 'ante')).toMatchObject({ amount: 100, allIn: true });
  });

  it('前注是死錢，大盲棄牌後也留在底池', () => {
    let s = hand({ 0: 5000, 1: 5000, 2: 5000 }, 0, level(300, 600, 600));
    s = act(s, 0, { type: 'raise', amount: 1800 });
    s = act(s, 1, { type: 'fold' });
    s = act(s, 2, { type: 'fold' });
    s = finish(s);
    expect(stackOf(s, 0)).toBe(5000 + 300 + 600 + 600);
  });

  it('只剩一人時直接贏得底池，不需亮牌', () => {
    let s = hand({ 0: 5000, 1: 5000 }, 0, LV);
    s = act(s, 0, { type: 'fold' });
    s = finish(s);
    expect(s.events.some((e) => e.t === 'reveal')).toBe(false);
    expect(s.results![0]).toMatchObject({ winners: [1], hand: null });
  });
});

describe('不合法動作', () => {
  it('不是自己的回合、可過牌時跟注、籌碼不足的下注都會被拒絕', () => {
    let s = hand({ 0: 1000, 1: 1000, 2: 1000 }, 0, LV);
    expect(applyAction(s, 1, { type: 'fold' }).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'raise', amount: 5000 }).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'check' }).ok).toBe(false);
    s = act(s, 0, { type: 'call' });
    s = act(s, 1, { type: 'call' });
    expect(applyAction(s, 2, { type: 'call' }).ok).toBe(false);
  });
});
