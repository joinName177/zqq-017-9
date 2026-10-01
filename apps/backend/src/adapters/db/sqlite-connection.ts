import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function createDatabaseConnection(dbPath: string): DatabaseType {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema with handwritten SQL
  initSchema(db);

  return db;
}

function initSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_entries (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      physical_tension REAL NOT NULL DEFAULT 0,
      rumination REAL NOT NULL DEFAULT 0,
      lack_of_control REAL NOT NULL DEFAULT 0,
      time_pressure REAL NOT NULL DEFAULT 0,
      social_avoidance REAL NOT NULL DEFAULT 0,
      future_uncertainty REAL NOT NULL DEFAULT 0,
      gross_entropy REAL NOT NULL DEFAULT 0,
      net_entropy REAL NOT NULL DEFAULT 0,
      total_reduction REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS negentropy_events (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      reduction_value REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES daily_entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date DESC);
    CREATE INDEX IF NOT EXISTS idx_negentropy_events_entry_id ON negentropy_events(entry_id);
    CREATE INDEX IF NOT EXISTS idx_negentropy_events_category ON negentropy_events(category);
  `);
}
