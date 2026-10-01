import { z } from 'zod';
import { DailyEntry, DailyRiverPoint } from '../domain/entry.js';
import { AttributionResult, EntropyCalculationResult } from '../domain/entropy.js';
import { CrisisReport } from '../domain/crisis.js';
import { TrendReport } from '../domain/trend.js';
import { NegentropyLeaderboardItem } from '../domain/negentropy.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardData {
  todayEntry: DailyEntry | null;
  todayCalculation: EntropyCalculationResult | null;
  attribution: AttributionResult | null;
  crisisReport: CrisisReport;
  trendReport: TrendReport;
  leaderboard: NegentropyLeaderboardItem[];
  riverData: DailyRiverPoint[];
  historyCount: number;
}

export const dateRangeQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().min(1).max(365).optional(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(30),
  offset: z.coerce.number().min(0).default(0),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
