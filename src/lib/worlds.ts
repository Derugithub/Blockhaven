import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { createGame, type GameState } from '@/game/game';
import { seedFromText } from '@/game/rng';
import { deserializeGame, SAVE_VERSION, serializeGame } from '@/game/save-format';
import { isDifficulty, type Difficulty } from '@/game/survival';

export type WorldSummary = {
  id: string;
  name: string;
  seedText: string;
  createdAt: number;
  updatedAt: number;
  difficulty: Difficulty;
  /** The Haven Beacon has been built in this world. */
  won: boolean;
};

/**
 * v1: worlds table.
 * v2: difficulty and won columns, so the world list can show them without parsing saves.
 */
const SCHEMA_VERSION = 2;
let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS worlds (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        seed_text TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        format_version INTEGER NOT NULL,
        meta TEXT NOT NULL,
        tiles BLOB NOT NULL
      );
    `);
  }
  if (current < 2) {
    await db.execAsync(`
      ALTER TABLE worlds ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal';
      ALTER TABLE worlds ADD COLUMN won INTEGER NOT NULL DEFAULT 0;
    `);
  }
  if (current < SCHEMA_VERSION) await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('blockhaven.db').then(async (db) => {
      await migrate(db);
      return db;
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export async function listWorlds(): Promise<WorldSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    seed_text: string;
    created_at: number;
    updated_at: number;
    difficulty: string;
    won: number;
  }>('SELECT id, name, seed_text, created_at, updated_at, difficulty, won FROM worlds ORDER BY updated_at DESC');
  return rows.map(summaryOf);
}

function summaryOf(r: {
  id: string;
  name: string;
  seed_text: string;
  created_at: number;
  updated_at: number;
  difficulty: string;
  won: number;
}): WorldSummary {
  return {
    id: r.id,
    name: r.name,
    seedText: r.seed_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    difficulty: isDifficulty(r.difficulty) ? r.difficulty : 'normal',
    won: r.won === 1,
  };
}

/** Generates and stores a new world. Returns its id. */
export async function createWorld(name: string, seedText: string, difficulty: Difficulty = 'normal'): Promise<string> {
  const db = await getDatabase();
  const seedLabel = seedText.trim() || String(Math.floor(Math.random() * 2_000_000_000));
  const game = createGame(seedFromText(seedLabel), difficulty);
  const saved = serializeGame(game);
  const id = newId();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO worlds (id, name, seed_text, created_at, updated_at, format_version, meta, tiles, difficulty, won) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [id, name.trim() || 'New world', seedLabel, now, now, SAVE_VERSION, saved.meta, saved.tiles, difficulty],
  );
  return id;
}

export async function loadWorld(id: string): Promise<{ summary: WorldSummary; game: GameState }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    seed_text: string;
    created_at: number;
    updated_at: number;
    difficulty: string;
    won: number;
    meta: string;
    tiles: Uint8Array;
  }>('SELECT id, name, seed_text, created_at, updated_at, difficulty, won, meta, tiles FROM worlds WHERE id = ?', [id]);
  if (!row) throw new Error('World not found');
  const game = deserializeGame({ meta: row.meta, tiles: new Uint8Array(row.tiles) });
  return { summary: { ...summaryOf(row), difficulty: game.difficulty, won: game.won }, game };
}

export async function saveWorld(id: string, game: GameState): Promise<void> {
  const db = await getDatabase();
  const saved = serializeGame(game);
  await db.runAsync(
    'UPDATE worlds SET meta = ?, tiles = ?, format_version = ?, updated_at = ?, difficulty = ?, won = ? WHERE id = ?',
    [saved.meta, saved.tiles, SAVE_VERSION, Date.now(), game.difficulty, game.won ? 1 : 0, id],
  );
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM worlds WHERE id = ?', [id]);
}
