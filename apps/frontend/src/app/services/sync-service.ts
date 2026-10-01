import {
  DailyEntry,
  NegentropyEvent,
} from '../../core/index.js';
import {
  HttpClient,
  HttpNotFoundError,
  HttpRequestError,
  httpClient,
  isOfflineError,
} from '../../adapters/api/http-client.js';
import {
  SyncQueueItem,
  CreateEntryQueueItem,
  DeleteEntryQueueItem,
  AddNegentropyQueueItem,
  DeleteNegentropyQueueItem,
  syncQueueStore,
  SyncQueueStore,
} from '../../adapters/storage/sync-queue-adapter.js';

/**
 * 离线提交队列的补交引擎。
 *
 * 规则：
 * 1. 严格按 clientAt（FIFO）顺序逐条补交，同一日期的多次提交按当时顺序重放；
 * 2. 补交 create-entry / delete-entry 前先 GET 当日服务器记录，对比基线
 *    updatedAt——服务器存在更新的并发记录时挂起队列，交由用户裁决，绝不静默覆盖；
 * 3. 删除操作若发现记录已被服务器更新，同样必须让用户选择「确认删除」还是
 *    「保留服务器版本」，避免删掉用户后来在别处编辑的内容；
 * 4. 队列执行期间自身写入造成的 updatedAt 变化记录在 ownWrites 中，不误报冲突；
 * 5. 网络错误：保留队列稍后重试；4xx 永久错误：标记 lastError 跳过，交界面提示。
 */

export type ConflictKind = 'entry-create' | 'entry-delete' | 'negentropy-entry-missing';

export interface SyncConflict {
  item: SyncQueueItem;
  kind: ConflictKind;
  date: string;
  /** 服务器当前版本（create/delete 冲突时存在） */
  serverEntry: DailyEntry | null;
  message: string;
}

/** 用户对冲突的裁决 */
export type ConflictDecision =
  | { resolution: 'use-local' } // 保留本地：提交/删除照做
  | { resolution: 'use-server' } // 保留服务器：丢弃该条队列操作
  | { resolution: 'cancel' }; // 暂停整个补交，稍后再处理

export type ConflictResolver = (conflict: SyncConflict) => Promise<ConflictDecision>;

export interface FlushResult {
  ok: boolean;
  synced: number;
  remaining: number;
  offline: boolean;
  cancelled: boolean;
  failed: SyncQueueItem[];
}

interface Deps {
  http: HttpClient;
  store: SyncQueueStore;
  resolver: ConflictResolver;
}

function isRetryable(err: unknown): boolean {
  if (isOfflineError(err)) return true;
  if (err instanceof HttpRequestError && (err.status === 429 || err.status >= 500)) {
    return true;
  }
  return false;
}

function isPermanentHttpError(err: unknown): HttpRequestError | null {
  if (err instanceof HttpRequestError && err.status > 0 && err.status < 500 && err.status !== 429) {
    return err;
  }
  return null;
}

export class SyncService {
  private readonly http: HttpClient;
  private readonly store: SyncQueueStore;
  private resolver: ConflictResolver;
  private flushing = false;

  constructor(deps: Deps) {
    this.http = deps.http;
    this.store = deps.store;
    this.resolver = deps.resolver;
  }

  public setResolver(resolver: ConflictResolver): void {
    this.resolver = resolver;
  }

  public isFlushing(): boolean {
    return this.flushing;
  }

  public async flush(): Promise<FlushResult> {
    if (this.flushing) {
      return { ok: false, synced: 0, remaining: this.store.count(), offline: false, cancelled: false, failed: [] };
    }

    if (this.store.count() === 0) {
      return { ok: true, synced: 0, remaining: 0, offline: false, cancelled: false, failed: [] };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { ok: false, synced: 0, remaining: this.store.count(), offline: true, cancelled: false, failed: [] };
    }

    this.flushing = true;
    let synced = 0;
    let wentOffline = false;
    let cancelled = false;
    const failed: SyncQueueItem[] = [];
    /** 本次 flush 中各日期「我们自己写入后」的 updatedAt，用于排除自冲突 */
    const ownWrites = new Map<string, string>();

    try {
      // 每次循环重新取队列，冲突裁决/错误标记可能改变队列内容
      while (true) {
        const items = this.store.getItems().sort((a, b) => a.clientAt - b.clientAt);
        const item = items[0];
        if (!item) break;

        try {
          const stop = await this.processItem(item, ownWrites);
          if (stop === 'offline') {
            wentOffline = true;
            break;
          }
          if (stop === 'cancel') {
            cancelled = true;
            break;
          }
          if (stop === 'done') {
            this.store.removeItem(item.id);
            synced++;
          }
        } catch (err) {
          if (isRetryable(err)) {
            wentOffline = true;
            break;
          }
          const permanent = isPermanentHttpError(err);
          if (permanent) {
            // 永久失败（如 400 参数不合法）：保留在队列并标记原因，
            // 界面上由用户决定移除；同时中断本轮补交，避免反复打服务器
            this.store.updateItem(item.id, {
              lastError: permanent.message || `HTTP ${permanent.status}`,
            });
            failed.push({ ...item, lastError: permanent.message });
            break;
          }
          wentOffline = true;
          break;
        }
      }
    } finally {
      this.flushing = false;
    }

    const remaining = this.store.count();
    return {
      ok: !wentOffline && !cancelled && failed.length === 0 && remaining === 0,
      synced,
      remaining,
      offline: wentOffline,
      cancelled,
      failed,
    };
  }

  /**
   * 处理单条队列项。
   * @returns done=完成可移除 / offline=网络问题需保留 / cancel=用户要求中止
   */
  private async processItem(
    item: SyncQueueItem,
    ownWrites: Map<string, string>
  ): Promise<'done' | 'offline' | 'cancel'> {
    switch (item.type) {
      case 'create-entry':
        return this.processCreateEntry(item, ownWrites);
      case 'delete-entry':
        return this.processDeleteEntry(item, ownWrites);
      case 'add-negentropy':
        return this.processAddNegentropy(item);
      case 'delete-negentropy':
        return this.processDeleteNegentropy(item);
    }
  }

  /**
   * 判定同日是否存在更新的服务器记录。
   * - 服务器无记录：无冲突；
   * - 基线为 null 且服务器 updatedAt 早于本次操作时间：无冲突（本设备首次提交）；
   * - updatedAt 等于基线或等于本次 flush 自身写入：无冲突；
   * - 其余：服务器有本设备未知的更新，需要用户裁决。
   */
  private async detectServerConflict(
    date: string,
    baseUpdatedAt: string | null,
    clientAt: number,
    ownWrites: Map<string, string>
  ): Promise<{ conflict: false; server: DailyEntry | null } | { conflict: true; server: DailyEntry }> {
    let server: DailyEntry | null = null;
    try {
      server = await this.http.getEntryByDate(date);
    } catch (err) {
      if (isRetryable(err)) throw err;
      throw err;
    }

    if (!server) return { conflict: false, server: null };

    if (ownWrites.has(date) && ownWrites.get(date) === server.updatedAt) {
      return { conflict: false, server };
    }

    if (baseUpdatedAt && server.updatedAt === baseUpdatedAt) {
      return { conflict: false, server };
    }

    if (!baseUpdatedAt && new Date(server.updatedAt).getTime() <= clientAt) {
      return { conflict: false, server };
    }

    return { conflict: true, server };
  }

  private async askUser(conflict: SyncConflict): Promise<ConflictDecision> {
    try {
      return await this.resolver(conflict);
    } catch {
      return { resolution: 'cancel' };
    }
  }

  private async processCreateEntry(
    item: CreateEntryQueueItem,
    ownWrites: Map<string, string>
  ): Promise<'done' | 'offline' | 'cancel'> {
    const detection = await this.detectServerConflict(
      item.date,
      item.baseUpdatedAt,
      item.clientAt,
      ownWrites
    );

    if (detection.conflict) {
      const decision = await this.askUser({
        item,
        kind: 'entry-create',
        date: item.date,
        serverEntry: detection.server,
        message: `服务器上 ${item.date} 已有更新的评估记录。补交本地版本会覆盖它，请选择保留哪一份。`,
      });
      if (decision.resolution === 'cancel') return 'cancel';
      if (decision.resolution === 'use-server') {
        this.store.touchKnown(item.date, {
          id: detection.server.id,
          updatedAt: detection.server.updatedAt,
        });
        return 'done';
      }
      // use-local：继续提交
    }

    const saved = await this.http.recordEntry(item.input);
    ownWrites.set(item.date, saved.updatedAt);
    this.store.touchKnown(item.date, { id: saved.id, updatedAt: saved.updatedAt });
    return 'done';
  }

  private async processDeleteEntry(
    item: DeleteEntryQueueItem,
    ownWrites: Map<string, string>
  ): Promise<'done' | 'offline' | 'cancel'> {
    const detection = await this.detectServerConflict(
      item.date,
      item.baseUpdatedAt,
      item.clientAt,
      ownWrites
    );

    // 服务器上已经没有了（例如已在别处删除），删除意图天然达成
    if (!detection.server) {
      this.store.removeKnown(item.date);
      return 'done';
    }

    if (detection.conflict) {
      const decision = await this.askUser({
        item,
        kind: 'entry-delete',
        date: item.date,
        serverEntry: detection.server,
        message: `你离线期间删除了 ${item.date} 的记录，但该记录之后在服务器上又有更新。确认删除还是保留服务器版本？`,
      });
      if (decision.resolution === 'cancel') return 'cancel';
      if (decision.resolution === 'use-server') {
        this.store.touchKnown(item.date, {
          id: detection.server.id,
          updatedAt: detection.server.updatedAt,
        });
        return 'done';
      }
    }

    await this.http.deleteEntry(detection.server.id);
    ownWrites.delete(item.date);
    this.store.removeKnown(item.date);
    return 'done';
  }

  private async processAddNegentropy(
    item: AddNegentropyQueueItem
  ): Promise<'done' | 'offline' | 'cancel'> {
    // 负熵事件追加不覆盖任何数据；唯一阻塞情况是所属条目在服务器上不存在
    let entry: DailyEntry | null;
    try {
      entry = await this.http.getEntryByDate(item.date);
    } catch (err) {
      if (isRetryable(err)) throw err;
      throw err;
    }

    if (!entry) {
      const decision = await this.askUser({
        item,
        kind: 'negentropy-entry-missing',
        date: item.date,
        serverEntry: null,
        message: `负熵事件「${item.input.title}」所属的 ${item.date} 评估记录在服务器上不存在，无法补交该事件。`,
      });
      if (decision.resolution === 'cancel') return 'cancel';
      // use-server / use-local 在此都视为丢弃该事件
      return 'done';
    }

    const created: NegentropyEvent = await this.http.addNegentropy({
      ...item.input,
      entryId: entry.id,
    });
    this.store.touchKnown(item.date, {
      id: entry.id,
      updatedAt: new Date(created.createdAt).toISOString(),
    });
    return 'done';
  }

  private async processDeleteNegentropy(
    item: DeleteNegentropyQueueItem
  ): Promise<'done' | 'offline' | 'cancel'> {
    try {
      await this.http.deleteNegentropy(item.eventId);
      return 'done';
    } catch (err) {
      if (err instanceof HttpNotFoundError) {
        // 事件在服务器上已不存在，删除意图天然达成
        return 'done';
      }
      if (isRetryable(err)) throw err;
      throw err;
    }
  }
}

export const syncService = new SyncService({
  http: httpClient,
  store: syncQueueStore,
  resolver: async () => ({ resolution: 'cancel' }),
});
