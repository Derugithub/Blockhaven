import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState, type NativeEventSubscription } from 'react-native';

import { SOUND_SOURCES, type SoundName } from './sources';

/** Players per effect. Effects that can overlap get two so a new hit does not cut the last one off. */
const POOL_SIZES: Partial<Record<SoundName, number>> = {
  place: 2,
  break_soft: 2,
  break_stone: 2,
  monster_growl: 2,
};

const AMBIENT: SoundName[] = ['ambient_day', 'ambient_night'];
/** Ambient loops sit well under the effects. */
const AMBIENT_LEVEL = 0.55;
/** Seconds between two footsteps at most; extra steps are dropped. */
const STEP_GAP_MS = 170;

export type AudioSettings = { soundEffects: boolean; music: boolean; volume: number };

type Pool = { players: AudioPlayer[]; next: number };

/**
 * Small sound engine on top of expo-audio. All players are created up front when a world opens
 * (so the first dig does not stutter) and released when it closes. Effects are fire-and-forget:
 * a pooled player is rewound and played, which costs one native call and no JS work per frame.
 */
class SoundManager {
  private pools = new Map<SoundName, Pool>();
  private ambient = new Map<SoundName, AudioPlayer>();
  private users = 0;
  private settings: AudioSettings = { soundEffects: true, music: true, volume: 8 };
  private ambientTarget = { day: 0, night: 0 };
  private foreground = AppState.currentState === 'active';
  private paused = false;
  private appSub: NativeEventSubscription | null = null;
  private lastStep = 0;
  private modeSet = false;

  /** Loads every sound. Call once per screen that plays audio; pair with release(). */
  acquire(): void {
    this.users++;
    if (this.users > 1) return;
    if (!this.modeSet) {
      this.modeSet = true;
      setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
      }).catch(() => undefined);
    }
    for (const name of Object.keys(SOUND_SOURCES) as SoundName[]) {
      if (AMBIENT.includes(name)) continue;
      const size = POOL_SIZES[name] ?? 1;
      const players: AudioPlayer[] = [];
      for (let i = 0; i < size; i++) {
        try {
          players.push(createAudioPlayer(SOUND_SOURCES[name]));
        } catch {
          // A missing player only means that sound stays silent.
        }
      }
      this.pools.set(name, { players, next: 0 });
    }
    for (const name of AMBIENT) {
      try {
        const player = createAudioPlayer(SOUND_SOURCES[name]);
        player.loop = true;
        player.volume = 0;
        this.ambient.set(name, player);
      } catch {
        // Ambient is optional.
      }
    }
    this.appSub = AppState.addEventListener('change', (state) => {
      this.foreground = state === 'active';
      this.applyAmbient();
    });
    this.applyAmbient();
  }

  release(): void {
    this.users = Math.max(0, this.users - 1);
    if (this.users > 0) return;
    this.appSub?.remove();
    this.appSub = null;
    for (const pool of this.pools.values()) for (const player of pool.players) safeRemove(player);
    for (const player of this.ambient.values()) safeRemove(player);
    this.pools.clear();
    this.ambient.clear();
  }

  configure(settings: AudioSettings): void {
    this.settings = settings;
    this.applyAmbient();
  }

  /** Pauses the ambient loops (game paused or a menu open). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.applyAmbient();
  }

  private master(): number {
    return Math.max(0, Math.min(1, this.settings.volume / 10));
  }

  play(name: SoundName, volume = 1, rate = 1): void {
    if (!this.settings.soundEffects || !this.foreground) return;
    const level = this.master() * volume;
    if (level <= 0.01) return;
    const pool = this.pools.get(name);
    if (!pool || pool.players.length === 0) return;
    const player = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    try {
      player.volume = Math.min(1, level);
      if (player.playbackRate !== rate) player.setPlaybackRate(rate);
      void player.seekTo(0).catch(() => undefined);
      player.play();
    } catch {
      // Never let a sound break the game loop.
    }
  }

  /** Footsteps are throttled so fast walking or a laggy frame never machine-guns them. */
  step(name: SoundName, nowMs: number, volume = 0.55): void {
    if (nowMs - this.lastStep < STEP_GAP_MS) return;
    this.lastStep = nowMs;
    // A small random pitch change keeps repeated steps from sounding mechanical.
    this.play(name, volume, 0.92 + Math.random() * 0.16);
  }

  /** Sets the day and night ambient levels (0 to 1 each). Cheap to call every few frames. */
  setAmbient(day: number, night: number): void {
    if (Math.abs(day - this.ambientTarget.day) < 0.02 && Math.abs(night - this.ambientTarget.night) < 0.02) return;
    this.ambientTarget = { day, night };
    this.applyAmbient();
  }

  private applyAmbient(): void {
    const on = this.settings.music && this.foreground && !this.paused && this.users > 0;
    const levels: Record<string, number> = { ambient_day: this.ambientTarget.day, ambient_night: this.ambientTarget.night };
    for (const [name, player] of this.ambient) {
      try {
        const level = this.master() * AMBIENT_LEVEL * (levels[name] ?? 0);
        if (on && level > 0.01) {
          player.volume = level;
          if (!player.playing) player.play();
        } else if (player.playing) {
          player.pause();
        }
      } catch {
        // Ignore: ambient is decoration.
      }
    }
  }
}

function safeRemove(player: AudioPlayer): void {
  try {
    player.pause();
    player.remove();
  } catch {
    // Already gone.
  }
}

export const sounds = new SoundManager();
