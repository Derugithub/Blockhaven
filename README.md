# Blockhaven

## Overview

Blockhaven is a 2D side-view block sandbox for Android, built with Expo and React Native. Each world is generated from a seed: grass hills, sandy stretches, trees and berry bushes, caves, coal and iron ore, a deep crystal layer, and a bedrock floor. You walk, jump, dig, build, craft better tools, keep yourself fed, fight off night monsters, and light the caves with torches.

**The goal:** dig down to the crystal layer just above the bedrock, collect 10 crystals, and build the **Haven Beacon**. A quest line with rewards leads the way there, and a short tutorial teaches the controls the first time you play.

There is no account, no custom backend, and no cloud sync. Worlds are saved in a SQLite database on the device.

## Features

- Seeded procedural worlds, 256 × 128 tiles: grass, dirt, stone, sand, logs and leaves, coal and iron ore, caves, bedrock
- The same seed always gives the same world; any number or word works as a seed
- Player physics with gravity, collision, walking, jumping, automatic one-block step-up, and fall damage
- On-screen walk and jump buttons that work together with multi-touch, in three sizes
- Tap a block within reach to mine it; mining time depends on the block and your best pickaxe
- Tap empty space within reach to place the block selected in the hotbar
- Eight-slot hotbar and a 32-slot inventory with move, swap and merge
- Crafting: planks, sticks, torches, wooden, stone and iron pickaxes, wooden and stone swords, berry pie, and the Haven Beacon
- A goal: 10 rare crystals in the deepest layer (iron pickaxe needed) build the Haven Beacon, with a celebration screen. Play continues afterwards
- 13 quests with item rewards (collect wood, craft a pickaxe, mine stone, find coal, place torches, build a shelter, survive a night, find iron, craft an iron pickaxe, reach 40 m deep, defeat a monster, find a crystal, build the beacon), a quest card in the HUD, a quest list, and a toast and sound on completion
- First-time tutorial: walk, jump, dig, select, place, open the bag, craft planks, sticks and a wooden pickaxe, place a torch. The control for each step pulses. Skippable, and it can be replayed from Settings
- Survival: health and hunger bars, fall damage, slow hunger drain, regeneration when fed, berries from bushes, apples from leaves, and berry pie
- Night monsters that spawn on the dark surface away from torches and from you, walk toward you, hit on contact, can be fought by tapping them (swords hit harder), and burn away at sunrise. At most six at a time
- Peaceful mode, chosen per world when you create it: no monsters and no hunger. Normal is the default
- Depth meter that calls out the crystal layer
- Animated character: walk cycle tied to speed with swinging arms and legs and a body bob, idle breathing, jump and fall poses, an arm swing for digging, placing and fighting, facing flips, and a red flash when hurt
- Sound: footsteps by surface (grass and dirt, stone, sand, wood) in time with the walk cycle, digging and breaking per material, placing, jumping, landing, torches and their crackle, crafting, pickups, quests, hurt, monsters, eating, a win fanfare, and soft day and night ambience. Sound effects, ambience and volume are in Settings
- Day and night cycle with a moving sun and moon, sky colours, darkness underground, and torch light
- Multiple saved worlds: create with a name and seed, continue, delete with confirmation
- Autosave every 30 seconds, when the app goes to the background, when you die, and when you leave a world
- Pause menu, inventory and crafting screen, quest list, settings, and a hint toggle
- Pixel-art blocks and items drawn from code at startup. There are no external textures
- Ads from Google AdMob after UMP consent: a banner on the world list, an optional rewarded ad (revive in place, or a bonus bundle once every 10 minutes), and a frequency-capped interstitial when you return to the menu. Play never waits on an ad

## Requirements

- Node.js 20 or newer (the manual EAS workflows use Node.js 24)
- npm
- An Expo development build for day-to-day work on Android
- For an EAS build: the Expo account `deredo`, the EAS project id in `app.json`, and a repository secret named `EXPO_TOKEN`

This project targets Expo SDK 57. Android is the only native target.

## Getting started

```bash
npm ci
npx expo start
```

- Android development builds use the `development` profile in `eas.json`
- `expo-dev-client` is the first plugin in `app.json`

`@shopify/react-native-skia`, `expo-sqlite`, `react-native-gesture-handler`, `react-native-reanimated`, and `react-native-google-mobile-ads` are native modules. Expo Go does not include the Google Mobile Ads SDK, so use a development build:

```bash
npx eas-cli@latest build --profile development --platform android
```

Do not run that command until you mean to start a build. Development and preview profiles request Google's test ads. Never click live ads.

## Scripts

| Script | Command |
| --- | --- |
| Start | `npm start` |
| Android | `npm run android` |
| Web | `npm run web` |
| Tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Expo Doctor | `npx expo-doctor` |

## How to play

1. Create a world. Keep **Normal** for monsters and hunger, or pick **Peaceful** to just build.
2. Follow the tutorial: walk, jump, dig a block, pick it in the hotbar, place it, then open the bag and craft planks, sticks and a wooden pickaxe.
3. Follow the quest card at the top left. Each quest pays a reward: chop wood, mine stone, find coal, make torches, build a shelter before night.
4. Keep the hunger bar up with berries (bushes), apples (leaves) or berry pie. When fed, health comes back on its own.
5. At night, stay in torch light or fight: tap a monster to hit it. A sword helps. Monsters burn away at sunrise.
6. Dig down. Find iron, craft an iron pickaxe, and follow the depth meter to the crystal layer just above the bedrock. Collect 10 crystals and craft the Haven Beacon.

| Action | Control |
| --- | --- |
| Walk | Hold the left or right arrow (bottom left) |
| Jump | Hold the up arrow (bottom right) |
| Mine | Tap a block within reach. Mining keeps going until the block breaks; drag to the next block to keep digging |
| Place | Select a block in the hotbar, then tap empty space next to another block or a back wall |
| Fight | Tap a monster within reach. Damage: hand 1, pickaxe 2, wooden sword 3, stone sword 5 |
| Eat | Select food in the hotbar, then tap the orange eat button above the jump button |
| Inventory and crafting | Cube button (top right) |
| Quests | Trophy button (top right), or tap the quest card |
| Pause | Pause button (top right), or the Android back button |

Mining rules:

- Dirt, grass, sand, logs, leaves, planks, torches and berry bushes can be mined by hand
- Stone and coal ore need a pickaxe. Iron ore needs a stone pickaxe or better. Crystal ore needs an iron pickaxe. Bedrock cannot be mined
- The best pickaxe in your inventory is used automatically. Stone is faster with a stone pickaxe, faster again with iron
- Grass drops dirt, coal ore drops coal, iron ore drops raw iron, crystal ore drops a crystal, berry bushes drop two berries (and sometimes the bush itself, to replant on grass or dirt), and leaves sometimes drop an apple or a stick

Recipes:

| Output | Ingredients |
| --- | --- |
| 4 planks | 1 log |
| 4 sticks | 2 planks |
| Wooden pickaxe | 3 planks, 2 sticks |
| Wooden sword | 2 planks, 1 stick |
| 4 torches | 1 coal, 1 stick |
| Stone pickaxe | 3 stone, 2 sticks |
| Stone sword | 2 stone, 1 stick |
| Iron pickaxe | 3 raw iron, 2 sticks |
| Berry pie | 3 berries, 1 apple |
| Haven Beacon | 10 crystals, 5 stone |

Survival:

- Health: 10 hearts. Falling more than four tiles hurts. A monster hit costs 2 hearts and knocks you back
- Hunger: 10 points. It drops about one point every 72 seconds, a little faster while walking. While it is at 4 or more, health comes back one heart every 4 seconds, which costs a little hunger. At zero you lose a heart every 8 seconds, down to one heart
- Food: berries +1.5, apple +2.5, berry pie +6
- Monsters spawn only at night, on the open surface, 14 to 28 tiles from you, and never within torch light (about 8 tiles from a torch). They are not saved; a reloaded world starts without them
- If health reaches zero you can respawn at the world spawn with your items, full health and a full stomach, or watch a rewarded ad to get back up where you fell
- Peaceful worlds have no hunger and no monsters, and skip the monster quest

## Rendering

The world is drawn with `@shopify/react-native-skia`. A block atlas (blocks, darker back walls, and crack stages) is built once from code-made pixels. Each frame records an `SkPicture` with the sky, sun or moon, every visible tile in a single `drawAtlas` call with nearest-neighbour sampling, the player, the mining overlay, and the darkness overlay. The picture goes to the canvas through a Reanimated shared value, so the game loop does not re-render React. Only tiles inside the view are visited, so the cost does not grow with the world size.

Light is computed per visible tile: sky light fades with depth below the first opaque block of each column and scales with the time of day; torches add a radius of light; the player has a small glow. Light is drawn as eight darkness levels, one path each.

The player and monsters are drawn from a few rectangles each. Arms and legs rotate around the shoulder and hip, so the animation costs a handful of draw calls per frame. The walk cycle advances with the distance actually walked, and a footstep event fires on each half turn of the cycle, which is what keeps footstep sounds in time with the legs.

The HUD (health, hunger, clock, depth, quest card, hotbar) is React Native. It only updates when something it shows changes.

## Sound

Sound uses `expo-audio`. Every sound is a small mono WAV in `assets/sounds`, generated by `scripts/generate-sounds.mjs` from seeded noise and tones (effects at 16 kHz, ambient loops at 11 kHz, about 520 KB in total). Run `node scripts/generate-sounds.mjs` to rebuild them; the output is deterministic.

- All players are created when a world opens and released when it closes. Short effects are pooled and rewound, so playing one is a single native call
- Footsteps alternate two variants per surface, with a slight random pitch, and are throttled
- Day and night ambience crossfade with the light level and fade down underground
- Audio pauses when the app goes to the background, and ambience pauses on the pause and death screens
- The `expo-audio` config plugin is set to playback only: no microphone permission and no background playback service

**Sound credits:** all sounds were synthesised for Blockhaven by `scripts/generate-sounds.mjs` and are covered by the project's MIT license. No third-party recordings are used.

## Fonts and Amharic

Menus and the HUD use Inter (`@expo-google-fonts/inter`, regular, medium, semibold and bold), loaded with `useFonts` in `src/app/_layout.tsx`. Inter covers Latin, Greek and Cyrillic, not Ethiopic. `src/theme/font-runs.ts` splits text into runs, and `src/theme/font-text.tsx` draws Ethiopic and other uncovered scripts with the Android system face, so Amharic world names never show missing-glyph boxes. Text inputs switch to the system face while they contain Amharic.

## Local data

The database file is `blockhaven.db`, opened with `expo-sqlite`. `PRAGMA user_version` tracks the schema.

`worlds`

| Column | Role |
| --- | --- |
| `id` | Text primary key |
| `name` | World name |
| `seed_text` | The seed as entered |
| `created_at` | Unix time in milliseconds |
| `updated_at` | Last save, Unix time in milliseconds |
| `format_version` | Save format version (`SAVE_VERSION` in `src/game/save-format.ts`) |
| `meta` | JSON: seed, size, time of day, spawn, player position, health, facing, inventory, difficulty, hunger, finished quests, stats, win flag |
| `tiles` | Blob: run-length encoded front tiles, then back walls |
| `difficulty` | `normal` or `peaceful` (schema v2) |
| `won` | 1 once the Haven Beacon is built (schema v2) |

Save format v2 adds difficulty, hunger, quest progress, stats and the win flag. Version 1 worlds load as Normal with a full hunger bar and no quests done, and their untouched stone and grass gain the crystals and berry bushes v1 did not generate, so an old world can still be finished. Saves from a newer app version are refused instead of being misread. Unknown items and quest ids in a save are dropped. Settings (controls size, hints, sound effects, ambience, volume, tutorial progress) are stored with `expo-sqlite/kv-store`. Nothing is synced.

## Ads

`react-native-google-mobile-ads` runs only after Google's UMP consent flow (`AdsConsent.gatherConsent`). The SDK is initialised only when consent allows ad requests. If consent, loading, or showing fails, ads stay off and the game continues. Settings shows **Ad privacy choices** when UMP requires it.

| Placement | Where | Rule |
| --- | --- | --- |
| `menu_banner` | Anchored adaptive banner under the world list | Never on the game screen |
| `return_interstitial` | When you save and quit to the menu | Not in the first 3 minutes of a session, only after 2 minutes of play, at least 4 minutes apart, at most 4 per session |
| `game_rewarded` | Revive in place after a fall, or a bonus bundle (8 torches, 16 planks, 8 sticks) from the pause menu | Optional. The bonus can be claimed once every 10 minutes |

During closed testing every build, production included, uses Google's test units (`TestIds`). The real unit IDs are switched off in `src/lib/ads/production-unit-ids.js` with `const PRODUCTION_UNIT_IDS = null;`.

Blockhaven does not have an AdMob app yet. The AdMob Android app ID is Google's sample ID `ca-app-pub-3940256099942544~3347511713`, in `app.json` (the plugin `androidAppId` and the root `react-native-google-mobile-ads.android_app_id`), in `src/lib/ads/android-app-id.js`, and in the `production` env of `eas.json` as `ADMOB_ANDROID_APP_ID`. `app.config.ts` accepts the sample ID only while real ad units are off.

To turn on real ads at the public release:

1. In AdMob (publisher `pub-4342572133101591`), create the Blockhaven Android app and a banner, an interstitial, and a rewarded unit.
2. Replace the sample app ID with the real Blockhaven app ID in the four places above.
3. In `src/lib/ads/production-unit-ids.js`, delete the line `const PRODUCTION_UNIT_IDS = null;`, uncomment the block under it, and fill in the three unit IDs.
4. Keep `ADS_MODE=live` in the `production` profile of `eas.json` (it is already set). `development` and `preview` stay on test units.
5. Build with the `production` profile. EAS raises `versionCode` automatically, so it is higher than every closed-test build. `app.config.ts` stops the build if any placement is missing or still a Google test unit, or if the app ID is still the sample.

Privacy policy: `https://derugithub.github.io/Privacy-policy/blockhaven/`. Support: `movadmob@gmail.com`.

## EAS builds

`eas.json` defines:

- `development`: `developmentClient`, `distribution: internal`, and `ADS_MODE=test`
- `preview`: `distribution: internal` and `ADS_MODE=test`
- `production`: `autoIncrement`, `ADS_MODE=live`, and `ADMOB_ANDROID_APP_ID`. No `buildArtifactPaths` (see R8 below). While the real unit IDs are commented out it still requests Google's test units.

`cli.appVersionSource` is `remote`, so EAS keeps the Android `versionCode` on its servers. Each `production` build increments it. `app.json` has no `versionCode`. The version name stays `1.0.0`.

`.github/workflows/build.yml` is a manual workflow (`workflow_dispatch` only). It checks out the repo, uses Node.js 24, sets up EAS with npm and `eas-cache: false`, runs `npm ci`, and starts an Android build:

```bash
eas build --platform android --profile <preview|development|production> --non-interactive --no-wait
```

The workflow needs the `EXPO_TOKEN` secret. The EAS project id is in `app.json` under `extra.eas.projectId`.

`react-native-google-mobile-ads` reads a root-level `react-native-google-mobile-ads` object in `app.json` while Android configures. That object sits next to `expo`. EAS Build and local `prebuild` / `run:android` write the resolved Android app ID into that root block before Gradle reads the file, and the rewrite drops comment lines so Gradle can parse `app.json`. Do not commit that rewrite.

## Local Android build

`.github/workflows/local-build.yml` builds Android on the GitHub-hosted Ubuntu runner with `eas build --local`. The build runs on that runner, so it leaves the Expo account's EAS cloud build quota unused. The workflow runs only when someone starts it from the Actions tab.

1. Open the **Actions** tab.
2. Choose **Local Android build**.
3. Choose **Run workflow**.
4. Select a profile: `development`, `preview`, or `production`. The default is `preview`.
5. When the run succeeds, open the run and download the file under **Artifacts**.

The workflow reads `eas.json` and writes `./build-output/app-<profile>.apk`, or `.aab` when that profile builds an Android App Bundle. In this repository, `development` and `preview` are APKs. `production` is an AAB.

It uses the same `EXPO_TOKEN` secret as `.github/workflows/build.yml`. EAS downloads the Android keystore from the Expo account with that token (the first build creates one if the account has none). The selected profile's `env` in `eas.json`, including `ADS_MODE`, is applied by the EAS CLI.

## Release build settings

- R8: `expo-build-properties` sets `enableMinifyInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds`. The only extra keep rule is `-keep class com.google.android.gms.internal.consent_sdk.** { *; }` for the UMP consent SDK. Gradle embeds `mapping.txt` in the AAB, so Play reads it automatically. Do not add `buildArtifactPaths` to any `eas.json` build profile: with `eas build --local --output <file>` the extra artifact overwrites the `.aab`.
- Edge-to-edge: Expo SDK 57 draws edge-to-edge. The game canvas fills the screen; the HUD, controls and menus pad all four safe-area insets. The status bar is hidden while playing.
- Orientation: `orientation` is `default`, with no lock. The game is laid out for landscape first and adapts to portrait (the hotbar moves above the controls). Menus are capped at 720 px and centred on large screens.

## Project structure

```text
src/app/            World list, new world, play, and settings routes
src/game/           Pure game logic: blocks, terrain, physics, mining, crafting, survival, monsters, quests, tutorial, lighting, day cycle, save format, textures
src/audio/          Sound list, event-to-sound mapping, and the expo-audio sound manager
src/render/         Skia atlas, item icons, and the world renderer
src/screens/game/   Game screen, HUD, controls, inventory and crafting, quests, tutorial, win screen, pause and death dialogs
src/components/     Shared UI and the menu banner
src/lib/            SQLite worlds, settings, and ads
src/lib/ads/        Consent, ad policy, AdMob app ID resolution, and production unit IDs
src/theme/          Colours, Inter faces, and the Amharic font fallback
tests/              Terrain, gameplay, crafting, survival, monsters, quests, tutorial, save migration, lighting, fonts, and ad config tests
scripts/            Sound generator
assets/sounds/      Generated sound effects and ambient loops
eas.json            EAS build profiles
.github/workflows/  Manual Android EAS builds (cloud and local)
```

## License

MIT. See [LICENSE](LICENSE).
