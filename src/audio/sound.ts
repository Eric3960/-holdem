// 所有聲音都用 Web Audio API 即時合成，不需要音檔，也沒有版權問題。
// 瀏覽器規定使用者點擊過頁面後才能出聲，第一次點擊時會自動解鎖。

export interface AudioPrefs {
  sfx: boolean;
  sfxVolume: number; // 0～1
  music: boolean;
  musicVolume: number;
}

const DEFAULT_PREFS: AudioPrefs = { sfx: true, sfxVolume: 0.7, music: false, musicVolume: 0.4 };
const KEY = 'holdem-audio';

export function loadPrefs(): AudioPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: AudioPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 無法儲存時只影響下次開啟的預設值 */
  }
}

let ctx: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;
let prefs = loadPrefs();

export function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor(); // 避免多個聲音疊在一起時爆音
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(comp);
    musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyPrefs(prefs);
  }
  return ctx;
}

export const musicOutput = () => (audio(), musicBus);

export function applyPrefs(p: AudioPrefs) {
  prefs = p;
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(p.sfx ? p.sfxVolume : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(p.music ? p.musicVolume * 0.5 : 0, ctx.currentTime, 0.3);
}

/** 第一次點擊或按鍵時解鎖音訊 */
export function installUnlock(onUnlock?: () => void) {
  const unlock = () => {
    audio().resume().then(() => onUnlock?.());
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// ---------- 合成用的小工具 ----------

const ready = () => !!ctx && ctx.state === 'running' && prefs.sfx;
export const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface ToneOpts {
  freq: number;
  at?: number; // 相對現在的秒數
  dur: number;
  gain?: number;
  type?: OscillatorType;
  freqEnd?: number;
  attack?: number;
  dest?: AudioNode;
}

export function tone({ freq, at = 0, dur, gain = 0.3, type = 'sine', freqEnd, attack = 0.005, dest }: ToneOpts) {
  const c = audio();
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest ?? sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface NoiseOpts {
  at?: number;
  dur: number;
  gain?: number;
  filter?: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  dest?: AudioNode;
}

export function noise({ at = 0, dur, gain = 0.3, filter = 'bandpass', freq, freqEnd, q = 1, dest }: NoiseOpts) {
  const c = audio();
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest ?? sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// ---------- 遊戲音效 ----------

/** 單顆籌碼的「喀」：高頻敲擊 + 短促金屬泛音 */
function chipClick(at: number, gain = 0.5) {
  noise({ at, dur: 0.035, gain, freq: 4200 + Math.random() * 1500, q: 3 });
  tone({ freq: 2500 + Math.random() * 600, at, dur: 0.06, gain: gain * 0.25, type: 'triangle' });
}

export const sfx = {
  /** 下注：2～3 顆籌碼落在桌上 */
  bet(amount = 0) {
    if (!ready()) return;
    const n = amount >= 2000 ? 4 : amount >= 500 ? 3 : 2;
    for (let i = 0; i < n; i++) chipClick(i * 0.045 + Math.random() * 0.01, 0.45);
  },
  /** 收進底池：一串比較輕的滑動籌碼聲 */
  collect() {
    if (!ready()) return;
    noise({ dur: 0.25, gain: 0.12, freq: 3000, freqEnd: 1500, q: 0.8 });
    for (let i = 0; i < 4; i++) chipClick(0.05 + i * 0.05, 0.22);
  },
  /** 發牌：紙牌劃過桌面的「刷」 */
  deal(at = 0) {
    if (!ready()) return;
    noise({ at, dur: 0.09, gain: 0.35, freq: 1800, freqEnd: 6000, q: 0.7 });
    noise({ at: at + 0.06, dur: 0.03, gain: 0.15, filter: 'lowpass', freq: 900 });
  },
  /** 新的一手：洗牌 + 發兩張底牌 */
  newHand() {
    if (!ready()) return;
    for (let i = 0; i < 6; i++) noise({ at: i * 0.035, dur: 0.05, gain: 0.12, freq: 3500, q: 0.6 });
    sfx.deal(0.3);
    sfx.deal(0.45);
  },
  /** 過牌：手指敲桌兩下 */
  check() {
    if (!ready()) return;
    for (const at of [0, 0.13]) {
      tone({ freq: 170, freqEnd: 80, at, dur: 0.09, gain: 0.5 });
      noise({ at, dur: 0.05, gain: 0.25, filter: 'lowpass', freq: 500 });
    }
  },
  /** 棄牌：牌往前推的輕刷聲 */
  fold() {
    if (!ready()) return;
    noise({ dur: 0.22, gain: 0.18, freq: 2500, freqEnd: 700, q: 0.6 });
  },
  /** 全下：低音上升 + 和弦重音 */
  allIn() {
    if (!ready()) return;
    tone({ freq: 110, freqEnd: 440, dur: 0.45, gain: 0.18, type: 'sawtooth' });
    for (const m of [57, 64, 69]) tone({ freq: midi(m), at: 0.4, dur: 0.6, gain: 0.12, type: 'triangle' });
    noise({ at: 0.4, dur: 0.3, gain: 0.15, filter: 'highpass', freq: 5000 });
  },
  /** 輪到你：清脆的兩音提示 */
  yourTurn() {
    if (!ready()) return;
    tone({ freq: midi(76), dur: 0.35, gain: 0.25 });
    tone({ freq: midi(76) * 2, dur: 0.2, gain: 0.06 });
    tone({ freq: midi(83), at: 0.14, dur: 0.5, gain: 0.25 });
    tone({ freq: midi(83) * 2, at: 0.14, dur: 0.25, gain: 0.06 });
  },
  /** 倒數最後幾秒：木魚滴答，越接近 0 越高 */
  tick(secondsLeft: number) {
    if (!ready()) return;
    tone({ freq: secondsLeft <= 2 ? 1600 : 1200, dur: 0.05, gain: 0.25, type: 'square' });
  },
  /** 贏得底池：上行琶音 + 一串籌碼 */
  win(big = false) {
    if (!ready()) return;
    [72, 76, 79, 84].forEach((m, i) => tone({ freq: midi(m), at: i * 0.08, dur: 0.4, gain: 0.16, type: 'triangle' }));
    const n = big ? 10 : 6;
    for (let i = 0; i < n; i++) chipClick(0.25 + i * (0.04 + Math.random() * 0.03), 0.3);
  },
  /** 盲注升級：鐘聲 */
  levelUp() {
    if (!ready()) return;
    for (const [m, g] of [[84, 0.2], [91, 0.08], [96, 0.05]] as const) tone({ freq: midi(m), dur: 1.6, gain: g });
    tone({ freq: midi(79), at: 0.25, dur: 1.4, gain: 0.15 });
  },
  /** 有人淘汰：下行兩音 */
  bust() {
    if (!ready()) return;
    tone({ freq: midi(67), dur: 0.3, gain: 0.18, type: 'triangle' });
    tone({ freq: midi(60), at: 0.22, dur: 0.6, gain: 0.18, type: 'triangle' });
  },
  /** 比賽結束：號角和弦 */
  fanfare() {
    if (!ready()) return;
    [60, 64, 67, 72].forEach((m, i) => tone({ freq: midi(m), at: i * 0.12, dur: 0.3, gain: 0.15, type: 'sawtooth' }));
    for (const m of [60, 64, 67, 72, 76]) tone({ freq: midi(m), at: 0.5, dur: 1.8, gain: 0.08, type: 'sawtooth', attack: 0.05 });
  },
  /** 設定面板試聽用 */
  preview() {
    sfx.bet(1000);
  },
};
