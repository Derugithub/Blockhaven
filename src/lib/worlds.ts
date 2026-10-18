import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { createGame, type GameState } from '@/game/game';
import { seedFromText } from '@/game/rng';
import { deserializeGame, SAVE_VERSION, serializeGame } from '@/game/save-format';

export type WorldSummary = {
  id: string;
  name: string;
  seedText: string;
  createdAt: number;
  updatedAt: number;
};

const SCHEMA_VERSION = 1;
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
  }>('SELECT id, name, seed_text, created_at, updated_at FROM worlds ORDER BY updated_at DESC');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    seedText: r.seed_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Generates and stores a new world. Returns its id. */
export async function createWorld(name: string, seedText: string): Promise<string> {
  const db = await getDatabase();
  const seedLabel = seedText.trim() || String(Math.floor(Math.random() * 2_000_000_000));
  const game = createGame(seedFromText(seedLabel));
  const saved = serializeGame(game);
  const id = newId();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO worlds (id, name, seed_text, created_at, updated_at, format_version, meta, tiles) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name.trim() || 'New world', seedLabel, now, now, SAVE_VERSION, saved.meta, saved.tiles],
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
    meta: string;
    tiles: Uint8Array;
  }>('SELECT id, name, seed_text, created_at, updated_at, meta, tiles FROM worlds WHERE id = ?', [id]);
  if (!row) throw new Error('World not found');
  const game = deserializeGame({ meta: row.meta, tiles: new Uint8Array(row.tiles) });
  return {
    summary: { id: row.id, name: row.name, seedText: row.seed_text, createdAt: row.created_at, updatedAt: row.updated_at },
    game,
  };
}

export async function saveWorld(id: string, game: GameState): Promise<void> {
  const db = await getDatabase();
  const saved = serializeGame(game);
  await db.runAsync('UPDATE worlds SET meta = ?, tiles = ?, format_version = ?, updated_at = ? WHERE id = ?', [
    saved.meta,
    saved.tiles,
    SAVE_VERSION,
    Date.now(),
    id,
  ]);
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM worlds WHERE id = ?', [id]);
}
