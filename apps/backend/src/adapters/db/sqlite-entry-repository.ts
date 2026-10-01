import { Database as DatabaseType } from 'better-sqlite3';
import {
  DailyEntry,
  IEntryRepository,
  NegentropyEvent,
  NegentropyLeaderboardItem,
  NEGENTROPY_CATEGORY_LABELS,
} from '../../core/index.js';

interface DailyEntryRow {
  id: string;
  date: string;
  physical_tension: number;
  rumination: number;
  lack_of_control: number;
  time_pressure: number;
  social_avoidance: number;
  future_uncertainty: number;
  gross_entropy: number;
  net_entropy: number;
  total_reduction: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface NegentropyEventRow {
  id: string;
  entry_id: string;
  title: string;
  category: NegentropyEvent['category'];
  reduction_value: number;
  notes: string | null;
  created_at: string;
}

export class SqliteEntryRepository implements IEntryRepository {
  constructor(private readonly db: DatabaseType) {}

  private mapRowToEntry(row: DailyEntryRow, events: NegentropyEvent[] = []): DailyEntry {
    return {
      id: row.id,
      date: row.date,
      scores: {
        physicalTension: row.physical_tension,
        rumination: row.rumination,
        lackOfControl: row.lack_of_control,
        timePressure: row.time_pressure,
        socialAvoidance: row.social_avoidance,
        futureUncertainty: row.future_uncertainty,
      },
      grossEntropy: row.gross_entropy,
      netEntropy: row.net_entropy,
      totalReduction: row.total_reduction,
      notes: row.notes ?? undefined,
      negentropyEvents: events,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToEvent(row: NegentropyEventRow): NegentropyEvent {
    return {
      id: row.id,
      entryId: row.entry_id,
      title: row.title,
      category: row.category,
      reductionValue: row.reduction_value,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
    };
  }

  public async save(entry: DailyEntry): Promise<DailyEntry> {
    const saveTransaction = this.db.transaction(() => {
      // Upsert entry with handwritten SQL
      const stmt = this.db.prepare(`
        INSERT INTO daily_entries (
          id, date, physical_tension, rumination, lack_of_control,
          time_pressure, social_avoidance, future_uncertainty,
          gross_entropy, net_entropy, total_reduction, notes,
          created_at, updated_at
        ) VALUES (
          @id, @date, @physical_tension, @rumination, @lack_of_control,
          @time_pressure, @social_avoidance, @future_uncertainty,
          @gross_entropy, @net_entropy, @total_reduction, @notes,
          @created_at, @updated_at
        )
        ON CONFLICT(date) DO UPDATE SET
          physical_tension = excluded.physical_tension,
          rumination = excluded.rumination,
          lack_of_control = excluded.lack_of_control,
          time_pressure = excluded.time_pressure,
          social_avoidance = excluded.social_avoidance,
          future_uncertainty = excluded.future_uncertainty,
          gross_entropy = excluded.gross_entropy,
          net_entropy = excluded.net_entropy,
          total_reduction = excluded.total_reduction,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `);

      stmt.run({
        id: entry.id,
        date: entry.date,
        physical_tension: entry.scores.physicalTension,
        rumination: entry.scores.rumination,
        lack_of_control: entry.scores.lackOfControl,
        time_pressure: entry.scores.timePressure,
        social_avoidance: entry.scores.socialAvoidance,
        future_uncertainty: entry.scores.futureUncertainty,
        gross_entropy: entry.grossEntropy,
        net_entropy: entry.netEntropy,
        total_reduction: entry.totalReduction,
        notes: entry.notes ?? null,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      });

      // If entry has existing events to insert
      if (entry.negentropyEvents && entry.negentropyEvents.length > 0) {
        const eventStmt = this.db.prepare(`
          INSERT OR IGNORE INTO negentropy_events (
            id, entry_id, title, category, reduction_value, notes, created_at
          ) VALUES (
            @id, @entry_id, @title, @category, @reduction_value, @notes, @created_at
          )
        `);

        for (const evt of entry.negentropyEvents) {
          eventStmt.run({
            id: evt.id,
            entry_id: entry.id,
            title: evt.title,
            category: evt.category,
            reduction_value: evt.reductionValue,
            notes: evt.notes ?? null,
            created_at: evt.createdAt,
          });
        }
      }
    });

    saveTransaction();

    const saved = await this.findByDate(entry.date);
    return saved || entry;
  }

  public async findById(id: string): Promise<DailyEntry | null> {
    const row = this.db
      .prepare('SELECT * FROM daily_entries WHERE id = ?')
      .get(id) as DailyEntryRow | undefined;

    if (!row) return null;

    const eventRows = this.db
      .prepare('SELECT * FROM negentropy_events WHERE entry_id = ? ORDER BY created_at DESC')
      .all(row.id) as NegentropyEventRow[];

    const events = eventRows.map((e) => this.mapRowToEvent(e));
    return this.mapRowToEntry(row, events);
  }

  public async findByDate(date: string): Promise<DailyEntry | null> {
    const row = this.db
      .prepare('SELECT * FROM daily_entries WHERE date = ?')
      .get(date) as DailyEntryRow | undefined;

    if (!row) return null;

    const eventRows = this.db
      .prepare('SELECT * FROM negentropy_events WHERE entry_id = ? ORDER BY created_at DESC')
      .all(row.id) as NegentropyEventRow[];

    const events = eventRows.map((e) => this.mapRowToEvent(e));
    return this.mapRowToEntry(row, events);
  }

  public async findAll(limit = 30, offset = 0): Promise<DailyEntry[]> {
    const rows = this.db
      .prepare('SELECT * FROM daily_entries ORDER BY date DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as DailyEntryRow[];

    if (rows.length === 0) return [];

    const entryIds = rows.map((r) => r.id);
    const placeholders = entryIds.map(() => '?').join(',');

    const eventRows = this.db
      .prepare(
        `SELECT * FROM negentropy_events WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC`
      )
      .all(...entryIds) as NegentropyEventRow[];

    const eventsByEntryId = new Map<string, NegentropyEvent[]>();
    for (const er of eventRows) {
      const e = this.mapRowToEvent(er);
      const list = eventsByEntryId.get(e.entryId) || [];
      list.push(e);
      eventsByEntryId.set(e.entryId, list);
    }

    return rows.map((r) => this.mapRowToEntry(r, eventsByEntryId.get(r.id) || []));
  }

  public async findByDateRange(startDate: string, endDate: string): Promise<DailyEntry[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM daily_entries WHERE date >= ? AND date <= ? ORDER BY date ASC'
      )
      .all(startDate, endDate) as DailyEntryRow[];

    if (rows.length === 0) return [];

    const entryIds = rows.map((r) => r.id);
    const placeholders = entryIds.map(() => '?').join(',');

    const eventRows = this.db
      .prepare(
        `SELECT * FROM negentropy_events WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC`
      )
      .all(...entryIds) as NegentropyEventRow[];

    const eventsByEntryId = new Map<string, NegentropyEvent[]>();
    for (const er of eventRows) {
      const e = this.mapRowToEvent(er);
      const list = eventsByEntryId.get(e.entryId) || [];
      list.push(e);
      eventsByEntryId.set(e.entryId, list);
    }

    return rows.map((r) => this.mapRowToEntry(r, eventsByEntryId.get(r.id) || []));
  }

  public async deleteById(id: string): Promise<boolean> {
    const info = this.db.prepare('DELETE FROM daily_entries WHERE id = ?').run(id);
    return info.changes > 0;
  }

  public async deleteByDate(date: string): Promise<boolean> {
    const info = this.db.prepare('DELETE FROM daily_entries WHERE date = ?').run(date);
    return info.changes > 0;
  }

  public async addNegentropyEvent(event: NegentropyEvent): Promise<NegentropyEvent> {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO negentropy_events (
            id, entry_id, title, category, reduction_value, notes, created_at
          ) VALUES (
            @id, @entry_id, @title, @category, @reduction_value, @notes, @created_at
          )
        `)
        .run({
          id: event.id,
          entry_id: event.entryId,
          title: event.title,
          category: event.category,
          reduction_value: event.reductionValue,
          notes: event.notes ?? null,
          created_at: event.createdAt,
        });

      // Recalculate parent entry's total reduction and net entropy
      const sumResult = this.db
        .prepare('SELECT COALESCE(SUM(reduction_value), 0) as total FROM negentropy_events WHERE entry_id = ?')
        .get(event.entryId) as { total: number };

      const entryRow = this.db
        .prepare('SELECT gross_entropy FROM daily_entries WHERE id = ?')
        .get(event.entryId) as { gross_entropy: number } | undefined;

      if (entryRow) {
        const totalRed = sumResult.total;
        const netEntropy = Math.max(0, Math.min(100, Math.round(entryRow.gross_entropy - totalRed)));
        this.db
          .prepare('UPDATE daily_entries SET total_reduction = ?, net_entropy = ?, updated_at = ? WHERE id = ?')
          .run(totalRed, netEntropy, new Date().toISOString(), event.entryId);
      }
    });

    transaction();
    return event;
  }

  public async deleteNegentropyEvent(id: string): Promise<boolean> {
    let changed = false;
    const transaction = this.db.transaction(() => {
      const evt = this.db
        .prepare('SELECT entry_id FROM negentropy_events WHERE id = ?')
        .get(id) as { entry_id: string } | undefined;

      if (!evt) return;

      const del = this.db.prepare('DELETE FROM negentropy_events WHERE id = ?').run(id);
      changed = del.changes > 0;

      // Recalculate parent entry's total reduction and net entropy
      const sumResult = this.db
        .prepare('SELECT COALESCE(SUM(reduction_value), 0) as total FROM negentropy_events WHERE entry_id = ?')
        .get(evt.entry_id) as { total: number };

      const entryRow = this.db
        .prepare('SELECT gross_entropy FROM daily_entries WHERE id = ?')
        .get(evt.entry_id) as { gross_entropy: number } | undefined;

      if (entryRow) {
        const totalRed = sumResult.total;
        const netEntropy = Math.max(0, Math.min(100, Math.round(entryRow.gross_entropy - totalRed)));
        this.db
          .prepare('UPDATE daily_entries SET total_reduction = ?, net_entropy = ?, updated_at = ? WHERE id = ?')
          .run(totalRed, netEntropy, new Date().toISOString(), evt.entry_id);
      }
    });

    transaction();
    return changed;
  }

  public async getNegentropyLeaderboard(): Promise<NegentropyLeaderboardItem[]> {
    interface LeaderboardRow {
      title: string;
      category: NegentropyEvent['category'];
      total_reduction: number;
      count: number;
      average_reduction: number;
    }

    const rows = this.db
      .prepare(`
        SELECT
          title,
          category,
          ROUND(SUM(reduction_value), 1) as total_reduction,
          COUNT(*) as count,
          ROUND(AVG(reduction_value), 1) as average_reduction
        FROM negentropy_events
        GROUP BY LOWER(TRIM(title)), category
        ORDER BY total_reduction DESC, count DESC
        LIMIT 20
      `)
      .all() as LeaderboardRow[];

    return rows.map((r, idx) => ({
      rank: idx + 1,
      title: r.title,
      category: r.category,
      categoryLabel: NEGENTROPY_CATEGORY_LABELS[r.category] || '自愈小事',
      totalReduction: r.total_reduction,
      count: r.count,
      averageReduction: r.average_reduction,
    }));
  }

  public async count(): Promise<number> {
    const res = this.db.prepare('SELECT COUNT(*) as cnt FROM daily_entries').get() as {
      cnt: number;
    };
    return res.cnt;
  }
}
