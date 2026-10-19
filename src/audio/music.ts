// 即時演奏的輕爵士背景音樂：電鋼琴和弦 + 低音 + 刷鼓 + 偶爾的旋律裝飾。
// 每次和弦節奏與旋律都會隨機變化，聽起來不會像短循環。
import { audio, midi, musicOutput } from './sound';

const BPM = 76;
const BEAT = 60 / BPM;
const SWING = 0.62; // 搖擺八分音符：後半拍延後

// 每個和弦：低音根音、電鋼琴聲部（MIDI 音高）
const PROGRESSIONS = [
  [
    { bass: 38, keys: [53, 57, 60, 64] }, // Dm9
    { bass: 43, keys: [53, 59, 64, 69] }, // G13
    { bass: 36, keys: [52, 55, 59, 62] }, // Cmaj9
    { bass: 45, keys: [55, 61, 65, 69] }, // A7(b13)
  ],
  [
    { bass: 41, keys: [52, 57, 60, 64] }, // Fmaj7
    { bass: 40, keys: [50, 55, 59, 62] }, // Em7
    { bass: 38, keys: [53, 57, 60, 64] }, // Dm9
    { bass: 43, keys: [53, 59, 64, 69] }, // G13
  ],
];
const MELODY = [72, 74, 76, 79, 81, 84]; // C 大調五聲音階

function epiano(freq: number, t: number, dur: number, gain: number, dest: AudioNode) {
  const c = audio();
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  out.gain.exponentialRampToValueAtTime(gain * 0.35, t + 0.4);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  for (const [mult, type, g] of [[1, 'sine', 1], [2, 'triangle', 0.15], [1.003, 'sine', 0.5]] as const) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = type;
    o.frequency.value = freq * mult;
    og.gain.value = g;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lp.connect(out).connect(dest);
}

function bassNote(freq: number, t: number, dur: number, dest: AudioNode) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function brush(t: number, gain: number, dest: AudioNode) {
  const c = audio();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate / 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(f).connect(g).connect(dest);
  src.start(t);
  src.stop(t + 0.15);
}

/** 排一個小節（4 拍）的所有音符 */
function scheduleBar(start: number, chord: { bass: number; keys: number[] }, next: { bass: number }, dest: AudioNode) {
  // 低音：根音 → 五度 → 根音 → 往下一個和弦的經過音
  const walk = [chord.bass, chord.bass + 7, chord.bass + 12 * (Math.random() < 0.5 ? 1 : 0), next.bass + (Math.random() < 0.5 ? 1 : -1)];
  walk.forEach((m, i) => bassNote(midi(m), start + i * BEAT, BEAT * 0.9, dest));

  // 電鋼琴：隨機挑一種伴奏節奏（單位：拍）
  const patterns = [[0, 2.62], [0.62, 2], [0, 1.62, 3], [1, 2.62], [0.62, 2.62]];
  const rhythm = patterns[Math.floor(Math.random() * patterns.length)];
  for (const beat of rhythm) {
    const t = start + beat * BEAT;
    chord.keys.forEach((m, i) => epiano(midi(m), t + i * 0.008, BEAT * 1.6, 0.07, dest));
  }

  // 刷鼓：搖擺的 ride 節奏，2、4 拍稍重
  for (let b = 0; b < 4; b++) {
    brush(start + b * BEAT, b % 2 ? 0.05 : 0.03, dest);
    if (b % 2) brush(start + (b + SWING) * BEAT, 0.02, dest);
  }

  // 偶爾來一小段旋律
  if (Math.random() < 0.45) {
    let note = MELODY[Math.floor(Math.random() * MELODY.length)];
    const steps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
      epiano(midi(note), start + (2 + i * SWING) * BEAT, BEAT * 1.2, 0.05, dest);
      note = MELODY[Math.max(0, Math.min(MELODY.length - 1, MELODY.indexOf(note) + (Math.random() < 0.5 ? -1 : 1)))];
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let nextBarAt = 0;
let bar = 0;
let prog = PROGRESSIONS[0];

export function startMusic() {
  if (timer) return;
  const c = audio();
  nextBarAt = c.currentTime + 0.2;
  // 每 0.25 秒檢查一次，提前排好接下來 1.5 秒內要播的小節
  timer = setInterval(() => {
    if (document.hidden) return; // 分頁在背景時不排新音符
    const dest = musicOutput();
    if (nextBarAt < c.currentTime) nextBarAt = c.currentTime + 0.1; // 從背景回來時重新對齊，不補播錯過的小節
    while (nextBarAt < c.currentTime + 1.5) {
      if (bar % 4 === 0 && bar > 0 && Math.random() < 0.5) prog = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
      scheduleBar(nextBarAt, prog[bar % 4], prog[(bar + 1) % 4], dest);
      nextBarAt += 4 * BEAT;
      bar++;
    }
  }, 250);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
}
