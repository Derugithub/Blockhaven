import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ambientMix, footstepSound, soundsForEvent } from '@/audio/event-sounds';
import { sounds } from '@/audio/sound-manager';
import { AppText, IconButton } from '@/components/ui';
import { canMine } from '@/game/actions';
import { Block, blockInfo, foodValue, isPlaceable, Item, itemName } from '@/game/blocks';
import type { Recipe } from '@/game/crafting';
import { clockLabel, DAY_SECONDS, daylight, isNight } from '@/game/daycycle';
import {
  craftInGame,
  depthOf,
  eatSelected,
  groundRow,
  respawn,
  revive,
  stepGame,
  tapWorld,
  type GameEvent,
  type GameState,
} from '@/game/game';
import { addItem, bestPickaxeTier, countItem, HOTBAR_SIZE, selectedStack, selectSlot, type Slot } from '@/game/inventory';
import { PLAYER_HEIGHT, PLAYER_WIDTH, playerOverlapsTile, type MoveInput } from '@/game/player';
import { currentQuest, questProgress, questsFor, rewardLabel } from '@/game/quests';
import { crystalLayer } from '@/game/terrain';
import { advanceTutorial, TUTORIAL_INFO, tutorialPosition, type TutorialSignal, type TutorialStep } from '@/game/tutorial';
import { getFg } from '@/game/world';
import { bonusReadyIn } from '@/lib/ads/ad-policy';
import { useAds } from '@/lib/ads/ads-context';
import { CONTROL_SIZES, useSettings } from '@/lib/settings';
import { saveWorld } from '@/lib/worlds';
import { WorldRenderer, type View as Camera } from '@/render/renderer';

import { HoldButton, WorldTouchLayer } from './controls';
import { DeathDialog, PauseMenu } from './dialogs';
import { Clock, DepthMeter, EatButton, Hearts, Highlightable, Hotbar, HungerBar, QuestCard } from './hud';
import { InventoryPanel } from './inventory-panel';
import { QuestPanel, TutorialCard, WinOverlay, type QuestRow } from './panels';

const AUTOSAVE_MS = 30_000;
const TOAST_MS = 2200;
/** Seconds between checks for a nearby torch to crackle. */
const CRACKLE_CHECK_SECONDS = 1.6;

type Overlay = 'none' | 'pause' | 'inventory' | 'quests' | 'win' | 'dead';

type Hud = {
  health: number;
  hunger: number;
  peaceful: boolean;
  hotbar: Slot[];
  selected: number;
  clock: string;
  night: boolean;
  depth: number;
  quest: { title: string; progress: number; target: number } | null;
  foodSelected: boolean;
  crystals: number;
};

function hudOf(game: GameState): Hud {
  const quest = currentQuest(game.quests, game.difficulty);
  const ctx = { stats: game.stats, world: game.world, player: game.player, difficulty: game.difficulty };
  const selected = selectedStack(game.inventory);
  return {
    health: game.player.health,
    hunger: game.survival.hunger,
    peaceful: game.difficulty === 'peaceful',
    hotbar: game.inventory.slots.slice(0, HOTBAR_SIZE).map((s) => (s ? { ...s } : null)),
    selected: game.inventory.selected,
    clock: clockLabel(game.time),
    night: isNight(game.time),
    depth: depthOf(game),
    quest: quest ? { title: quest.title, progress: questProgress(quest, ctx), target: quest.target } : null,
    foodSelected: !!selected && foodValue(selected.item) > 0,
    crystals: countItem(game.inventory, Item.Crystal),
  };
}

/** Cheap fingerprint of everything the HUD shows, checked every frame. */
function hudKey(game: GameState): string {
  const quest = currentQuest(game.quests, game.difficulty);
  const progress = quest
    ? questProgress(quest, { stats: game.stats, world: game.world, player: game.player, difficulty: game.difficulty })
    : -1;
  return `${game.hudVersion}|${clockLabel(game.time)}|${depthOf(game)}|${progress}`;
}

function questRows(game: GameState): QuestRow[] {
  const ctx = { stats: game.stats, world: game.world, player: game.player, difficulty: game.difficulty };
  return questsFor(game.difficulty).map((quest) => ({
    quest,
    progress: questProgress(quest, ctx),
    done: game.quests.includes(quest.id),
  }));
}

export function tileSizeFor(width: number, height: number): number {
  return Math.max(22, Math.min(56, Math.round(Math.min(width, height) / 13)));
}

function emptyPicture(): SkPicture {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return recorder.finishRecordingAsPicture();
}

/** A tile the tutorial can point at for digging: something soft and mineable close by. */
function digTarget(game: GameState): { x: number; y: number } | null {
  const p = game.player;
  const cx = Math.floor(p.x + PLAYER_WIDTH / 2);
  const feet = Math.floor(p.y + PLAYER_HEIGHT - 0.01);
  const tier = bestPickaxeTier(game.inventory);
  const candidates = [
    [cx + p.facing, feet + 1],
    [cx, feet + 1],
    [cx - p.facing, feet + 1],
    [cx + p.facing, feet],
    [cx + p.facing * 2, feet + 1],
  ];
  for (const [x, y] of candidates) {
    const id = getFg(game.world, x, y);
    if (id !== Block.Air && id !== Block.Bedrock && canMine(id, tier)) return { x, y };
  }
  return null;
}

/** An empty tile next to the ground in front of the player, for the placing step. */
function placeTarget(game: GameState): { x: number; y: number } | null {
  const p = game.player;
  const cx = Math.floor(p.x + PLAYER_WIDTH / 2);
  const feet = Math.floor(p.y + PLAYER_HEIGHT - 0.01);
  for (const dx of [2, 1, -1, -2, 3]) {
    const x = cx + p.facing * dx;
    for (const y of [feet, feet - 1, feet + 1]) {
      if (getFg(game.world, x, y) !== Block.Air || playerOverlapsTile(p, x, y)) continue;
      if (blockInfo(getFg(game.world, x, y + 1)).solid) return { x, y };
    }
  }
  return null;
}

/** Distance to the closest torch or beacon within a few tiles, or Infinity. */
function nearestFire(game: GameState): number {
  const p = game.player;
  const cx = Math.floor(p.x + PLAYER_WIDTH / 2);
  const cy = Math.floor(p.y + 1);
  let best = Infinity;
  for (let y = cy - 4; y <= cy + 4; y++) {
    for (let x = cx - 5; x <= cx + 5; x++) {
      if (getFg(game.world, x, y) !== Block.Torch) continue;
      best = Math.min(best, Math.hypot(x - cx, y - cy));
    }
  }
  return best;
}

/** What the optional rewarded ad gives, once every 10 minutes: building supplies, light and food. */
const BONUS_ITEMS = [
  { item: Item.Torch, count: 8 },
  { item: Item.Planks, count: 16 },
  { item: Item.Stick, count: 8 },
  { item: Item.Apple, count: 3 },
  { item: Item.BerryPie, count: 1 },
];

/** Module-level so the bonus cooldown survives leaving and re-entering a world in one session. */
let bonusClaimedAt: number | null = null;

export function GameScreen({
  worldId,
  worldName,
  seedText,
  initial,
}: {
  worldId: string;
  worldName: string;
  seedText: string;
  initial: GameState;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ads = useAds();
  const { settings, loaded: settingsLoaded, update } = useSettings();

  const gameRef = useRef(initial);
  const input = useRef<MoveInput>({ left: false, right: false, jump: false });
  const camera = useRef<Camera | null>(null);
  const renderer = useRef<WorldRenderer | null>(null);
  const overlayRef = useRef<Overlay>('none');
  const savingRef = useRef(false);
  const playedMs = useRef(0);
  const lastTouchTile = useRef<string | null>(null);
  const tutorialRef = useRef<TutorialStep | null>(null);
  const tutorialTile = useRef<{ x: number; y: number } | null>(null);
  const stepVariant = useRef<0 | 1>(0);
  const [firstPicture] = useState(emptyPicture);
  const picture = useSharedValue<SkPicture>(firstPicture);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [hud, setHud] = useState<Hud>(() => hudOf(initial));
  const [overlay, setOverlayState] = useState<Overlay>('none');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // The tutorial step lives in settings, so it resumes where it was left, even in another world.
  const tutorial: TutorialStep | null = settingsLoaded && !settings.tutorialDone ? settings.tutorialStep : null;

  const setOverlay = useCallback((next: Overlay) => {
    overlayRef.current = next;
    if (next !== 'none') {
      input.current.left = false;
      input.current.right = false;
      input.current.jump = false;
    }
    setOverlayState(next);
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // Sounds: load once for this screen, follow the settings, stay quiet while a menu is open.
  useEffect(() => {
    sounds.acquire();
    return () => sounds.release();
  }, []);
  useEffect(() => {
    sounds.configure({ soundEffects: settings.soundEffects, music: settings.music, volume: settings.volume });
  }, [settings.soundEffects, settings.music, settings.volume]);
  useEffect(() => {
    sounds.setPaused(overlay !== 'none' && overlay !== 'inventory' && overlay !== 'quests');
  }, [overlay]);

  // The game loop reads the step through a ref.
  useEffect(() => {
    tutorialRef.current = tutorial;
    if (!tutorial) tutorialTile.current = null;
  }, [tutorial]);

  const enterTutorialStep = useCallback(
    (step: TutorialStep) => {
      tutorialRef.current = step;
      update({ tutorialStep: step });
      const game = gameRef.current;
      if (step === 'torch' && countItem(game.inventory, Item.Torch) === 0) {
        addItem(game.inventory, Item.Torch, 3);
        game.hudVersion++;
      }
    },
    [update],
  );

  const tutorialSignal = useCallback(
    (signal: TutorialSignal) => {
      const step = tutorialRef.current;
      if (!step || step === 'done') return;
      const next = advanceTutorial(step, signal);
      if (next !== step) enterTutorialStep(next);
    },
    [enterTutorialStep],
  );

  const finishTutorial = useCallback(() => {
    tutorialRef.current = null;
    tutorialTile.current = null;
    update({ tutorialDone: true, tutorialStep: 'done' });
  }, [update]);

  // A resumed tutorial at the torch step still needs torches to place.
  useEffect(() => {
    if (tutorial === 'torch') {
      const game = gameRef.current;
      if (countItem(game.inventory, Item.Torch) === 0) {
        addItem(game.inventory, Item.Torch, 3);
        game.hudVersion++;
      }
    }
  }, [tutorial]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveWorld(worldId, gameRef.current);
    } catch {
      showToast('Could not save the world');
    } finally {
      savingRef.current = false;
    }
  }, [worldId, showToast]);

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      for (const event of events) {
        for (const cue of soundsForEvent(event)) sounds.play(cue.name, cue.volume, cue.rate);
        switch (event.type) {
          case 'step':
            sounds.step(footstepSound(event.block, stepVariant.current), Date.now());
            stepVariant.current = stepVariant.current === 0 ? 1 : 0;
            break;
          case 'jump':
            tutorialSignal({ type: 'jumped' });
            break;
          case 'needs-tool': {
            const tier = bestPickaxeTier(gameRef.current.inventory);
            const required = blockInfo(event.block).tier;
            showToast(
              tier === 0
                ? 'Craft a wooden pickaxe to mine this'
                : required >= 3
                  ? 'Crystals need an iron pickaxe'
                  : 'You need a stronger pickaxe',
            );
            break;
          }
          case 'mined':
            if (event.lost > 0) showToast('Inventory is full');
            else if (event.item === Item.Crystal) {
              const have = countItem(gameRef.current.inventory, Item.Crystal);
              showToast(have >= 10 ? 'Crystal! You have enough for the Haven Beacon' : `Crystal! ${have}/10`);
            }
            tutorialSignal({ type: 'mined' });
            break;
          case 'placed':
            tutorialSignal({ type: 'placed', block: event.block });
            break;
          case 'crafted':
            tutorialSignal({ type: 'crafted', recipe: event.recipe });
            break;
          case 'unsupported':
            showToast('Place it next to another block');
            break;
          case 'blocked':
            showToast('Something is in the way');
            break;
          case 'out-of-reach':
            if (settings.showHints) showToast('Out of reach');
            break;
          case 'quest':
            showToast(
              `Quest complete: ${event.quest.title}${event.lost > 0 ? ' (bag full, some reward lost)' : ` · +${rewardLabel(event.quest.rewards, itemName)}`}`,
            );
            break;
          case 'ate':
            showToast(`Ate ${itemName(event.item).toLowerCase()}`);
            break;
          case 'won':
            setTimeout(() => setOverlay('win'), 250);
            break;
          case 'died':
            setOverlay('dead');
            void save();
            break;
          default:
            break;
        }
      }
    },
    [save, setOverlay, settings.showHints, showToast, tutorialSignal],
  );

  // Game loop: physics and drawing run here, outside React renders. The HUD state only changes
  // when something it shows actually changes.
  useEffect(() => {
    if (!size) return;
    if (!renderer.current) renderer.current = new WorldRenderer();
    const tilePx = tileSizeFor(size.width, size.height);
    let raf = 0;
    let last = 0;
    let lastHud = '';
    let lastDrawnPaused = false;
    let ambientIn = 0;
    let crackleIn = CRACKLE_CHECK_SECONDS;
    let targetIn = 0;
    let walked = 0;

    const frame = (timestamp: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (timestamp - last) / 1000);
      last = timestamp;
      const game = gameRef.current;
      const running = overlayRef.current === 'none';

      if (running) {
        playedMs.current += dt * 1000;
        const x0 = game.player.x;
        handleEvents(stepGame(game, input.current, dt));
        const step = tutorialRef.current;
        if (step === 'walk') {
          walked += Math.abs(game.player.x - x0);
          if (walked >= 3) {
            tutorialSignal({ type: 'walked', tiles: walked });
            walked = 0;
          }
        }

        ambientIn -= dt;
        if (ambientIn <= 0) {
          ambientIn = 0.5;
          const mix = ambientMix(daylight(game.time), depthOf(game));
          sounds.setAmbient(mix.day, mix.night);
        }
        crackleIn -= dt;
        if (crackleIn <= 0) {
          crackleIn = CRACKLE_CHECK_SECONDS * (0.8 + Math.random() * 0.5);
          const d = nearestFire(game);
          if (d < 5) sounds.play('crackle', (1 - d / 5) * 0.55 + 0.1);
        }
        targetIn -= dt;
        if (targetIn <= 0) {
          targetIn = 0.25;
          tutorialTile.current = step === 'dig' ? digTarget(game) : step === 'place' ? placeTarget(game) : null;
        }
      }

      const viewW = size.width / tilePx;
      const viewH = size.height / tilePx;
      const targetX = clamp(game.player.x + 0.35 - viewW / 2, 0, Math.max(0, game.world.width - viewW));
      const targetY = clamp(game.player.y + 0.9 - viewH * 0.55, 0, Math.max(0, game.world.height - viewH));
      const cam = camera.current;
      if (!cam || cam.tilePx !== tilePx || cam.width !== size.width) {
        camera.current = { width: size.width, height: size.height, tilePx, camX: targetX, camY: targetY };
      } else {
        const k = Math.min(1, dt * 9);
        cam.camX += (targetX - cam.camX) * k;
        cam.camY += (targetY - cam.camY) * k;
      }

      if (running || !lastDrawnPaused) {
        picture.set(renderer.current!.draw(game, camera.current!, { highlight: tutorialTile.current }));
        lastDrawnPaused = !running;
      }
      if (running) lastDrawnPaused = false;

      const key = hudKey(game);
      if (key !== lastHud) {
        lastHud = key;
        setHud(hudOf(game));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, handleEvents, picture, tutorialSignal]);

  // Autosave on a timer, when the app goes to the background, and when the screen closes.
  useEffect(() => {
    const timer = setInterval(() => void save(), AUTOSAVE_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void save();
        if (overlayRef.current === 'none') setOverlay('pause');
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      void save();
    };
  }, [save, setOverlay]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = overlayRef.current;
      if (current === 'inventory' || current === 'quests' || current === 'win') setOverlay('none');
      else if (current === 'none') setOverlay('pause');
      else if (current === 'pause') setOverlay('none');
      return true;
    });
    return () => sub.remove();
  }, [setOverlay]);

  useEffect(() => {
    if (overlay !== 'pause') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [overlay]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const touchWorld = useCallback(
    (x: number, y: number, moving: boolean) => {
      const cam = camera.current;
      if (!cam || overlayRef.current !== 'none') return;
      const wx = cam.camX + x / cam.tilePx;
      const wy = cam.camY + y / cam.tilePx;
      const key = `${Math.floor(wx)},${Math.floor(wy)}`;
      if (moving && key === lastTouchTile.current) return;
      lastTouchTile.current = key;
      // Dragging only mines or hits, so a slide across the screen does not scatter blocks.
      handleEvents(tapWorld(gameRef.current, wx, wy, !moving));
    },
    [handleEvents],
  );

  const touchEnd = useCallback(() => {
    lastTouchTile.current = null;
  }, []);

  const setLeft = useCallback((v: boolean) => {
    input.current.left = v;
  }, []);
  const setRight = useCallback((v: boolean) => {
    input.current.right = v;
  }, []);
  const setJump = useCallback((v: boolean) => {
    input.current.jump = v;
  }, []);

  const selectHotbar = useCallback(
    (index: number) => {
      const game = gameRef.current;
      selectSlot(game.inventory, index);
      game.hudVersion++;
      const slot = game.inventory.slots[index];
      if (slot) {
        const food = foodValue(slot.item) > 0;
        showToast(food ? `${itemName(slot.item)} · tap the eat button` : itemName(slot.item));
        if (isPlaceable(slot.item) || tutorialRef.current === 'select') tutorialSignal({ type: 'selected' });
      }
    },
    [showToast, tutorialSignal],
  );

  const eat = useCallback(() => {
    const { result, events } = eatSelected(gameRef.current);
    if (result === 'full') showToast('You are not hungry');
    handleEvents(events);
  }, [handleEvents, showToast]);

  const openInventory = useCallback(() => {
    setOverlay('inventory');
    tutorialSignal({ type: 'inventory-opened' });
  }, [setOverlay, tutorialSignal]);

  const craftRecipe = useCallback(
    (recipe: Recipe) => {
      const { result, events } = craftInGame(gameRef.current, recipe);
      handleEvents(events);
      return result;
    },
    [handleEvents],
  );

  const quit = useCallback(async () => {
    setSaving(true);
    await save();
    setSaving(false);
    const played = playedMs.current;
    router.back();
    setTimeout(() => ads.maybeShowInterstitial(played), 400);
  }, [ads, router, save]);

  const claimBonus = useCallback(async () => {
    setAdBusy(true);
    const earned = await ads.showRewarded();
    setAdBusy(false);
    if (!earned) {
      showToast('No bonus this time');
      return;
    }
    bonusClaimedAt = Date.now();
    const game = gameRef.current;
    let lost = 0;
    for (const reward of BONUS_ITEMS) lost += addItem(game.inventory, reward.item, reward.count);
    game.hudVersion++;
    sounds.play('pickup', 0.8);
    showToast(`Bonus: ${rewardLabel(BONUS_ITEMS, itemName)}${lost > 0 ? ' (bag full, some items lost)' : ''}`);
  }, [ads, showToast]);

  const reviveWithAd = useCallback(async () => {
    setAdBusy(true);
    const earned = await ads.showRewarded();
    setAdBusy(false);
    if (earned) {
      revive(gameRef.current);
      setOverlay('none');
    } else {
      showToast('Ad not available. Respawn instead.');
    }
  }, [ads, setOverlay, showToast]);

  const controlSize = CONTROL_SIZES[settings.controlsSize];
  const landscape = size ? size.width > size.height : false;
  const sideWidth = controlSize * 2 + 12;
  const hotbarSpace = size
    ? landscape
      ? size.width - insets.left - insets.right - sideWidth * 2 - 48
      : size.width - insets.left - insets.right - 24
    : 320;
  const slotSize = Math.max(34, Math.min(54, Math.floor((hotbarSpace - 8 - 7 * 4) / 8)));
  const hotbarBottom = landscape ? insets.bottom + 14 : insets.bottom + controlSize + 30;
  const bonusWait = bonusReadyIn(bonusClaimedAt, now);
  const bonusLabel = !ads.rewardedReady
    ? 'Bonus items (ad not ready)'
    : bonusWait > 0
      ? `Bonus items in ${Math.ceil(bonusWait / 60000)} min`
      : 'Bonus items (watch ad)';

  const tutorialInfo = tutorial ? TUTORIAL_INFO[tutorial] : null;
  const target = tutorialInfo?.target ?? 'none';
  const position = tutorial ? tutorialPosition(tutorial) : null;
  const recipeTarget = target.startsWith('recipe-') ? target.slice('recipe-'.length) : null;
  // `initial` is the live game object (gameRef only ever holds it), so it is safe to read here.
  const game = initial;
  const crystalDepth = crystalLayer(initial.world.height).top - groundRow(initial);
  let inventoryHint: string | null = null;
  if (overlay === 'inventory' && tutorialInfo && recipeTarget) {
    inventoryHint =
      tutorial === 'planks' && countItem(initial.inventory, Item.Wood) === 0
        ? 'You need wood first. Close the bag and tap a tree trunk to chop it.'
        : `${tutorialInfo.title}: ${tutorialInfo.text}`;
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar hidden />
      <WorldTouchLayer onTouch={touchWorld} onEnd={touchEnd}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </WorldTouchLayer>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          pointerEvents="box-none"
          style={[styles.top, { top: insets.top + 10, left: insets.left + 14, right: insets.right + 14 }]}>
          <View pointerEvents="box-none">
            <View pointerEvents="none">
              <Hearts health={hud.health} />
              {!hud.peaceful ? <HungerBar hunger={hud.hunger} /> : null}
              <View style={styles.chips}>
                <Clock label={hud.clock} night={hud.night} />
                <DepthMeter depth={hud.depth} crystalDepth={crystalDepth} />
              </View>
            </View>
            <QuestCard
              title={hud.quest?.title ?? ''}
              progress={hud.quest?.progress ?? 0}
              target={hud.quest?.target ?? 1}
              done={!hud.quest}
              onPress={() => setOverlay('quests')}
            />
          </View>
          <View style={styles.topButtons}>
            <IconButton icon="trophy-outline" label="Quests" onPress={() => setOverlay('quests')} />
            <Highlightable on={target === 'inventory-button'}>
              <IconButton icon="cube-outline" label="Inventory and crafting" onPress={openInventory} />
            </Highlightable>
            <IconButton icon="pause" label="Pause" onPress={() => setOverlay('pause')} />
          </View>
        </View>

        {toast ? (
          <View pointerEvents="none" style={[styles.toast, { top: insets.top + (landscape ? 12 : 150) }]}>
            <AppText variant="bodyMedium" color="#FFFFFF" style={styles.toastText}>
              {toast}
            </AppText>
          </View>
        ) : null}

        {tutorialInfo && position && overlay === 'none' ? (
          <View
            pointerEvents="box-none"
            style={[styles.tutorialWrap, { bottom: hotbarBottom + slotSize + 22, left: insets.left + 12, right: insets.right + 12 }]}>
            <TutorialCard
              title={tutorialInfo.title}
              text={tutorialInfo.text}
              index={position.index}
              total={position.total}
              onSkip={finishTutorial}
              onDone={tutorial === 'done' ? finishTutorial : undefined}
            />
          </View>
        ) : null}

        <View pointerEvents="box-none" style={[styles.hotbarWrap, { bottom: hotbarBottom }]}>
          <Highlightable on={target === 'hotbar'}>
            <Hotbar slots={hud.hotbar} selected={hud.selected} slotSize={slotSize} onSelect={selectHotbar} />
          </Highlightable>
        </View>

        <View style={[styles.leftPad, { left: insets.left + 16, bottom: insets.bottom + 16 }]}>
          <HoldButton icon="chevron-back" label="Walk left" size={controlSize} onChange={setLeft} highlighted={target === 'move'} />
          <HoldButton
            icon="chevron-forward"
            label="Walk right"
            size={controlSize}
            onChange={setRight}
            highlighted={target === 'move'}
          />
        </View>
        <View style={[styles.rightPad, { right: insets.right + 16, bottom: insets.bottom + 16 }]}>
          {hud.foodSelected ? (
            <View style={styles.eat}>
              <EatButton size={Math.round(controlSize * 0.72)} onPress={eat} />
            </View>
          ) : null}
          <HoldButton icon="arrow-up" label="Jump" size={controlSize * 1.08} onChange={setJump} highlighted={target === 'jump'} />
        </View>
      </View>

      {overlay === 'pause' ? (
        <PauseMenu
          worldName={worldName}
          seedText={seedText}
          controlsSize={settings.controlsSize}
          bonusLabel={adBusy ? 'Loading ad…' : bonusLabel}
          bonusEnabled={ads.rewardedReady && bonusWait === 0 && !adBusy}
          saving={saving}
          onResume={() => setOverlay('none')}
          onInventory={openInventory}
          onQuests={() => setOverlay('quests')}
          onBonus={() => void claimBonus()}
          onControlsSize={(controlsSize) => update({ controlsSize })}
          onQuit={() => void quit()}
        />
      ) : null}
      {overlay === 'inventory' ? (
        <InventoryPanel
          inventory={initial.inventory}
          onChanged={() => {
            gameRef.current.hudVersion++;
          }}
          onClose={() => setOverlay('none')}
          onMessage={showToast}
          onCraft={craftRecipe}
          highlightRecipe={recipeTarget}
          tutorialHint={inventoryHint}
        />
      ) : null}
      {overlay === 'quests' ? (
        <QuestPanel rows={questRows(game)} crystals={hud.crystals} onClose={() => setOverlay('none')} />
      ) : null}
      {overlay === 'win' ? (
        <WinOverlay
          days={Math.max(1, Math.floor(game.time / DAY_SECONDS) + 1)}
          maxDepth={game.stats.maxDepth}
          monsters={game.stats.monstersDefeated}
          onContinue={() => setOverlay('none')}
        />
      ) : null}
      {overlay === 'dead' ? (
        <DeathDialog
          canRevive={ads.rewardedReady}
          busy={adBusy}
          onRespawn={() => {
            respawn(gameRef.current);
            setOverlay('none');
          }}
          onRevive={() => void reviveWithAd()}
        />
      ) : null}
    </View>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0E16' },
  top: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topButtons: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(10,12,20,0.78)',
  },
  toastText: { textAlign: 'center' },
  tutorialWrap: { position: 'absolute', alignItems: 'center' },
  hotbarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  leftPad: { position: 'absolute', flexDirection: 'row', gap: 12 },
  rightPad: { position: 'absolute', alignItems: 'center' },
  eat: { marginBottom: 12 },
});
