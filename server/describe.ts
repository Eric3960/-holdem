// 把引擎事件轉成：籌碼動畫、手牌紀錄文字、座位上的行動標籤
import type { Card, FlightKind } from '../shared/types';
import type { HandEvent, HandState } from './engine/hand';

const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const cardText = (c: Card) => `${c[0] === 'T' ? '10' : c[0]}${SUIT[c[1]]}`;
const cardsText = (cs: Card[]) => cs.map(cardText).join(' ');
const fmt = (n: number) => n.toLocaleString('en-US');

const STREET_NAME = { preflop: '翻牌前', flop: '翻牌', turn: '轉牌', river: '河牌' };
const ACTION_LABEL = { fold: '棄牌', check: '過牌', call: '跟注', bet: '下注', raise: '加注', allin: '全下' };
const POST_LABEL = { sb: '小盲', bb: '大盲', ante: '前注' };

export interface Described {
  seat?: number;
  flight?: { kind: FlightKind; seat: number; amount: number };
  line?: string;
  lastAction?: string | null;
}

export function describeEvent(e: HandEvent, h: HandState, nameOf: (seat: number) => string): Described {
  switch (e.t) {
    case 'post':
      return {
        seat: e.seat,
        flight: { kind: e.kind === 'ante' ? 'ante' : 'bet', seat: e.seat, amount: e.amount },
        line: `${nameOf(e.seat)} 付${POST_LABEL[e.kind]} ${fmt(e.amount)}${e.allIn ? '（全下）' : ''}`,
        ...(e.kind === 'ante' ? {} : { lastAction: POST_LABEL[e.kind] }),
      };
    case 'act': {
      const label = ACTION_LABEL[e.action];
      const amount = e.action === 'call' ? ` ${fmt(e.amount)}` : ['bet', 'raise', 'allin'].includes(e.action) ? ` 到 ${fmt(e.to)}` : '';
      return {
        seat: e.seat,
        flight: e.amount > 0 ? { kind: 'bet', seat: e.seat, amount: e.amount } : undefined,
        line: `${nameOf(e.seat)} ${label}${amount}`,
        lastAction: label,
      };
    }
    case 'collect':
      return { flight: { kind: 'collect', seat: e.seat, amount: e.amount } };
    case 'refund':
      return { flight: { kind: 'refund', seat: e.seat, amount: e.amount }, line: `退回 ${nameOf(e.seat)} 沒人跟的 ${fmt(e.amount)}` };
    case 'street':
      return { line: `— ${STREET_NAME[e.street]} ${cardsText(h.board)} —` };
    case 'reveal':
      return { line: `${nameOf(e.seat)} 亮牌 ${cardsText(e.cards)}` };
    case 'win': {
      const potName = h.results && h.results.length > 1 ? (e.pot === 0 ? '主池' : `邊池 ${e.pot}`) : '底池';
      return {
        seat: e.seat,
        flight: { kind: 'win', seat: e.seat, amount: e.amount },
        line: `${nameOf(e.seat)} 贏得${potName} ${fmt(e.amount)}${e.hand ? `（${e.hand}）` : ''}`,
        lastAction: '贏家',
      };
    }
  }
}
