// 前後端共用型別
export type Card = string; // 例如 'As'、'Td'
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

/** 玩家送出的意圖；bet / raise 的 amount 為「本輪下注到」的總額 */
export interface PlayerIntent {
  type: ActionType;
  amount?: number;
}

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
}

export type TimeLimitMode = 'sudden-death' | 'chip-count';

export interface RoomSettings {
  levelMinutes: number;
  actionSeconds: number;
  timeBankSeconds: number;
  allowRebuy: boolean;
  timeLimitMode: TimeLimitMode;
  timeLimitMinutes: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  levelMinutes: 8,
  actionSeconds: 25,
  timeBankSeconds: 60,
  allowRebuy: true,
  timeLimitMode: 'sudden-death',
  timeLimitMinutes: 75,
};

export const SETTING_LIMITS = {
  levelMinutes: [4, 15],
  actionSeconds: [10, 60],
  timeBankSeconds: [0, 180],
  timeLimitMinutes: [30, 180],
} as const;

export const STARTING_STACK = 10_000;
export const MAX_PLAYERS = 9;
export const MIN_PLAYERS = 2;
export const REBUY_MAX_LEVEL = 3;

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  /** 跟注需要補的金額（不足時為全下金額）；可過牌時為 0 */
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  /** 下注 / 加注到的最小總額（籌碼不足時等於全下總額） */
  minRaiseTo: number;
  maxRaiseTo: number;
}

export type FlightKind = 'bet' | 'ante' | 'collect' | 'refund' | 'win';
export interface Flight {
  id: number;
  kind: FlightKind;
  seat: number;
  amount: number;
}

export interface SeatView {
  seat: number;
  name: string;
  avatar: string;
  isBot: boolean;
  isHost: boolean;
  isMe: boolean;
  stack: number;
  bet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  connected: boolean;
  away: boolean;
  eliminated: boolean;
  place: number | null;
  timeBank: number; // 秒
  /** 自己或已亮牌時為牌面，否則 null 代表牌背；未參與本手為空陣列 */
  cards: (Card | null)[];
  lastAction: string | null;
}

export interface PotView {
  amount: number;
  label: string; // 主池 / 邊池 1 …
}

export interface HandView {
  handNo: number;
  level: BlindLevel;
  street: Street;
  phase: 'betting' | 'street-end' | 'showdown' | 'complete';
  board: Card[];
  pots: PotView[];
  toAct: number;
  currentBet: number;
  button: number;
  sb: number;
  bb: number;
  winners: number[];
  resultText: string | null;
  /** 自己是唯一未棄牌的贏家、可選擇亮牌 */
  canShow: boolean;
}

export interface TurnView {
  seat: number;
  deadline: number; // 伺服器時間 ms
  usingBank: boolean;
  totalMs: number; // 這段倒數的總長度（用於倒數條）
}

export interface Standing {
  place: number;
  seat: number;
  name: string;
  avatar: string;
  stack: number;
}

export interface TournamentView {
  status: 'lobby' | 'running' | 'finished';
  settings: RoomSettings;
  startedAt: number | null;
  level: BlindLevel; // 時鐘上的目前級別（下一手生效）
  nextLevelAt: number | null;
  timeLimitAt: number | null;
  overtime: boolean;
  timeScale: number;
  entrants: number;
  remaining: number;
  eliminations: { seat: number; name: string; place: number | null; handNo: number }[];
  standings: Standing[] | null; // 比賽結束時
  endReason: string | null;
  canRebuy: boolean;
  rebuyWaitUntil: number | null;
  message: string | null;
}

export interface HandRecord {
  handNo: number;
  level: number;
  lines: string[];
}

export interface TableView {
  code: string;
  mySeat: number;
  isHost: boolean;
  serverNow: number;
  players: SeatView[];
  hand: HandView | null;
  legal: LegalActions | null;
  turn: TurnView | null;
  tournament: TournamentView;
  history: HandRecord[];
  flights: Flight[];
}

export interface JoinRequest {
  code?: string; // 不給 = 建立新房間
  name: string;
  avatar: string;
  token: string;
}

export type Ack = { ok: true; code?: string } | { ok: false; error: string };

export interface ClientToServer {
  join: (req: JoinRequest, ack: (res: Ack) => void) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  addBot: () => void;
  removeBot: () => void;
  start: (ack: (res: Ack) => void) => void;
  act: (intent: PlayerIntent, ack: (res: Ack) => void) => void;
  rebuy: () => void;
  setAway: (away: boolean) => void;
  showCards: () => void;
}

export interface ServerToClient {
  state: (view: TableView) => void;
}

export const AVATARS = ['😎', '🦊', '🐼', '🐯', '🐰', '🐸', '🦁', '🐨', '🐙', '🐵', '🐻', '🐷'];
