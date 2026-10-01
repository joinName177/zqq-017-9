import { DailyEntry } from '../core/index.js';
import {
  SyncQueueAdapter,
  SyncQueueItem,
  syncQueueAdapter,
} from '../adapters/storage/sync-queue-adapter.js';
import type {
  EntrySaveQueueItem,
  NegentropyAddQueueItem,
} from '../adapters/storage/sync-queue-adapter.js';
import { HttpClientError, httpClient } from '../adapters/api/http-client.js';

export interface SyncResult {
  processed: number;
  failed: number;
  conflicts: number;
}

type QueueChangeListener = (items: SyncQueueItem[], isSyncing: boolean) => void;

function createClientEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class SyncQueueManager {
  private isSyncing = false;
  private listeners = new Set<QueueChangeListener>();

  constructor(private readonly queue: SyncQueueAdapter) {
    this.recoverInterruptedItems();
  }

  private recoverInterruptedItems(): void {
    const interrupted = this.queue.list().filter((item) => item.status === 'syncing');
    if (interrupted.length === 0) return;
    this.queue.save(
      this.queue.list().map((item) =>
        item.status === 'syncing' ? { ...item, status: 'queued' } : item
      )
    );
  }

  public getItems(): SyncQueueItem[] {
    return this.queue.list();
  }

  public get isRunning(): boolean {
    return this.isSyncing;
  }

  public subscribe(listener: QueueChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getItems(), this.isSyncing);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const items = this.getItems();
    for (const listener of this.listeners) listener(items, this.isSyncing);
  }

  public queueEntrySave(input: EntrySaveQueueItem['payload'], date: string, entryId?: string): SyncQueueItem {
    const payload = input.negentropyEvent
      ? {
          ...input,
          negentropyEvent: {
            ...input.negentropyEvent,
            clientEventId: input.negentropyEvent.clientEventId || createClientEventId(),
          },
        }
      : input;
    const item = this.queue.enqueue({ type: 'entry-save', payload, date, entryId });
    this.emit();
    return item;
  }

  public queueEntryDelete(
    entry: DailyEntry,
    existsOnServer = true
  ): SyncQueueItem | null {
    const relatedSaves = this.queue.list().filter(
      (item) =>
        item.type === 'entry-save' &&
        (item.date === entry.date || Boolean(item.entryId && item.entryId === entry.id))
    );

    if (!existsOnServer && relatedSaves.length > 0) {
      this.queue.removeBy(
        (item) =>
          item.type === 'entry-save' &&
          (item.date === entry.date || Boolean(item.entryId && item.entryId === entry.id))
      );
      this.queue.removeBy(
        (item) =>
          (item.type === 'negentropy-add' || item.type === 'negentropy-delete') &&
          (item.entryId === entry.id || item.date === entry.date)
      );
      this.emit();
      return null;
    }

    const queuedBase = relatedSaves.find((item) =>
      item.type === 'entry-save' && item.payload.baseVersion !== undefined
    );
    const baseVersion = queuedBase && queuedBase.type === 'entry-save'
      ? queuedBase.payload.baseVersion!
      : entry.version;

    this.queue.removeBy(
      (item) =>
        item.type === 'entry-save' &&
        (item.date === entry.date || Boolean(item.entryId && item.entryId === entry.id))
    );
    this.queue.removeBy(
      (item) =>
        (item.type === 'negentropy-add' || item.type === 'negentropy-delete') &&
        (item.entryId === entry.id || item.date === entry.date)
    );

    const existing = this.queue.list().find(
      (item) =>
        item.type === 'entry-delete' &&
        (item.entryId === entry.id || item.date === entry.date)
    );
    if (existing) {
      this.emit();
      return existing;
    }

    const item = this.queue.enqueue({
      type: 'entry-delete',
      entryId: entry.id,
      date: entry.date,
      baseVersion,
    });
    this.emit();
    return item;
  }

  public queueNegentropyAdd(
    payload: NegentropyAddQueueItem['payload'],
    entry: DailyEntry
  ): SyncQueueItem {
    const item = this.queue.enqueue({
      type: 'negentropy-add',
      entryId: entry.id,
      date: entry.date,
      payload: {
        ...payload,
        entryId: entry.id,
        clientEventId: payload.clientEventId || createClientEventId(),
        baseVersion: entry.version,
      },
    });
    this.emit();
    return item;
  }

  public queueNegentropyDelete(eventId: string, entry: DailyEntry): SyncQueueItem | null {
    const localEvent = entry.negentropyEvents.find(
      (event) => event.id === eventId || event.clientEventId === eventId
    );
    if (localEvent?.syncStatus === 'pending') {
      this.queue.removeBy((item) => {
        if (item.type === 'negentropy-add') {
          return item.payload.clientEventId === localEvent.clientEventId
            || `local-event-${item.id}` === eventId;
        }
        return false;
      });
      this.emit();
      return null;
    }

    const item = this.queue.enqueue({
      type: 'negentropy-delete',
      eventId,
      entryId: entry.id,
      date: entry.date,
      baseVersion: entry.version,
    });
    this.emit();
    return item;
  }

  public reconcileEntrySaved(savedEntry: DailyEntry): void {
    this.updateAfterEntrySave(savedEntry);
  }

  public cancelEntryOperations(entry: DailyEntry): void {
    this.queue.removeBy(
      (item) =>
        item.type === 'entry-delete' &&
        (item.entryId === entry.id || item.date === entry.date)
    );
    this.queue.removeBy(
      (item) =>
        item.type === 'entry-save' &&
        (item.date === entry.date || Boolean(item.entryId && item.entryId === entry.id))
    );
    this.queue.removeBy(
      (item) =>
        (item.type === 'negentropy-add' || item.type === 'negentropy-delete') &&
        (item.entryId === entry.id || item.date === entry.date)
    );
    this.emit();
  }

  public markConflict(item: SyncQueueItem, serverEntry: DailyEntry): SyncQueueItem {
    this.queue.update(item.id, {
      status: 'conflict',
      conflict: { serverEntry, detectedAt: new Date().toISOString() },
      lastError: '服务器上的记录已更新',
      entryId: item.type === 'entry-save' ? serverEntry.id : item.entryId,
    } as Partial<SyncQueueItem>);
    this.emit();
    return this.queue.list().find((candidate) => candidate.id === item.id)!;
  }

  public discardItem(id: string): void {
    this.queue.remove(id);
    this.emit();
  }

  public resolveConflict(id: string, keep: 'local' | 'server'): void {
    if (keep === 'server') {
      this.discardItem(id);
      return;
    }
    this.queue.update(id, {
      status: 'queued',
      conflict: undefined,
      conflictResolved: true,
      lastError: undefined,
    } as Partial<SyncQueueItem>);
    this.emit();
    void this.sync();
  }

  private markError(item: SyncQueueItem, message: string): void {
    this.queue.update(item.id, {
      status: 'error',
      attempts: item.attempts + 1,
      lastError: message,
    } as Partial<SyncQueueItem>);
  }

  private updateAfterEntrySave(savedEntry: DailyEntry): void {
    const items = this.queue.list();
    for (let i = 0; i < items.length; i += 1) {
      const current = items[i]!;

      if (
        current.type === 'entry-save' &&
        (current.date === savedEntry.date || (current.entryId && current.entryId === savedEntry.id))
      ) {
        current.entryId = savedEntry.id;
        current.payload = { ...current.payload, baseVersion: savedEntry.version };
      }

      if (
        (current.type === 'negentropy-add' || current.type === 'negentropy-delete') &&
        (current.entryId === savedEntry.id || current.date === savedEntry.date)
      ) {
        current.entryId = savedEntry.id;
        if (current.type === 'negentropy-add') {
          current.payload = { ...current.payload, entryId: savedEntry.id, baseVersion: savedEntry.version };
        } else {
          current.baseVersion = savedEntry.version;
        }
      }
    }
    this.queue.save(items);
  }

  private async processItem(item: SyncQueueItem): Promise<boolean> {
    if (item.type === 'entry-save') {
      const payload = item.conflictResolved
        ? { ...item.payload, force: true }
        : item.payload;
      const saved = await httpClient.recordEntry(payload);
      this.updateAfterEntrySave(saved);
      this.queue.remove(item.id);
      return true;
    }

    if (item.type === 'entry-delete') {
      await httpClient.deleteEntry(item.entryId, {
        baseVersion: item.baseVersion,
        force: item.conflictResolved,
      });
      this.queue.removeBy(
        (candidate) =>
          candidate.id !== item.id &&
          (candidate.type === 'entry-save' && candidate.date === item.date)
      );
      this.queue.remove(item.id);
      return true;
    }

    if (item.type === 'negentropy-add') {
      const payload = item.conflictResolved
        ? { ...item.payload, force: true }
        : item.payload;
      await httpClient.addNegentropy(payload);
      this.queue.remove(item.id);
      return true;
    }

    const updatedEntry = await httpClient.deleteNegentropy(item.eventId, {
      baseVersion: item.baseVersion,
      force: item.conflictResolved,
    });
    if (updatedEntry) {
      const items = this.queue.list();
      for (const current of items) {
        if (
          current.type === 'negentropy-add' &&
          (current.entryId === item.entryId || current.date === item.date)
        ) {
          current.payload = { ...current.payload, baseVersion: updatedEntry.version };
        }
      }
      this.queue.save(items);
    }
    this.queue.remove(item.id);
    return true;
  }

  public async sync(): Promise<SyncResult> {
    if (this.isSyncing) return { processed: 0, failed: 0, conflicts: 0 };
    this.isSyncing = true;
    this.emit();

    const result: SyncResult = { processed: 0, failed: 0, conflicts: 0 };

    try {
      let item = this.queue.list().find((candidate) => candidate.status === 'queued' || candidate.status === 'error');
      while (item) {
        this.queue.update(item.id, { status: 'syncing' } as Partial<SyncQueueItem>);
        this.emit();
        const current = this.queue.list().find((candidate) => candidate.id === item!.id) || item;

        try {
          await this.processItem(current);
          result.processed += 1;
        } catch (err) {
          if (err instanceof HttpClientError && err.isConflict) {
            if (!err.serverEntry) {
              this.markError(current, err.message);
              result.failed += 1;
              break;
            }
            this.markConflict(current, err.serverEntry);
            result.conflicts += 1;
            break;
          }
          if (err instanceof HttpClientError && err.isNetworkError) {
            this.queue.update(current.id, {
              status: 'queued',
              lastError: err.message,
            } as Partial<SyncQueueItem>);
            result.failed += 1;
            break;
          }
          this.markError(current, err instanceof Error ? err.message : '同步失败');
          result.failed += 1;
          break;
        }

        this.emit();
        item = this.queue.list().find((candidate) => candidate.status === 'queued' || candidate.status === 'error');
      }
    } finally {
      this.isSyncing = false;
      this.emit();
    }

    return result;
  }
}

export const syncQueueManager = new SyncQueueManager(syncQueueAdapter);
