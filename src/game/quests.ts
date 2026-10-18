import { Block, blockInfo, Item } from './blocks';
import { BEACON_CRYSTALS } from './crafting';
import { PLAYER_HEIGHT, PLAYER_WIDTH, type Player } from './player';
import type { Difficulty } from './survival';
import { getFg, type World } from './world';

/** Running totals the quests are measured against. Saved with the world. */
export type Stats = {
  /** Items picked up from mining, by item id. */
  collected: Record<number, number>;
  /** Blocks broken, by block id. */
  mined: Record<number, number>;
  /** Times each recipe was crafted, by recipe id. */
  crafted: Record<string, number>;
  /** Blocks placed, by block id. */
  placed: Record<number, number>;
  /** Deepest point reached, in metres below the spawn ground. */
  maxDepth: number;
  nightsSurvived: number;
  monstersDefeated: number;
  foodEaten: number;
  /** True once the current night has started without the player dying. */
  sawNight: boolean;
};

export function createStats(): Stats {
  return {
    collected: {},
    mined: {},
    crafted: {},
    placed: {},
    maxDepth: 0,
    nightsSurvived: 0,
    monstersDefeated: 0,
    foodEaten: 0,
    sawNight: false,
  };
}

export function bump(record: Record<string | number, number>, key: string | number, by = 1): void {
  record[key] = (record[key] ?? 0) + by;
}

export type Reward = { item: number; count: number };

export type QuestContext = { stats: Stats; world: World; player: Player; difficulty: Difficulty };

export type Quest = {
  id: string;
  title: string;
  hint: string;
  target: number;
  progress: (ctx: QuestContext) => number;
  rewards: Reward[];
  /** Hidden in peaceful worlds, where it cannot be done. */
  needsMonsters?: boolean;
};

/** Metres from the spawn ground, the depth quest target. */
export const DEPTH_GOAL = 40;
/** Blocks you must have placed before a shelter counts. */
export const SHELTER_BLOCKS = 8;

/** Parts of a shelter around the player: enough placed blocks, a roof, a left wall and a right wall. */
export function shelterParts(world: World, player: Player, placedTotal: number): number {
  let parts = placedTotal >= SHELTER_BLOCKS ? 1 : 0;
  const head = Math.floor(player.y + 0.01);
  const feet = Math.floor(player.y + PLAYER_HEIGHT - 0.01);
  const left = Math.floor(player.x + 0.01);
  const right = Math.floor(player.x + PLAYER_WIDTH - 0.01);
  const solid = (x: number, y: number) => blockInfo(getFg(world, x, y)).solid;

  let roof = true;
  for (let x = left; x <= right; x++) {
    let found = false;
    for (let y = head - 1; y >= head - 4; y--) {
      if (solid(x, y)) {
        found = true;
        break;
      }
    }
    roof = roof && found;
  }
  if (roof) parts++;

  const wall = (dir: -1 | 1) => {
    const start = dir < 0 ? left : right;
    for (let y = head; y <= feet; y++) {
      let found = false;
      for (let i = 1; i <= 4; i++) {
        if (solid(start + dir * i, y)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  };
  if (wall(-1)) parts++;
  if (wall(1)) parts++;
  return parts;
}

function placedBlocks(stats: Stats): number {
  let total = 0;
  for (const [id, count] of Object.entries(stats.placed)) if (Number(id) !== Block.Torch) total += count;
  return total;
}

const n = (record: Record<string | number, number>, key: string | number) => record[key] ?? 0;

/** The quest line, in the order it is suggested. Quests can be finished in any order. */
export const QUESTS: Quest[] = [
  {
    id: 'wood',
    title: 'Collect 10 wood',
    hint: 'Tap a tree trunk to chop it. Trees grow on the grass.',
    target: 10,
    progress: ({ stats }) => n(stats.collected, Item.Wood),
    rewards: [{ item: Item.Apple, count: 2 }],
  },
  {
    id: 'wooden_pickaxe',
    title: 'Craft a wooden pickaxe',
    hint: 'Open the bag: wood → planks → sticks → wooden pickaxe.',
    target: 1,
    progress: ({ stats }) => n(stats.crafted, 'wood_pickaxe'),
    rewards: [{ item: Item.Torch, count: 4 }],
  },
  {
    id: 'stone',
    title: 'Mine 20 stone',
    hint: 'Dig down through the dirt to reach grey stone.',
    target: 20,
    progress: ({ stats }) => n(stats.mined, Block.Stone),
    rewards: [{ item: Item.Apple, count: 3 }],
  },
  {
    id: 'coal',
    title: 'Find coal',
    hint: 'Coal ore is stone with black spots. Mine it with any pickaxe.',
    target: 1,
    progress: ({ stats }) => n(stats.collected, Item.Coal),
    rewards: [{ item: Item.Torch, count: 4 }],
  },
  {
    id: 'torches',
    title: 'Place 5 torches',
    hint: 'Craft torches from coal and sticks. Light keeps monsters away.',
    target: 5,
    progress: ({ stats }) => n(stats.placed, Block.Torch),
    rewards: [{ item: Item.Planks, count: 16 }],
  },
  {
    id: 'shelter',
    title: 'Build a shelter',
    hint: `Place ${SHELTER_BLOCKS} blocks, then stand under a roof with walls on both sides.`,
    target: 4,
    progress: ({ stats, world, player }) => shelterParts(world, player, placedBlocks(stats)),
    rewards: [
      { item: Item.BerryPie, count: 1 },
      { item: Item.Torch, count: 6 },
    ],
  },
  {
    id: 'night',
    title: 'Survive a night',
    hint: 'Stay alive from dusk until the sun comes up.',
    target: 1,
    progress: ({ stats }) => stats.nightsSurvived,
    rewards: [{ item: Item.BerryPie, count: 2 }],
  },
  {
    id: 'iron',
    title: 'Find iron',
    hint: 'Iron ore has orange spots and sits deeper down. Needs a stone pickaxe.',
    target: 1,
    progress: ({ stats }) => n(stats.collected, Item.RawIron),
    rewards: [{ item: Item.RawIron, count: 2 }],
  },
  {
    id: 'iron_pickaxe',
    title: 'Craft an iron pickaxe',
    hint: 'Three raw iron and two sticks. Only iron can mine crystals.',
    target: 1,
    progress: ({ stats }) => n(stats.crafted, 'iron_pickaxe'),
    rewards: [{ item: Item.Torch, count: 12 }],
  },
  {
    id: 'depth',
    title: `Reach ${DEPTH_GOAL} m deep`,
    hint: 'Keep digging. The depth meter shows how far down you are.',
    target: DEPTH_GOAL,
    progress: ({ stats }) => stats.maxDepth,
    rewards: [{ item: Item.Apple, count: 3 }],
  },
  {
    id: 'monster',
    title: 'Defeat a monster',
    hint: 'Monsters come out at night. Tap one to hit it; swords hit harder.',
    target: 1,
    progress: ({ stats }) => stats.monstersDefeated,
    rewards: [{ item: Item.BerryPie, count: 2 }],
    needsMonsters: true,
  },
  {
    id: 'crystal',
    title: 'Find a crystal',
    hint: 'Glowing crystals hide in the deepest layer, just above bedrock.',
    target: 1,
    progress: ({ stats }) => n(stats.collected, Item.Crystal),
    rewards: [
      { item: Item.Apple, count: 3 },
      { item: Item.Torch, count: 8 },
    ],
  },
  {
    id: 'beacon',
    title: 'Build the Haven Beacon',
    hint: `Collect ${BEACON_CRYSTALS} crystals and craft the beacon with 5 stone.`,
    target: 1,
    progress: ({ stats }) => n(stats.crafted, 'beacon'),
    rewards: [{ item: Item.BerryPie, count: 3 }],
  },
];

export function questsFor(difficulty: Difficulty): Quest[] {
  return difficulty === 'peaceful' ? QUESTS.filter((q) => !q.needsMonsters) : QUESTS;
}

export function findQuest(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}

/** Progress clamped to the target, for display. */
export function questProgress(quest: Quest, ctx: QuestContext): number {
  return Math.max(0, Math.min(quest.target, Math.floor(quest.progress(ctx))));
}

/** The first unfinished quest in the suggested order, or null when all are done. */
export function currentQuest(completed: readonly string[], difficulty: Difficulty): Quest | null {
  return questsFor(difficulty).find((q) => !completed.includes(q.id)) ?? null;
}

/** Quests that are finished now but not yet marked complete. Does not change anything. */
export function newlyCompleted(completed: readonly string[], ctx: QuestContext): Quest[] {
  return questsFor(ctx.difficulty).filter((q) => !completed.includes(q.id) && q.progress(ctx) >= q.target);
}

export function rewardLabel(rewards: Reward[], name: (item: number) => string): string {
  return rewards.map((r) => `${r.count} ${name(r.item).toLowerCase()}`).join(', ');
}
