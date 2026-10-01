import { DailyEntry } from '../domain/entry.js';
import { NegentropyEvent, NegentropyLeaderboardItem } from '../domain/negentropy.js';

export interface IEntryRepository {
  save(entry: DailyEntry): Promise<DailyEntry>;
  findById(id: string): Promise<DailyEntry | null>;
  findByDate(date: string): Promise<DailyEntry | null>;
  findAll(limit?: number, offset?: number): Promise<DailyEntry[]>;
  findByDateRange(startDate: string, endDate: string): Promise<DailyEntry[]>;
  deleteById(id: string): Promise<boolean>;
  deleteByDate(date: string): Promise<boolean>;
  addNegentropyEvent(event: NegentropyEvent): Promise<NegentropyEvent>;
  deleteNegentropyEvent(id: string): Promise<boolean>;
  getNegentropyLeaderboard(): Promise<NegentropyLeaderboardItem[]>;
  count(): Promise<number>;
}
