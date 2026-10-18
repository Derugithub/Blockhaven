import { isSolidAt, type World } from './world';

export const PLAYER_WIDTH = 0.7;
export const PLAYER_HEIGHT = 1.8;
export const MAX_HEALTH = 10;

const GRAVITY = 38;
const JUMP_SPEED = 12.6;
const WALK_SPEED = 5.2;
const MAX_FALL = 24;
const SAFE_FALL = 4;
const EPS = 0.001;

export type Player = {
  /** Left edge in tiles. */
  x: number;
  /** Top edge in tiles. */
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  health: number;
  /** Highest point (smallest y) reached since leaving the ground. */
  fallStartY: number;
  /** Seconds since the last damage, for regeneration. */
  sinceHurt: number;
  /** Walk cycle phase in radians. Advances with horizontal speed; a footstep lands every half turn. */
  walkPhase: number;
  /** Seconds left of the arm swing played when mining, placing or attacking. */
  swingTime: number;
  /** Seconds left of the red hurt flash. */
  hurtTime: number;
  /** Horizontal push from being hit, in tiles per second. Decays quickly. */
  knockback: number;
};

/** Length of one arm swing, in seconds. */
export const SWING_SECONDS = 0.28;
/** Length of the hurt flash, in seconds. */
export const HURT_FLASH_SECONDS = 0.35;
/** Radians of walk cycle per tile walked. Two footsteps per full turn, so a step every 1.1 tiles. */
const STRIDE = Math.PI / 1.1;

export type MoveInput = { left: boolean; right: boolean; jump: boolean };

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    health: MAX_HEALTH,
    fallStartY: y,
    sinceHurt: 0,
    walkPhase: 0,
    swingTime: 0,
    hurtTime: 0,
    knockback: 0,
  };
}

export function overlapsSolid(world: World, x: number, y: number, w = PLAYER_WIDTH, h = PLAYER_HEIGHT): boolean {
  const x0 = Math.floor(x + EPS);
  const x1 = Math.floor(x + w - EPS);
  const y0 = Math.floor(y + EPS);
  const y1 = Math.floor(y + h - EPS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolidAt(world, tx, ty)) return true;
    }
  }
  return false;
}

/** True when the tile overlaps the player's box. Used to stop placing blocks inside the player. */
export function playerOverlapsTile(player: Player, tx: number, ty: number): boolean {
  return (
    tx + 1 > player.x + EPS &&
    tx < player.x + PLAYER_WIDTH - EPS &&
    ty + 1 > player.y + EPS &&
    ty < player.y + PLAYER_HEIGHT - EPS
  );
}

export type StepResult = {
  /** Fall damage taken this step. */
  damage: number;
  /** A foot touched the ground this step (walk cycle crossed a half turn while grounded). */
  step: boolean;
  jumped: boolean;
  /** Downward speed when landing this step, 0 when the player did not land. */
  landed: number;
};

/** Marks the player as hurt: resets regeneration and starts the hurt flash. */
export function hurtPlayer(player: Player, damage: number): void {
  if (damage <= 0) return;
  player.health = Math.max(0, player.health - damage);
  player.sinceHurt = 0;
  player.hurtTime = HURT_FLASH_SECONDS;
}

/**
 * Advances the player by `dt` seconds. Movement is resolved one axis at a time against solid tiles.
 * Walking into a one-tile ledge steps up onto it, which keeps touch controls comfortable.
 */
export function stepPlayer(world: World, player: Player, input: MoveInput, dt: number): StepResult {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = dir * WALK_SPEED + player.knockback;
  player.knockback *= Math.exp(-9 * dt);
  if (Math.abs(player.knockback) < 0.05) player.knockback = 0;
  if (dir !== 0) player.facing = dir > 0 ? 1 : -1;
  player.swingTime = Math.max(0, player.swingTime - dt);
  player.hurtTime = Math.max(0, player.hurtTime - dt);

  let jumped = false;
  if (input.jump && player.onGround) {
    player.vy = -JUMP_SPEED;
    player.onGround = false;
    jumped = true;
  }
  const startX = player.x;

  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);

  // Horizontal.
  if (player.vx !== 0) {
    const nextX = player.x + player.vx * dt;
    if (!overlapsSolid(world, nextX, player.y)) {
      player.x = nextX;
    } else if (player.onGround && !overlapsSolid(world, nextX, player.y - 1.0) && !overlapsSolid(world, player.x, player.y - 1.0)) {
      // Step up a single block.
      player.y -= 1.0;
      player.x = nextX;
      player.y = settleDown(world, player.x, player.y);
    } else if (player.vx > 0) {
      player.x = Math.floor(nextX + PLAYER_WIDTH - EPS) - PLAYER_WIDTH;
    } else {
      player.x = Math.floor(nextX + EPS) + 1;
    }
  }

  // Vertical.
  const wasOnGround = player.onGround;
  const nextY = player.y + player.vy * dt;
  const fallSpeed = player.vy;
  let damage = 0;
  let landed = 0;
  if (!overlapsSolid(world, player.x, nextY)) {
    player.y = nextY;
    player.onGround = false;
  } else if (player.vy > 0) {
    player.y = Math.floor(nextY + PLAYER_HEIGHT - EPS) - PLAYER_HEIGHT;
    player.vy = 0;
    if (!wasOnGround) {
      const fell = player.y - player.fallStartY;
      if (fell > SAFE_FALL) damage = Math.floor(fell - SAFE_FALL + 0.5);
      landed = fallSpeed;
    }
    player.onGround = true;
  } else {
    player.y = Math.floor(nextY + EPS) + 1;
    player.vy = 0;
  }

  if (player.onGround) player.fallStartY = player.y;
  else player.fallStartY = Math.min(player.fallStartY, player.y);

  // Walk cycle follows the distance actually covered, so the legs never slide against a wall.
  let step = false;
  const moved = Math.abs(player.x - startX);
  if (player.onGround && dir !== 0 && moved > 0) {
    const before = Math.floor(player.walkPhase / Math.PI);
    player.walkPhase += moved * STRIDE;
    step = Math.floor(player.walkPhase / Math.PI) !== before;
  } else if (player.onGround) {
    // Ease the legs back together when standing still.
    const rest = Math.round(player.walkPhase / Math.PI) * Math.PI;
    player.walkPhase += (rest - player.walkPhase) * Math.min(1, dt * 12);
  }

  if (damage > 0) hurtPlayer(player, damage);
  else player.sinceHurt += dt;
  return { damage, step, jumped, landed };
}

/** After stepping up, drops the box back until it rests on the ground. */
function settleDown(world: World, x: number, y: number): number {
  let ny = y;
  for (let i = 0; i < 20; i++) {
    if (overlapsSolid(world, x, ny + 0.05)) break;
    ny += 0.05;
  }
  return ny;
}

export function playerCenter(player: Player): { x: number; y: number } {
  return { x: player.x + PLAYER_WIDTH / 2, y: player.y + PLAYER_HEIGHT / 2 };
}
