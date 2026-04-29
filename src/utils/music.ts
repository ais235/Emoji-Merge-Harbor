/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const MUSIC_STORAGE_KEY = "emoji_merge_harbor_music_on";

const MUSIC_TRACKS = [
  "/music/lofi_music_library-chill-amp-relaxing-lofi-music-455381.mp3",
  "/music/lofi_music_library-coffee-lofi-chill-lofi-ambient-458901.mp3",
  "/music/playlistsons-coffee-with-jazz-327479.mp3",
  "/music/waveloom-jazz-cafe-516774.mp3",
];

let musicEnabled = true;
let audioEl: HTMLAudioElement | null = null;
let activeTrackIndex = 0;
let userActivated = false;
let runtimeBound = false;

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audioEl) return audioEl;
  if (MUSIC_TRACKS.length === 0) return null;
  audioEl = new Audio(MUSIC_TRACKS[activeTrackIndex]);
  audioEl.preload = "auto";
  audioEl.loop = false;
  audioEl.volume = 0.34;
  audioEl.addEventListener("ended", () => {
    activeTrackIndex = (activeTrackIndex + 1) % MUSIC_TRACKS.length;
    if (audioEl) {
      audioEl.src = MUSIC_TRACKS[activeTrackIndex];
    }
    void playBackgroundMusicIfAllowed();
  });
  return audioEl;
}

function canPlayNow(): boolean {
  if (typeof document === "undefined") return false;
  if (!musicEnabled) return false;
  if (!userActivated) return false;
  if (document.visibilityState !== "visible") return false;
  if (!document.hasFocus()) return false;
  return true;
}

function pauseBackgroundMusic(): void {
  if (!audioEl) return;
  audioEl.pause();
}

export function playBackgroundMusicIfAllowed(): Promise<void> {
  const a = ensureAudio();
  if (!a || !canPlayNow()) {
    pauseBackgroundMusic();
    return Promise.resolve();
  }
  return a.play().catch(() => undefined);
}

export function initMusicPreferenceFromStorage(): void {
  try {
    const v = localStorage.getItem(MUSIC_STORAGE_KEY);
    musicEnabled = v == null ? true : v === "1";
  } catch {
    musicEnabled = true;
  }
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled;
  try {
    localStorage.setItem(MUSIC_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!enabled) {
    pauseBackgroundMusic();
    return;
  }
  void playBackgroundMusicIfAllowed();
}

export function setupMusicRuntime(): void {
  if (typeof window === "undefined" || runtimeBound) return;
  runtimeBound = true;

  const activateByUserGesture = () => {
    userActivated = true;
    void playBackgroundMusicIfAllowed();
  };
  window.addEventListener("pointerdown", activateByUserGesture, { passive: true });
  window.addEventListener("keydown", activateByUserGesture);
  window.addEventListener("touchstart", activateByUserGesture, { passive: true });

  const refresh = () => {
    void playBackgroundMusicIfAllowed();
  };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("blur", refresh);
}

