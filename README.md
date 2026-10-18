# Blockhaven

## Overview

Blockhaven is a 2D side-view block sandbox for Android, built with Expo and React Native. Each world is generated from a seed: grass hills, sandy stretches, trees, caves, coal and iron ore, and a bedrock floor. You walk, jump, dig, build, craft better pickaxes, and light the caves and the night with torches.

There is no account, no custom backend, and no cloud sync. Worlds are saved in a SQLite database on the device.

## Features

- Seeded procedural worlds, 256 × 128 tiles: grass, dirt, stone, sand, logs and leaves, coal and iron ore, caves, bedrock
- The same seed always gives the same world; any number or word works as a seed
- Player physics with gravity, collision, walking, jumping, automatic one-block step-up, and fall damage
- On-screen walk and jump buttons that work together with multi-touch, in three sizes
- Tap a block within reach to mine it; mining time depends on the block and your best pickaxe
- Tap empty space within reach to place the block selected in the hotbar
- Eight-slot hotbar and a 32-slot inventory with move, swap and merge
- Crafting: planks, sticks, torches, and wooden, stone and iron pickaxes
- Day and night cycle with a moving sun and moon, sky colours, darkness underground, and torch light
- Multiple saved worlds: create with a name and seed, continue, delete with confirmation
- Autosave every 30 seconds, when the app goes to the background, when you die, and when you leave a world
- Pause menu, inventory and crafting screen, settings, and a hint toggle
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

| Action | Control |
| --- | --- |
| Walk | Hold the left or right arrow (bottom left) |
| Jump | Hold the up arrow (bottom right) |
| Mine | Tap a block within reach. Mining keeps going until the block breaks; drag to the next block to keep digging |
| Place | Select a block in the hotbar, then tap empty space next to another block or a back wall |
| Inventory and crafting | Cube button (top right) |
| Pause | Pause button (top right), or the Android back button |

Mining rules:

- Dirt, grass, sand, logs, leaves, planks and torches can be mined by hand
- Stone and coal ore need a pickaxe. Iron ore needs a stone pickaxe or better. Bedrock cannot be mined
- The best pickaxe in your inventory is used automatically. Stone is faster with a stone pickaxe, faster again with iron
- Grass drops dirt, coal ore drops coal, iron ore drops raw iron, and leaves sometimes drop a stick

Recipes:

| Output | Ingredients |
| --- | --- |
| 4 planks | 1 log |
| 4 sticks | 2 planks |
| 4 torches | 1 coal, 1 stick |
| Wooden pickaxe | 3 planks, 2 sticks |
| Stone pickaxe | 3 stone, 2 sticks |
| Iron pickaxe | 3 raw iron, 2 sticks |

Falling more than four tiles costs health. Health comes back slowly. If it reaches zero you can respawn at the world spawn with your items, or watch a rewarded ad to get back up where you fell.

## Rendering

The world is drawn with `@shopify/react-native-skia`. A block atlas (blocks, darker back walls, and crack stages) is built once from code-made pixels. Each frame records an `SkPicture` with the sky, sun or moon, every visible tile in a single `drawAtlas` call with nearest-neighbour sampling, the player, the mining overlay, and the darkness overlay. The picture goes to the canvas through a Reanimated shared value, so the game loop does not re-render React. Only tiles inside the view are visited, so the cost does not grow with the world size.

Light is computed per visible tile: sky light fades with depth below the first opaque block of each column and scales with the time of day; torches add a radius of light; the player has a small glow. Light is drawn as eight darkness levels, one path each.

The HUD (health, clock, hotbar) is React Native. It only updates when health, the hotbar, or the clock label change.

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
| `meta` | JSON: seed, size, time of day, spawn, player position, health, facing, inventory |
| `tiles` | Blob: run-length encoded front tiles, then back walls |

Saves from a newer app version are refused instead of being misread. Unknown items in a save are dropped. Settings (controls size, hints) are stored with `expo-sqlite/kv-store`. Nothing is synced.

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
src/game/           Pure game logic: blocks, terrain, physics, mining, crafting, lighting, day cycle, save format, textures
src/render/         Skia atlas, item icons, and the world renderer
src/screens/game/   Game screen, HUD, controls, inventory and crafting, pause and death dialogs
src/components/     Shared UI and the menu banner
src/lib/            SQLite worlds, settings, and ads
src/lib/ads/        Consent, ad policy, AdMob app ID resolution, and production unit IDs
src/theme/          Colours, Inter faces, and the Amharic font fallback
tests/              Terrain, gameplay, crafting, save format, lighting, fonts, and ad config tests
eas.json            EAS build profiles
.github/workflows/  Manual Android EAS builds (cloud and local)
```

## License

MIT. See [LICENSE](LICENSE).
