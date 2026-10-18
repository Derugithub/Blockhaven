import { foodValue } from './blocks';
import { MAX_HEALTH, hurtPlayer, type Player } from './player';

export const MAX_HUNGER = 10;
/** Seconds for hunger to drop by one point while standing around. Moving drains a little faster. */
export const HUNGER_SECONDS = 72;
/** Hunger needed before health comes back on its own. */
export const REGEN_MIN_HUNGER = 4;
/** Seconds between regenerated health points. */
export const REGEN_SECONDS = 4;
/** Seconds between starvation damage when hunger is empty. Starving never kills: it stops at 1 health. */
export const STARVE_SECONDS = 8;
/** Hunger spent for each regenerated health point. */
const REGEN_COST = 0.5;

export type Difficulty = 'normal' | 'peaceful';

export const DIFFICULTIES: Difficulty[] = ['normal', 'peaceful'];

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'normal' || value === 'peaceful';
}

export type Survival = {
  /** 0 to MAX_HUNGER. In peaceful mode it stays full. */
  hunger: number;
  regenTimer: number;
  starveTimer: number;
};

export function createSurvival(): Survival {
  return { hunger: MAX_HUNGER, regenTimer: 0, starveTimer: 0 };
}

export type SurvivalTick = { healed: number; starved: number };

/**
 * Advances hunger and health for `dt` seconds. Health only regenerates while fed and a few seconds
 * after the last hit; an empty stomach slowly hurts down to one heart.
 */
export function stepSurvival(
  player: Player,
  survival: Survival,
  difficulty: Difficulty,
  dt: number,
  moving: boolean,
): SurvivalTick {
  const result: SurvivalTick = { healed: 0, starved: 0 };
  if (player.health <= 0) return result;
  const peaceful = difficulty === 'peaceful';

  if (peaceful) {
    survival.hunger = MAX_HUNGER;
  } else {
    survival.hunger = Math.max(0, survival.hunger - (dt / HUNGER_SECONDS) * (moving ? 1.35 : 1));
  }

  if (survival.hunger <= 0) {
    survival.regenTimer = 0;
    survival.starveTimer += dt;
    if (survival.starveTimer >= STARVE_SECONDS) {
      survival.starveTimer -= STARVE_SECONDS;
      if (player.health > 1) {
        hurtPlayer(player, 1);
        result.starved = 1;
      }
    }
    return result;
  }
  survival.starveTimer = 0;

  if (player.health < MAX_HEALTH && survival.hunger >= REGEN_MIN_HUNGER && player.sinceHurt > 3) {
    survival.regenTimer += dt;
    if (survival.regenTimer >= REGEN_SECONDS) {
      survival.regenTimer -= REGEN_SECONDS;
      player.health = Math.min(MAX_HEALTH, player.health + 1);
      if (!peaceful) survival.hunger = Math.max(0, survival.hunger - REGEN_COST);
      result.healed = 1;
    }
  } else {
    survival.regenTimer = 0;
  }
  return result;
}

/** True when eating this item would do something. */
export function canEat(survival: Survival, item: number): boolean {
  return foodValue(item) > 0 && survival.hunger < MAX_HUNGER - 0.05;
}

/** Applies one food item. Returns the hunger restored (0 when it is not food or the bar is full). */
export function eatFood(survival: Survival, item: number): number {
  if (!canEat(survival, item)) return 0;
  const before = survival.hunger;
  survival.hunger = Math.min(MAX_HUNGER, survival.hunger + foodValue(item));
  return survival.hunger - before;
}
