import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { SqliteEntryRepository } from '../../src/adapters/db/sqlite-entry-repository.js';
import { DailyEntryService } from '../../src/app/services/daily-entry.service.js';

describe('DailyEntryService Integration with SQLite', () => {
  let db: DatabaseType;
  let repository: SqliteEntryRepository;
  let service: DailyEntryService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE daily_entries (
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

      CREATE TABLE negentropy_events (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        reduction_value REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES daily_entries(id) ON DELETE CASCADE
      );
    `);

    repository = new SqliteEntryRepository(db);
    service = new DailyEntryService(repository);
  });

  afterEach(() => {
    db.close();
  });

  it('should record a daily entry with correct Shannon entropy and persist to SQLite', async () => {
    const entry = await service.recordDailyEntry({
      date: '2026-03-10',
      scores: {
        physicalTension: 7,
        rumination: 8,
        lackOfControl: 6,
        timePressure: 7,
        socialAvoidance: 5,
        futureUncertainty: 7,
      },
      notes: '工作压力较大',
    });

    expect(entry.id).toBeDefined();
    expect(entry.date).toBe('2026-03-10');
    expect(entry.grossEntropy).toBeGreaterThan(60);
    expect(entry.netEntropy).toBe(entry.grossEntropy);
    expect(entry.totalReduction).toBe(0);

    const fetched = await service.getByDate('2026-03-10');
    expect(fetched).not.toBeNull();
    expect(fetched?.scores.rumination).toBe(8);
  });

  it('should add a negentropy event, reducing the net entropy', async () => {
    const entry = await service.recordDailyEntry({
      date: '2026-03-11',
      scores: {
        physicalTension: 8,
        rumination: 8,
        lackOfControl: 8,
        timePressure: 8,
        socialAvoidance: 8,
        futureUncertainty: 8,
      },
    });

    const initialGross = entry.grossEntropy;
    expect(entry.netEntropy).toBe(initialGross);

    const event = await service.addNegentropyEvent({
      entryId: entry.id,
      title: '森林步道散步',
      category: 'nature',
      reductionValue: 20,
    });

    expect(event.id).toBeDefined();

    const updated = await service.getByDate('2026-03-11');
    expect(updated?.totalReduction).toBe(20);
    expect(updated?.netEntropy).toBe(initialGross - 20);
    expect(updated?.negentropyEvents).toHaveLength(1);
  });

  it('should generate dashboard summary with attribution, trend, and river data', async () => {
    await service.seedDemoData();

    const dashboard = await service.getDashboardSummary();
    expect(dashboard.todayEntry).not.toBeNull();
    expect(dashboard.attribution).not.toBeNull();
    expect(dashboard.crisisReport).toBeDefined();
    expect(dashboard.trendReport).toBeDefined();
    expect(dashboard.riverData.length).toBeGreaterThan(0);
    expect(dashboard.leaderboard.length).toBeGreaterThan(0);
    expect(dashboard.historyCount).toBe(14);
  });

  it('should delete daily entry and cascade delete its negentropy events', async () => {
    const entry = await service.recordDailyEntry({
      date: '2026-03-12',
      scores: {
        physicalTension: 4,
        rumination: 4,
        lackOfControl: 4,
        timePressure: 4,
        socialAvoidance: 4,
        futureUncertainty: 4,
      },
      negentropyEvent: {
        title: '听雨声',
        category: 'rest',
        reductionValue: 10,
      },
    });

    expect(entry.negentropyEvents).toHaveLength(1);

    const deleted = await service.deleteEntryById(entry.id);
    expect(deleted).toBe(true);

    const fetched = await service.getByDate('2026-03-12');
    expect(fetched).toBeNull();
  });
});
