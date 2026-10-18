/**
 * First-time tutorial as a small state machine. The game screen feeds it signals from play and
 * shows the hint for the current step with the matching control highlighted.
 */
export type TutorialStep =
  | 'walk'
  | 'jump'
  | 'dig'
  | 'select'
  | 'place'
  | 'inventory'
  | 'planks'
  | 'sticks'
  | 'pickaxe'
  | 'torch'
  | 'done';

export const TUTORIAL_STEPS: TutorialStep[] = [
  'walk',
  'jump',
  'dig',
  'select',
  'place',
  'inventory',
  'planks',
  'sticks',
  'pickaxe',
  'torch',
  'done',
];

/** What on screen the hint points at. */
export type TutorialTarget =
  | 'move'
  | 'jump'
  | 'world-dig'
  | 'hotbar'
  | 'world-place'
  | 'inventory-button'
  | 'recipe-planks'
  | 'recipe-sticks'
  | 'recipe-wood_pickaxe'
  | 'none';

export type TutorialInfo = { title: string; text: string; target: TutorialTarget };

export const TUTORIAL_INFO: Record<TutorialStep, TutorialInfo> = {
  walk: { title: 'Walk', text: 'Hold the arrow buttons to walk left and right.', target: 'move' },
  jump: { title: 'Jump', text: 'Tap the up arrow to jump. Walking into a single block climbs it.', target: 'jump' },
  dig: { title: 'Dig', text: 'Tap the glowing block to dig it. Stay close until it breaks.', target: 'world-dig' },
  select: { title: 'Pick a block', text: 'Tap a block in your hotbar to hold it.', target: 'hotbar' },
  place: { title: 'Build', text: 'Tap an empty spot next to a block to place it.', target: 'world-place' },
  inventory: { title: 'Your bag', text: 'Open the bag to see everything you carry and to craft.', target: 'inventory-button' },
  planks: {
    title: 'Craft planks',
    text: 'Chop a tree trunk for wood if you have none, then craft planks.',
    target: 'recipe-planks',
  },
  sticks: { title: 'Craft sticks', text: 'Sticks are made from planks.', target: 'recipe-sticks' },
  pickaxe: {
    title: 'Craft a pickaxe',
    text: 'Make a wooden pickaxe. It digs stone and ore.',
    target: 'recipe-wood_pickaxe',
  },
  torch: {
    title: 'Light it up',
    text: 'Here are 3 torches. Select one and place it on a wall or the ground. Light keeps monsters away.',
    target: 'hotbar',
  },
  done: { title: 'Ready', text: 'Follow the quest card at the top to find the crystals.', target: 'none' },
};

export type TutorialSignal =
  | { type: 'walked'; tiles: number }
  | { type: 'jumped' }
  | { type: 'mined' }
  | { type: 'selected' }
  | { type: 'placed'; block: number }
  | { type: 'inventory-opened' }
  | { type: 'crafted'; recipe: string };

const TORCH_BLOCK = 11;
/** Tiles of walking needed to finish the walk step. */
export const TUTORIAL_WALK_TILES = 3;

/** Next step after a signal. Signals that do not match the current step leave it unchanged. */
export function advanceTutorial(step: TutorialStep, signal: TutorialSignal): TutorialStep {
  const next = () => TUTORIAL_STEPS[Math.min(TUTORIAL_STEPS.length - 1, TUTORIAL_STEPS.indexOf(step) + 1)];
  switch (step) {
    case 'walk':
      return signal.type === 'walked' && signal.tiles >= TUTORIAL_WALK_TILES ? next() : step;
    case 'jump':
      return signal.type === 'jumped' ? next() : step;
    case 'dig':
      return signal.type === 'mined' ? next() : step;
    case 'select':
      return signal.type === 'selected' ? next() : step;
    case 'place':
      return signal.type === 'placed' ? next() : step;
    case 'inventory':
      return signal.type === 'inventory-opened' ? next() : step;
    case 'planks':
      return signal.type === 'crafted' && signal.recipe === 'planks' ? next() : step;
    case 'sticks':
      return signal.type === 'crafted' && signal.recipe === 'sticks' ? next() : step;
    case 'pickaxe':
      return signal.type === 'crafted' && signal.recipe === 'wood_pickaxe' ? next() : step;
    case 'torch':
      return signal.type === 'placed' && signal.block === TORCH_BLOCK ? next() : step;
    default:
      return step;
  }
}

export function isTutorialStep(value: unknown): value is TutorialStep {
  return typeof value === 'string' && (TUTORIAL_STEPS as string[]).includes(value);
}

/** Step number shown to the player, 1-based, out of the real steps (not counting 'done'). */
export function tutorialPosition(step: TutorialStep): { index: number; total: number } {
  return { index: TUTORIAL_STEPS.indexOf(step) + 1, total: TUTORIAL_STEPS.length - 1 };
}
