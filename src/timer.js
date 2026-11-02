// Pomodoro-style study timer. State lives in settings so it survives page loads.
import { S, save } from './settings.js';
import { changed, hooks } from './store.js';
import { esc } from './util.js';

const PRESETS = [
  [25, 5],
  [50, 10],
  [90, 15],
];

const T = () => S.timer;
const today = () => new Date().toDateString();
const phaseMinutes = () => (T().phase === 'focus' ? Number(T().focus) : Number(T().brk)) || 25;

export const remaining = (now = Date.now()) => {
  const t = T();
  if (t.endsAt) return Math.max(0, t.endsAt - now);
  return t.left || phaseMinutes() * 6e4;
};

export const running = () => !!T().endsAt;

const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const timerChip = () => (running() ? `${T().phase === 'focus' ? 'Focus' : 'Break'} ${mmss(remaining())}` : '');

export const timerView = () => {
  const t = T();
  if (t.doneDay !== today()) {
    t.done = 0;
    t.doneDay = today();
  }
  const preset = `${t.focus}/${t.brk}`;
  return `
    <div class="timer">
      <div class="timer-face ${t.phase}">
        <span class="phase">${t.phase === 'focus' ? 'Focus' : 'Break'}</span>
        <b data-timer-display>${mmss(remaining())}</b>
        <span class="hint">${t.done} focus session${t.done === 1 ? '' : 's'} today</span>
      </div>
      <div class="btns">
        ${running()
          ? '<button class="btn" data-act="timer-pause">Pause</button>'
          : `<button class="btn" data-act="timer-start">${t.left ? 'Resume' : 'Start'}</button>`}
        <button class="btn ghost" data-act="timer-reset">Reset</button>
        <button class="btn ghost" data-act="timer-skip">Skip to ${t.phase === 'focus' ? 'break' : 'focus'}</button>
      </div>
      <label class="inline">Length
        <select id="timer-preset" data-timer-preset aria-label="Timer length">
          ${PRESETS.map(([f, b]) => `<option value="${f}/${b}" ${preset === `${f}/${b}` ? 'selected' : ''}>${f} min focus, ${b} min break</option>`).join('')}
          ${PRESETS.some(([f, b]) => preset === `${f}/${b}`) ? '' : `<option selected value="${esc(preset)}">${esc(t.focus)} / ${esc(t.brk)}</option>`}
        </select>
      </label>
    </div>`;
};

export const timerAction = (act, value) => {
  const t = T();
  if (act === 'start') {
    t.endsAt = Date.now() + remaining();
    t.left = 0;
    unlockAudio();
  } else if (act === 'pause') {
    t.left = remaining();
    t.endsAt = 0;
  } else if (act === 'reset') {
    t.endsAt = 0;
    t.left = 0;
    t.phase = 'focus';
  } else if (act === 'skip') {
    t.phase = t.phase === 'focus' ? 'break' : 'focus';
    t.left = 0;
    t.endsAt = running() ? Date.now() + phaseMinutes() * 6e4 : 0;
  } else if (act === 'preset') {
    const [f, b] = String(value).split('/').map(Number);
    t.focus = f;
    t.brk = b;
    t.left = 0;
    if (running()) t.endsAt = Date.now() + phaseMinutes() * 6e4;
  }
  save();
  changed();
};

let audio = null;
const unlockAudio = () => {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e) {
    audio = null;
  }
};

const chime = () => {
  if (!audio) return;
  [0, 0.18, 0.36].forEach((at, i) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = [660, 880, 990][i];
    g.gain.setValueAtTime(0.0001, audio.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.3);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + at);
    o.stop(audio.currentTime + at + 0.32);
  });
};

const finish = () => {
  const t = T();
  const wasFocus = t.phase === 'focus';
  if (wasFocus) {
    if (t.doneDay !== today()) {
      t.done = 0;
      t.doneDay = today();
    }
    t.done++;
  }
  t.phase = wasFocus ? 'break' : 'focus';
  t.endsAt = Date.now() + phaseMinutes() * 6e4;
  t.left = 0;
  save();
  chime();
  const msg = wasFocus ? `Focus session done. Take ${t.brk} minutes.` : 'Break’s over. Back to it.';
  hooks.toast(msg, { kind: 'timer' });
  hooks.notify && hooks.notify('Quad timer', msg);
  changed();
};

// Ticks once a second, updating the clock text without re-rendering everything.
export const startTicker = (getRoots) => {
  setInterval(() => {
    if (!running()) return;
    if (remaining() <= 0) {
      finish();
      return;
    }
    const text = mmss(remaining());
    getRoots().forEach((root) => {
      root.querySelectorAll('[data-timer-display]').forEach((el) => {
        if (el.textContent !== text) el.textContent = text;
      });
      const chip = root.querySelector('[data-timer-chip]');
      if (chip) chip.textContent = timerChip();
    });
  }, 1000);
};
