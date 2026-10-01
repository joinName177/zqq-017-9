import {
  CreateEntryInput,
  CreateNegentropyEventInput,
  DailyEntry,
} from '../../core/index.js';

const QUEUE_KEY = 'anxiety_entropy_sync_queue_v1';

export type SyncQueueType = 'entry-save' | 'entry-delete' | 'negentropy-add' | 'negentropy-delete';
export type SyncQueueStatus = 'queued' | 'syncing' | 'conflict' | 'error';

interface BaseQueueItem {
  id: string;
  type: SyncQueueType;
  createdAt: string;
  status: SyncQueueStatus;
  attempts: number;
  lastError?: string;
  conflictResolved?: boolean;
  conflict?: {
    serverEntry: DailyEntry;
    detectedAt: string;
  };
}

export interface EntrySaveQueueItem extends BaseQueueItem {
  type: 'entry-save';
  payload: CreateEntryInput;
  date: string;
  entryId?: string;
}

export interface EntryDeleteQueueItem extends BaseQueueItem {
  type: 'entry-delete';
  entryId: string;
  date: string;
  baseVersion: number | null;
}

export interface NegentropyAddQueueItem extends BaseQueueItem {
  type: 'negentropy-add';
  entryId: string;
  date?: string;
  payload: CreateNegentropyEventInput;
}

export interface NegentropyDeleteQueueItem extends BaseQueueItem {
  type: 'negentropy-delete';
  eventId: string;
  entryId: string;
  date?: string;
  baseVersion: number | null;
}

export type SyncQueueItem =
  | EntrySaveQueueItem
  | EntryDeleteQueueItem
  | NegentropyAddQueueItem
  | NegentropyDeleteQueueItem;

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type QueueItemInput =
  | Omit<Extract<SyncQueueItem, { type: 'entry-save' }>, 'id' | 'createdAt' | 'status' | 'attempts'>
  | Omit<Extract<SyncQueueItem, { type: 'entry-delete' }>, 'id' | 'createdAt' | 'status' | 'attempts'>
  | Omit<Extract<SyncQueueItem, { type: 'negentropy-add' }>, 'id' | 'createdAt' | 'status' | 'attempts'>
  | Omit<Extract<SyncQueueItem, { type: 'negentropy-delete' }>, 'id' | 'createdAt' | 'status' | 'attempts'>;

export class SyncQueueAdapter {
  public list(): SyncQueueItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      const items = JSON.parse(raw) as SyncQueueItem[];
      return Array.isArray(items) ? items : [];
    } catch (err) {
      console.warn('[SyncQueue] Failed to read offline queue', err);
      return [];
    }
  }

  public save(items: SyncQueueItem[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('[SyncQueue] Failed to persist offline queue', err);
    }
  }

  public enqueue(item: QueueItemInput): SyncQueueItem {
    const items = this.list();
    const queuedItem = {
      ...item,
      id: createId(),
      createdAt: new Date().toISOString(),
      status: 'queued',
      attempts: 0,
    } as SyncQueueItem;
    items.push(queuedItem);
    this.save(items);
    return queuedItem;
  }

  public update(id: string, patch: Partial<SyncQueueItem>): SyncQueueItem | null {
    const items = this.list();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...patch } as SyncQueueItem;
    this.save(items);
    return items[index];
  }

  public remove(id: string): void {
    this.save(this.list().filter((item) => item.id !== id));
  }

  public removeBy(predicate: (item: SyncQueueItem) => boolean): void {
    this.save(this.list().filter((item) => !predicate(item)));
  }

  public clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  }
}

export const syncQueueAdapter = new SyncQueueAdapter();
