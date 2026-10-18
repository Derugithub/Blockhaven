import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton } from '@/components/ui';
import { Item, itemName } from '@/game/blocks';
import { clockLabel, isNight } from '@/game/daycycle';
import { respawn, revive, stepGame, tapTile, type GameEvent, type GameState } from '@/game/game';
import { addItem, bestPickaxeTier, HOTBAR_SIZE, selectSlot, type Slot } from '@/game/inventory';
import type { MoveInput } from '@/game/player';
import { bonusReadyIn } from '@/lib/ads/ad-policy';
import { useAds } from '@/lib/ads/ads-context';
import { CONTROL_SIZES, useSettings } from '@/lib/settings';
import { saveWorld } from '@/lib/worlds';
import { WorldRenderer, type View as Camera } from '@/render/renderer';

import { HoldButton, WorldTouchLayer } from './controls';
import { DeathDialog, PauseMenu } from './dialogs';
import { Clock, Hearts, Hotbar } from './hud';
import { InventoryPanel } from './inventory-panel';

const AUTOSAVE_MS = 30_000;
const TOAST_MS = 1800;

type Overlay = 'none' | 'pause' | 'inventory' | 'dead';

type Hud = { health: number; hotbar: Slot[]; selected: number; clock: string; night: boolean };

function hudOf(game: GameState): Hud {
  return {
    health: game.player.health,
    hotbar: game.inventory.slots.slice(0, HOTBAR_SIZE).map((s) => (s ? { ...s } : null)),
    selected: game.inventory.selected,
    clock: clockLabel(game.time),
    night: isNight(game.time),
  };
}

export function tileSizeFor(width: number, height: number): number {
  return Math.max(22, Math.min(56, Math.round(Math.min(width, height) / 13)));
}

function emptyPicture(): SkPicture {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return recorder.finishRecordingAsPicture();
}

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
  const { settings, update } = useSettings();

  const gameRef = useRef(initial);
  const input = useRef<MoveInput>({ left: false, right: false, jump: false });
  const camera = useRef<Camera | null>(null);
  const renderer = useRef<WorldRenderer | null>(null);
  const overlayRef = useRef<Overlay>('none');
  const savingRef = useRef(false);
  const playedMs = useRef(0);
  const lastTouchTile = useRef<string | null>(null);
  const [firstPicture] = useState(emptyPicture);
  const picture = useSharedValue<SkPicture>(firstPicture);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [hud, setHud] = useState<Hud>(() => hudOf(initial));
  const [overlay, setOverlayState] = useState<Overlay>('none');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
        switch (event.type) {
          case 'needs-tool':
            showToast(
              bestPickaxeTier(gameRef.current.inventory) === 0
                ? 'Craft a wooden pickaxe to mine this'
                : 'You need a stronger pickaxe',
            );
            break;
          case 'mined':
            if (event.lost > 0) showToast('Inventory is full');
            break;
          case 'unsupported':
            showToast('Place it next to another block');
            break;
          case 'out-of-reach':
            if (settings.showHints) showToast('Out of reach');
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
    [save, setOverlay, settings.showHints, showToast],
  );

  // Game loop: physics and drawing run here, outside React renders. The HUD state only changes
  // when health, the hotbar or the clock label actually changes.
  useEffect(() => {
    if (!size) return;
    if (!renderer.current) renderer.current = new WorldRenderer();
    const tilePx = tileSizeFor(size.width, size.height);
    let raf = 0;
    let last = 0;
    let lastHud = -1;
    let lastClock = '';
    let lastDrawnPaused = false;

    const frame = (timestamp: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (timestamp - last) / 1000);
      last = timestamp;
      const game = gameRef.current;
      const running = overlayRef.current === 'none';

      if (running) {
        playedMs.current += dt * 1000;
        handleEvents(stepGame(game, input.current, dt));
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
        picture.set(renderer.current!.draw(game, camera.current!));
        lastDrawnPaused = !running;
      }
      if (running) lastDrawnPaused = false;

      const clock = clockLabel(game.time);
      if (game.hudVersion !== lastHud || clock !== lastClock) {
        lastHud = game.hudVersion;
        lastClock = clock;
        setHud(hudOf(game));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, handleEvents, picture]);

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
      if (current === 'inventory') setOverlay('none');
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

  const touchTile = useCallback(
    (x: number, y: number, moving: boolean) => {
      const cam = camera.current;
      if (!cam || overlayRef.current !== 'none') return;
      const tx = Math.floor(cam.camX + x / cam.tilePx);
      const ty = Math.floor(cam.camY + y / cam.tilePx);
      const key = `${tx},${ty}`;
      if (moving && key === lastTouchTile.current) return;
      lastTouchTile.current = key;
      const game = gameRef.current;
      // Dragging only mines, so a slide across the screen does not scatter blocks.
      if (moving && game.world.fg[ty * game.world.width + tx] === 0) return;
      handleEvents(tapTile(game, tx, ty));
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

  const selectHotbar = useCallback((index: number) => {
    const game = gameRef.current;
    selectSlot(game.inventory, index);
    game.hudVersion++;
    const slot = game.inventory.slots[index];
    if (slot) showToast(itemName(slot.item));
  }, [showToast]);

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
    addItem(game.inventory, Item.Torch, 8);
    addItem(game.inventory, Item.Planks, 16);
    addItem(game.inventory, Item.Stick, 8);
    game.hudVersion++;
    showToast('Bonus: 8 torches, 16 planks, 8 sticks');
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
  const bonusWait = bonusReadyIn(bonusClaimedAt, now);
  const bonusLabel = !ads.rewardedReady
    ? 'Bonus items (ad not ready)'
    : bonusWait > 0
      ? `Bonus items in ${Math.ceil(bonusWait / 60000)} min`
      : 'Bonus items (watch ad)';

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar hidden />
      <WorldTouchLayer onTouch={touchTile} onEnd={touchEnd}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </WorldTouchLayer>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          pointerEvents="box-none"
          style={[styles.top, { top: insets.top + 10, left: insets.left + 14, right: insets.right + 14 }]}>
          <View pointerEvents="none">
            <Hearts health={hud.health} />
            <Clock label={hud.clock} night={hud.night} />
          </View>
          <View style={styles.topButtons}>
            <IconButton icon="cube-outline" label="Inventory and crafting" onPress={() => setOverlay('inventory')} />
            <IconButton icon="pause" label="Pause" onPress={() => setOverlay('pause')} />
          </View>
        </View>

        {toast ? (
          <View pointerEvents="none" style={[styles.toast, { top: insets.top + 12 }]}>
            <AppText variant="bodyMedium" color="#FFFFFF">
              {toast}
            </AppText>
          </View>
        ) : null}

        <View
          pointerEvents="box-none"
          style={[
            styles.hotbarWrap,
            landscape
              ? { bottom: insets.bottom + 14 }
              : { bottom: insets.bottom + controlSize + 30 },
          ]}>
          <Hotbar slots={hud.hotbar} selected={hud.selected} slotSize={slotSize} onSelect={selectHotbar} />
        </View>

        <View style={[styles.leftPad, { left: insets.left + 16, bottom: insets.bottom + 16 }]}>
          <HoldButton icon="chevron-back" label="Walk left" size={controlSize} onChange={setLeft} />
          <HoldButton icon="chevron-forward" label="Walk right" size={controlSize} onChange={setRight} />
        </View>
        <View style={[styles.rightPad, { right: insets.right + 16, bottom: insets.bottom + 16 }]}>
          <HoldButton icon="arrow-up" label="Jump" size={controlSize * 1.08} onChange={setJump} />
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
          onInventory={() => setOverlay('inventory')}
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
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(10,12,20,0.78)',
  },
  hotbarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  leftPad: { position: 'absolute', flexDirection: 'row', gap: 12 },
  rightPad: { position: 'absolute' },
});
