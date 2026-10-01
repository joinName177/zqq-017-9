import { CreateEntryInput, CreateNegentropyEventInput } from '../../core/index.js';

/**
 * 离线提交队列
 *
 * 断网期间所有「会改变服务器数据」的操作（评估提交、负熵事件追加/删除、
 * 记录删除）先持久化到 localStorage，联网后由 SyncService 按 clientAt 顺序
 * 逐条补交。队列与渲染解耦，本文件只负责类型、持久化和入队时的意图合并
 * （例如：离线删掉一条从未同步过的本地记录，不应产生任何队列项）。
 */

const QUEUE_STORAGE_KEY = 'anxiety_entropy_sync_queue_v1';
const KNOWN_ENTRIES_STORAGE_KEY = 'anxiety_entropy_known_entries_v1';

export type SyncQueueItemType =
  | 'create-entry'
  | 'delete-entry'
  | 'add-negentropy'
  | 'delete-negentropy';

export interface SyncQueueItemBase {
  /** 本地操作 ID，仅用于去重与渲染标记 */
  id: string;
  type: SyncQueueItemType;
  /** 操作发生时刻（毫秒），FIFO 补交顺序的依据 */
  clientAt: number;
  /** 最近一次补交失败原因（4xx/5xx），用于界面提示 */
  lastError?: string | null;
}

export interface CreateEntryQueueItem extends SyncQueueItemBase {
  type: 'create-entry';
  date: string;
  input: CreateEntryInput;
  /**
   * 该日期记录在本设备最近一次已知的服务器 updatedAt；
   * null 表示本设备从未见过该日期的服务器记录。
   * 补交时若服务器 updatedAt 与此不一致，说明存在并发修改，需用户裁决。
   */
  baseUpdatedAt: string | null;
}

export interface DeleteEntryQueueItem extends SyncQueueItemBase {
  type: 'delete-entry';
  date: string;
  entryId: string;
  baseUpdatedAt: string | null;
}

export interface AddNegentropyQueueItem extends SyncQueueItemBase {
  type: 'add-negentropy';
  date: string;
  /** 入队时已知的 entryId；若指向本地待同步记录则为 local-* id，补交时按日期解析 */
  entryIdHint: string;
  input: CreateNegentropyEventInput;
  /**
   * 本地为待追加事件预分配的事件 id。离线删除该事件时据此互相抵消；
   * 补交成功后也是界面识别该事件的稳定 id。
   */
  clientEventId: string;
}

export interface DeleteNegentropyQueueItem extends SyncQueueItemBase {
  type: 'delete-negentropy';
  date: string;
  eventId: string;
  entryIdHint: string;
}

export type SyncQueueItem =
  | CreateEntryQueueItem
  | DeleteEntryQueueItem
  | AddNegentropyQueueItem
  | DeleteNegentropyQueueItem;

/** 本设备已知的服务器条目快照，用于离线操作的冲突基线判定 */
export interface KnownEntrySnapshot {
  id: string;
  updatedAt: string;
}

function genLocalId(prefix: string): string {
  return `local-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class SyncQueueStore {
  private queue: SyncQueueItem[] = [];
  private knownEntries: Record<string, KnownEntrySnapshot> = {};

  constructor() {
    this.queue = safeParse<SyncQueueItem[]>(
      localStorage.getItem(QUEUE_STORAGE_KEY),
      []
    );
    this.knownEntries = safeParse<Record<string, KnownEntrySnapshot>>(
      localStorage.getItem(KNOWN_ENTRIES_STORAGE_KEY),
      {}
    );
  }

  private persistQueue(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[SyncQueue] Failed to persist sync queue', e);
    }
  }

  private persistKnown(): void {
    try {
      localStorage.setItem(KNOWN_ENTRIES_STORAGE_KEY, JSON.stringify(this.knownEntries));
    } catch (e) {
      console.warn('[SyncQueue] Failed to persist known entries', e);
    }
  }

  public getItems(): SyncQueueItem[] {
    return [...this.queue];
  }

  public count(): number {
    return this.queue.length;
  }

  /** 该日期是否有待同步的删除墓碑（防止删除后又被本地重建/同步覆盖） */
  public hasTombstone(date: string): boolean {
    return this.queue.some((i) => i.type === 'delete-entry' && i.date === date);
  }

  /** 该日期待同步的提交/追加操作（用于界面标记「待同步」） */
  public getPendingItemsForDate(date: string): SyncQueueItem[] {
    return this.queue.filter((i) => i.date === date);
  }

  public updateItem(id: string, patch: Partial<SyncQueueItem>): void {
    this.queue = this.queue.map((i) => (i.id === id ? ({ ...i, ...patch } as SyncQueueItem) : i));
    this.persistQueue();
  }

  public removeItem(id: string): void {
    this.queue = this.queue.filter((i) => i.id !== id);
    this.persistQueue();
  }

  public clearAll(): void {
    this.queue = [];
    this.persistQueue();
  }

  // ---- 入队（含意图合并）----

  /**
   * 评估提交入队。若该日期已有删除墓碑，说明用户先删后建，以最新意图为准：
   * 移除墓碑并入队提交，并继承墓碑携带的服务器基线。
   */
  public enqueueCreateEntry(input: CreateEntryInput, baseUpdatedAt: string | null): SyncQueueItem {
    const tombstone = this.queue.find(
      (i) => i.type === 'delete-entry' && i.date === input.date
    ) as DeleteEntryQueueItem | undefined;

    if (tombstone) {
      this.queue = this.queue.filter((i) => i.id !== tombstone.id);
      baseUpdatedAt = tombstone.baseUpdatedAt;
    }

    const item: CreateEntryQueueItem = {
      id: genLocalId('entry'),
      type: 'create-entry',
      clientAt: Date.now(),
      date: input.date,
      input,
      baseUpdatedAt,
    };
    this.queue.push(item);
    this.persistQueue();
    return item;
  }

  /**
   * 删除记录入队：
   * - 记录从未成功同步过（baseUpdatedAt 为 null 且是本地 id）：直接清理同日期
   *   待同步操作，不留墓碑——服务器上本就没有，不能让幽灵删除占用队列；
   * - 记录已在服务器：入队墓碑，并清理同日期尚未同步的提交/负熵追加，
   *   保证「删了不会又被同步回来」；
   * - 同日期已有墓碑：幂等，不重复入队。
   */
  public enqueueDeleteEntry(date: string, entryId: string, baseUpdatedAt: string | null): void {
    const existedOnServer = baseUpdatedAt !== null || !entryId.startsWith('local-');

    if (this.hasTombstone(date)) {
      // 已存在墓碑：仍需清理同日期的待提交操作
      this.queue = this.queue.filter(
        (i) => i.date !== date || i.type === 'delete-entry'
      );
      this.persistQueue();
      return;
    }

    if (!existedOnServer) {
      // 纯本地记录被删除：连同其所有未同步操作一并丢弃
      this.queue = this.queue.filter((i) => i.date !== date);
      this.persistQueue();
      return;
    }

    this.queue = this.queue.filter(
      (i) => i.date !== date || i.type === 'delete-entry'
    );

    const item: DeleteEntryQueueItem = {
      id: genLocalId('del-entry'),
      type: 'delete-entry',
      clientAt: Date.now(),
      date,
      entryId,
      baseUpdatedAt,
    };
    this.queue.push(item);
    this.persistQueue();
  }

  public enqueueAddNegentropy(
    date: string,
    entryIdHint: string,
    input: CreateNegentropyEventInput
  ): SyncQueueItem {
    const clientEventId = genLocalId('neg-event');
    const item: AddNegentropyQueueItem = {
      id: genLocalId('neg'),
      type: 'add-negentropy',
      clientAt: Date.now(),
      date,
      entryIdHint,
      input: { ...input, entryId: entryIdHint },
      clientEventId,
    };
    this.queue.push(item);
    this.persistQueue();
    return item;
  }

  /**
   * 删除负熵事件入队。若事件本身也还在队列里（从未同步），两条操作互相抵消。
   */
  public enqueueDeleteNegentropy(date: string, eventId: string, entryIdHint: string): void {
    const pendingAdd = this.queue.find(
      (i) => i.type === 'add-negentropy' && i.clientEventId === eventId
    );
    if (pendingAdd) {
      this.queue = this.queue.filter((i) => i.id !== pendingAdd.id);
      this.persistQueue();
      return;
    }

    const item: DeleteNegentropyQueueItem = {
      id: genLocalId('del-neg'),
      type: 'delete-negentropy',
      clientAt: Date.now(),
      date,
      eventId,
      entryIdHint,
    };
    this.queue.push(item);
    this.persistQueue();
  }

  // ---- 服务器基线快照 ----

  public getKnown(date: string): KnownEntrySnapshot | null {
    return this.knownEntries[date] || null;
  }

  /** 用服务器返回的条目更新基线（在线加载/补交成功后调用） */
  public touchKnown(date: string, snapshot: KnownEntrySnapshot): void {
    this.knownEntries[date] = snapshot;
    this.persistKnown();
  }

  public removeKnown(date: string): void {
    delete this.knownEntries[date];
    this.persistKnown();
  }

  /** 从仪表盘/历史列表响应批量同步基线 */
  public hydrateKnown(entries: Array<{ id: string; date: string; updatedAt: string }>): void {
    let changed = false;
    for (const e of entries) {
      if (!e.date || !e.updatedAt) continue;
      const prev = this.knownEntries[e.date];
      if (!prev || prev.updatedAt !== e.updatedAt || prev.id !== e.id) {
        this.knownEntries[e.date] = { id: e.id, updatedAt: e.updatedAt };
        changed = true;
      }
    }
    if (changed) this.persistKnown();
  }
}

export const syncQueueStore = new SyncQueueStore();
