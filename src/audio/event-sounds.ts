import { Block } from '@/game/blocks';
import type { GameEvent } from '@/game/game';

import type { SoundName } from './sources';

export type Material = 'soft' | 'stone' | 'sand' | 'wood' | 'leaves';

/** The sound family a block belongs to. */
export function materialOf(block: number): Material {
  switch (block) {
    case Block.Stone:
    case Block.CoalOre:
    case Block.IronOre:
    case Block.Bedrock:
    case Block.CrystalOre:
    case Block.Beacon:
      return 'stone';
    case Block.Sand:
      return 'sand';
    case Block.Wood:
    case Block.Planks:
    case Block.Torch:
      return 'wood';
    case Block.Leaves:
    case Block.BerryBush:
      return 'leaves';
    default:
      return 'soft';
  }
}

export function footstepSound(block: number, variant: 0 | 1): SoundName {
  const material = materialOf(block);
  const surface = material === 'leaves' ? 'soft' : material;
  return `step_${surface}_${variant + 1}` as SoundName;
}

function digSound(block: number): SoundName {
  const material = materialOf(block);
  return material === 'sand' ? 'dig_soft' : (`dig_${material}` as SoundName);
}

function breakSound(block: number): SoundName {
  const material = materialOf(block);
  return material === 'sand' ? 'break_soft' : (`break_${material}` as SoundName);
}

export type SoundCue = { name: SoundName; volume: number; rate?: number };

/**
 * Sounds for one game event, quietest effects first so the important ones are not cut off.
 * Footsteps are handled separately because they alternate variants and are throttled.
 */
export function soundsForEvent(event: GameEvent): SoundCue[] {
  switch (event.type) {
    case 'dig':
      return [{ name: digSound(event.block), volume: 0.7 }];
    case 'mined': {
      const cues: SoundCue[] = [{ name: breakSound(event.block), volume: 0.9 }];
      if (event.item !== null && event.lost === 0) cues.push({ name: 'pickup', volume: 0.45 });
      return cues;
    }
    case 'placed':
      return [event.block === Block.Torch ? { name: 'torch_place', volume: 0.8 } : { name: 'place', volume: 0.8 }];
    case 'jump':
      return [{ name: 'jump', volume: 0.45 }];
    case 'land':
      return [{ name: 'land', volume: 0.7 }];
    case 'hurt':
      return [{ name: 'hurt', volume: 0.85 }];
    case 'died':
      return [{ name: 'hurt', volume: 1, rate: 0.8 }];
    case 'swing':
      return [{ name: 'swing', volume: 0.5 }];
    case 'monster-hit':
      return [
        { name: 'swing', volume: 0.45 },
        { name: 'monster_hit', volume: 0.9 },
      ];
    case 'monster-defeated':
      return [{ name: 'monster_die', volume: 0.9 }];
    case 'monster-burned':
      return [{ name: 'monster_die', volume: 0.45, rate: 1.25 }];
    case 'monster-growl': {
      const volume = Math.max(0.15, 1 - event.distance / 16) * 0.8;
      return [{ name: 'monster_growl', volume }];
    }
    case 'quest':
      return [{ name: 'quest', volume: 0.9 }];
    case 'crafted':
      return [{ name: 'craft', volume: 0.8 }];
    case 'ate':
      return [{ name: 'eat', volume: 0.8 }];
    case 'won':
      return [{ name: 'win', volume: 1 }];
    default:
      return [];
  }
}

/** Ambient mix for the time of day. Underground the outdoor loops fade down. */
export function ambientMix(daylight: number, depth: number): { day: number; night: number } {
  // daylight runs 0.12 (midnight) to 1 (noon); map it to 0..1 and ease the crossfade.
  const k = Math.max(0, Math.min(1, (daylight - 0.2) / 0.6));
  const day = k * k * (3 - 2 * k);
  const outdoors = depth <= 4 ? 1 : depth >= 16 ? 0.25 : 1 - ((depth - 4) / 12) * 0.75;
  return { day: day * outdoors, night: (1 - day) * outdoors };
}
