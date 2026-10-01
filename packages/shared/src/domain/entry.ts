import { DimensionScores } from './entropy.js';
import { NegentropyEvent } from './negentropy.js';

export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'conflict'
  | 'error'
  | 'pending-delete';

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  scores: DimensionScores;
  grossEntropy: number;
  netEntropy: number;
  totalReduction: number;
  notes?: string;
  negentropyEvents: NegentropyEvent[];
  createdAt: string;
  updatedAt: string;
  /** 乐观锁版本，每次保存/追加/删除负熵事件递增 */
  version: number;
  /** 仅前端本地投影使用：标记该记录或其待同步操作的状态 */
  syncStatus?: SyncStatus;
}

export interface DailyRiverPoint {
  date: string;
  grossEntropy: number;
  netEntropy: number;
  totalReduction: number;
  scores: DimensionScores;
}

export class EntryVersionConflictError extends Error {
  constructor(public readonly serverEntry: DailyEntry) {
    super('服务器上的记录已更新，请选择保留本地版本或服务器版本');
    this.name = 'EntryVersionConflictError';
  }
}
