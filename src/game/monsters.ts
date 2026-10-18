import { Block, blockInfo } from './blocks';
import { overlapsSolid, PLAYER_HEIGHT, PLAYER_WIDTH, type Player } from './player';
import { getFg, type World } from './world';

export const MONSTER_WIDTH = 0.8;
export const MONSTER_HEIGHT = 1.7;
export const MONSTER_HEALTH = 8;
/** Most monsters alive at once. */
export const MONSTER_CAP = 6;
/** Seconds between spawn attempts at night. */
export const SPAWN_INTERVAL = 3;
/** Monsters only appear this far from the player, measured in tiles along x. */
export const SPAWN_MIN_DISTANCE = 14;
export const SPAWN_MAX_DISTANCE = 28;
/** Monsters further than this are removed. */
export const DESPAWN_DISTANCE = 48;
export const CONTACT_DAMAGE = 2;
/** Seconds between two contact hits from the same monster. */
export const CONTACT_COOLDOWN = 1;
/** Seconds a monster takes to burn away once the sun is up. */
export const BURN_SECONDS = 1.6;

const GRAVITY = 38;
const WALK_SPEED = 2.6;
const JUMP_SPEED = 11.5;
const MAX_FALL = 24;
const EPS = 0.001;

export type Monster = {
  id: number;
  /** Left edge in tiles. */
  x: number;
  /** Top edge in tiles. */
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  health: number;
  /** Seconds until this monster can hurt the player again. */
  hitCooldown: number;
  /** Seconds left of the flash after being hit. */
  hurtTime: number;
  /** Knockback from the player's hits, in tiles per second. */
  knockback: number;
  /** Seconds spent burning in daylight; the monster is gone at BURN_SECONDS. */
  burn: number;
  walkPhase: number;
  /** Seconds until the next growl. */
  growlIn: number;
};

export function createMonster(id: number, x: number, y: number, growlIn = 4): Monster {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    health: MONSTER_HEALTH,
    hitCooldown: 0,
    hurtTime: 0,
    knockback: 0,
    burn: 0,
    walkPhase: 0,
    growlIn,
  };
}

/** True when a lit block (torch, beacon) shines on the tile. */
export function isLitByBlocks(world: World, tx: number, ty: number): boolean {
  const radius = 11;
  for (let y = ty - radius; y <= ty + radius; y++) {
    for (let x = tx - radius; x <= tx + radius; x++) {
      const light = blockInfo(getFg(world, x, y)).light;
      if (light <= 0) continue;
      const dx = x - tx;
      const dy = y - ty;
      // Matches the visible glow: a torch (7) keeps monsters away for about 8 tiles.
      const reach = light + 1;
      if (dx * dx + dy * dy <= reach * reach) return true;
    }
  }
  return false;
}

const SPAWN_GROUND = new Set<number>([Block.Grass, Block.Dirt, Block.Sand, Block.Stone]);

/**
 * Where a monster could stand in column `tx`: on the natural ground under open sky, in darkness and
 * with room for its body. Returns the top-left of the monster, or null when the column is not allowed.
 */
export function spawnSpotAt(world: World, player: Player, tx: number): { x: number; y: number } | null {
  if (tx < 1 || tx >= world.width - 1) return null;
  const playerX = player.x + PLAYER_WIDTH / 2;
  const distance = Math.abs(tx + 0.5 - playerX);
  if (distance < SPAWN_MIN_DISTANCE || distance > SPAWN_MAX_DISTANCE) return null;
  const ground = world.skyTop[tx];
  if (ground <= 2 || ground >= world.height) return null;
  if (!SPAWN_GROUND.has(getFg(world, tx, ground))) return null;
  const x = tx + (1 - MONSTER_WIDTH) / 2;
  const y = ground - MONSTER_HEIGHT;
  if (overlapsSolid(world, x, y, MONSTER_WIDTH, MONSTER_HEIGHT)) return null;
  if (isLitByBlocks(world, tx, ground - 1)) return null;
  return { x, y };
}

export type SpawnOptions = { night: boolean; peaceful: boolean };

/**
 * One spawn attempt. `roll` gives random numbers in [0, 1). Picks a side and a distance, then tries a
 * few columns around it so a single torch-lit spot does not stop spawning for the whole night.
 */
export function trySpawn(
  world: World,
  player: Player,
  monsters: Monster[],
  options: SpawnOptions,
  nextId: number,
  roll: () => number,
): Monster | null {
  if (!options.night || options.peaceful || monsters.length >= MONSTER_CAP) return null;
  const side = roll() < 0.5 ? -1 : 1;
  const distance = SPAWN_MIN_DISTANCE + roll() * (SPAWN_MAX_DISTANCE - SPAWN_MIN_DISTANCE);
  const center = Math.floor(player.x + PLAYER_WIDTH / 2 + side * distance);
  for (let i = 0; i < 4; i++) {
    const tx = center + side * i * 2;
    const spot = spawnSpotAt(world, player, tx);
    if (spot) return createMonster(nextId, spot.x, spot.y, 2 + roll() * 6);
  }
  return null;
}

export function overlapsPlayer(monster: Monster, player: Player): boolean {
  return (
    monster.x < player.x + PLAYER_WIDTH &&
    monster.x + MONSTER_WIDTH > player.x &&
    monster.y < player.y + PLAYER_HEIGHT &&
    monster.y + MONSTER_HEIGHT > player.y
  );
}

/** True when a point in tile coordinates touches the monster, with a little slack for fingers. */
export function monsterContains(monster: Monster, wx: number, wy: number, slack = 0.35): boolean {
  return (
    wx >= monster.x - slack &&
    wx <= monster.x + MONSTER_WIDTH + slack &&
    wy >= monster.y - slack &&
    wy <= monster.y + MONSTER_HEIGHT + slack
  );
}

export type MonsterStep = {
  /** Damage dealt to the player by contact this step. */
  contact: number;
  /** Direction the player should be pushed. */
  push: number;
  burned: boolean;
  despawned: boolean;
  growl: boolean;
};

/** Moves one monster toward the player and resolves contact. `day` makes it burn. */
export function stepMonster(world: World, monster: Monster, player: Player, dt: number, day: boolean): MonsterStep {
  const out: MonsterStep = { contact: 0, push: 0, burned: false, despawned: false, growl: false };
  const px = player.x + PLAYER_WIDTH / 2;
  const mx = monster.x + MONSTER_WIDTH / 2;
  if (Math.abs(px - mx) > DESPAWN_DISTANCE) {
    out.despawned = true;
    return out;
  }
  monster.hitCooldown = Math.max(0, monster.hitCooldown - dt);
  monster.hurtTime = Math.max(0, monster.hurtTime - dt);

  if (day) {
    monster.burn += dt;
    if (monster.burn >= BURN_SECONDS) {
      out.burned = true;
      return out;
    }
  }

  const dir = Math.abs(px - mx) < 0.3 ? 0 : px > mx ? 1 : -1;
  if (dir !== 0) monster.facing = dir;
  // Burning monsters panic and slow down; the knockback from hits briefly overrides walking.
  const speed = day ? WALK_SPEED * 0.4 : WALK_SPEED;
  monster.vx = dir * speed + monster.knockback;
  monster.knockback *= Math.exp(-8 * dt);
  if (Math.abs(monster.knockback) < 0.05) monster.knockback = 0;

  monster.vy = Math.min(MAX_FALL, monster.vy + GRAVITY * dt);

  const startX = monster.x;
  if (monster.vx !== 0) {
    const nextX = monster.x + monster.vx * dt;
    if (!overlapsSolid(world, nextX, monster.y, MONSTER_WIDTH, MONSTER_HEIGHT)) {
      monster.x = nextX;
    } else {
      if (monster.vx > 0) monster.x = Math.floor(nextX + MONSTER_WIDTH - EPS) - MONSTER_WIDTH;
      else monster.x = Math.floor(nextX + EPS) + 1;
      // Blocked: hop if there is room for a one block climb.
      if (monster.onGround && !overlapsSolid(world, nextX, monster.y - 1.05, MONSTER_WIDTH, MONSTER_HEIGHT)) {
        monster.vy = -JUMP_SPEED;
        monster.onGround = false;
      }
    }
  }

  const nextY = monster.y + monster.vy * dt;
  if (!overlapsSolid(world, monster.x, nextY, MONSTER_WIDTH, MONSTER_HEIGHT)) {
    monster.y = nextY;
    monster.onGround = false;
  } else if (monster.vy > 0) {
    monster.y = Math.floor(nextY + MONSTER_HEIGHT - EPS) - MONSTER_HEIGHT;
    monster.vy = 0;
    monster.onGround = true;
  } else {
    monster.y = Math.floor(nextY + EPS) + 1;
    monster.vy = 0;
  }
  if (monster.y > world.height + 4) {
    out.despawned = true;
    return out;
  }

  monster.walkPhase += Math.abs(monster.x - startX) * (Math.PI / 0.7);

  if (overlapsPlayer(monster, player) && monster.hitCooldown <= 0 && !day) {
    monster.hitCooldown = CONTACT_COOLDOWN;
    out.contact = CONTACT_DAMAGE;
    out.push = px >= mx ? 1 : -1;
  }

  monster.growlIn -= dt;
  if (monster.growlIn <= 0) {
    monster.growlIn = 5 + ((monster.id * 7919) % 5);
    out.growl = Math.abs(px - mx) < 16;
  }
  return out;
}

/** Applies a player hit. Returns true when the monster is defeated. */
export function hitMonster(monster: Monster, damage: number, fromX: number): boolean {
  monster.health -= damage;
  monster.hurtTime = 0.25;
  const away = monster.x + MONSTER_WIDTH / 2 >= fromX ? 1 : -1;
  monster.knockback = away * 7;
  if (monster.onGround) {
    monster.vy = -5;
    monster.onGround = false;
  }
  return monster.health <= 0;
}
