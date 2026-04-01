/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const SOUND_STORAGE_KEY = "emoji_merge_harbor_sound_on";

let soundMuted = false;

export function initSoundPreferenceFromStorage(): void {
  try {
    soundMuted = localStorage.getItem(SOUND_STORAGE_KEY) === "0";
  } catch {
    soundMuted = false;
  }
}

export function setSoundMuted(muted: boolean): void {
  soundMuted = muted;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, muted ? "0" : "1");
  } catch {
    /* ignore */
  }
}

export function isSoundMuted(): boolean {
  return soundMuted;
}

let audioCtx: AudioContext | null = null;

export function initAudio(): void {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
}

function ensureCtx(): AudioContext | null {
  initAudio();
  return audioCtx;
}

export const sounds = {
  merge(): void {
    if (soundMuted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, t0);
    osc.frequency.linearRampToValueAtTime(784, t0 + 0.15);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  },

  select(): void {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.15, t0 + 0.005);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.08);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.09);
  },

  orderComplete(): void {
    if (soundMuted) return;
    const c = ensureCtx();
    if (!c) return;
    const freqs = [523, 659, 784];
    const delay = 0.1;
    const dur = 0.12;
    const vol = 0.25;
    freqs.forEach((hz, i) => {
      const t0 = c.currentTime + i * delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
  },

  purchase(): void {
    if (soundMuted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(330, t0);
    osc.frequency.linearRampToValueAtTime(220, t0 + 0.2);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.2, t0 + 0.02);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.2);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  },

  levelUp(): void {
    if (soundMuted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const freqs = [523, 659, 1047];
    const peak = 0.15;
    freqs.forEach((hz) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.05);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.6);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.62);
    });
  },
};
