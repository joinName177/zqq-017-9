import { HttpClientError, httpClient } from '../../adapters/api/http-client.js';
import { offlineCacheAdapter } from '../../adapters/storage/offline-cache-adapter.js';
import { SyncQueueItem } from '../../adapters/storage/sync-queue-adapter.js';
import { dashboardStore } from '../state/dashboard-store.js';
import { CreateNegentropyEventInput, DailyEntry } from '../../core/index.js';
import { syncQueueManager } from '../sync-queue-manager.js';
import { applyQueueToDashboard, applyQueueToEntries } from '../offline-projection.js';

function isOfflineError(err: unknown): boolean {
  return err instanceof HttpClientError && (err.isNetworkError || err.status === 0);
}

export class DashboardController {
  constructor() {
    syncQueueManager.subscribe((items, isSyncing) => {
      dashboardStore.setSyncQueue(items, isSyncing);
      this.applyQueueToCurrentData();
    });

    window.addEventListener('online', () => {
      void this.syncQueue();
    });
    window.addEventListener('offline', () => {
      dashboardStore.setState({ isOffline: true });
    });
  }

  private rawHistoryEntries(): DailyEntry[] {
    const state = dashboardStore.getState();
    if (state.historyList.length > 0) {
      return offlineCacheAdapter.getHistoryCache().items.length > 0
        ? offlineCacheAdapter.getHistoryCache().items
        : state.historyList;
    }
    return offlineCacheAdapter.getHistoryCache().items;
  }

  private applyQueueToCurrentData(): void {
    const state = dashboardStore.getState();
    const queue = syncQueueManager.getItems();

    if (state.dashboard) {
      dashboardStore.setState({
        dashboard: applyQueueToDashboard(state.dashboard, queue, this.rawHistoryEntries()),
      });
    }

    if (state.historyList.length > 0) {
      dashboardStore.setState({
        historyList: applyQueueToEntries(state.historyList, queue),
      });
    }
  }

  private currentEntries(): DailyEntry[] {
    const { dashboard, historyList } = dashboardStore.getState();
    if (historyList.length > 0) return historyList;

    const entries: DailyEntry[] = [];
    if (dashboard?.todayEntry) entries.push(dashboard.todayEntry);
    for (const point of dashboard?.riverData || []) {
      if (!entries.some((entry) => entry.date === point.date)) {
        entries.push({
          id: '',
          date: point.date,
          scores: point.scores,
          grossEntropy: point.grossEntropy,
          netEntropy: point.netEntropy,
          totalReduction: point.totalReduction,
          negentropyEvents: [],
          createdAt: point.date,
          updatedAt: point.date,
          version: 0,
        });
      }
    }
    return entries;
  }

  private findEntryForOperation(options: { id?: string; date?: string }): DailyEntry | null {
    const entries = this.currentEntries();
    return entries.find((entry) =>
      (options.id && (entry.id === options.id)) ||
      (options.date && entry.date === options.date)
    ) || null;
  }

  public async loadDashboard(): Promise<void> {
    dashboardStore.setState({ loading: true, error: null });

    try {
      const data = await httpClient.getDashboard();
      offlineCacheAdapter.saveDashboardCache(data);

      dashboardStore.setState({
        dashboard: applyQueueToDashboard(
          data,
          syncQueueManager.getItems(),
          offlineCacheAdapter.getHistoryCache().items
        ),
        loading: false,
        isOffline: false,
        cachedAt: null,
      });
      void this.syncQueue();
    } catch (err: unknown) {
      console.warn('[DashboardController] Online fetch failed, trying offline cache...', err);
      const { data: cached, cachedAt } = offlineCacheAdapter.getDashboardCache();

      if (cached) {
        dashboardStore.setState({
          dashboard: applyQueueToDashboard(
            cached,
            syncQueueManager.getItems(),
            offlineCacheAdapter.getHistoryCache().items
          ),
          loading: false,
          isOffline: true,
          cachedAt,
          error: syncQueueManager.getItems().length > 0
            ? '当前处于离线模式，待同步内容已保存在本机'
            : '当前处于离线模式，显示本地缓存数据',
        });
      } else {
        const msg = err instanceof Error ? err.message : '连接服务器失败';
        dashboardStore.setState({
          loading: false,
          error: msg,
        });
      }
    }
  }

  public async submitAssessment(): Promise<void> {
    const { assessmentDraft } = dashboardStore.getState();
    const existing = this.findEntryForOperation({ date: assessmentDraft.date });
    const baseVersion = existing?.id ? existing.version : null;

    dashboardStore.setState({ loading: true, error: null });

    try {
      const saved = await httpClient.recordEntry({
        ...assessmentDraft,
        baseVersion,
      });
      syncQueueManager.reconcileEntrySaved(saved);
      dashboardStore.closeAssessmentModal();
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        syncQueueManager.queueEntrySave(
          {
            ...assessmentDraft,
            baseVersion: existing && !existing.syncStatus ? existing.version : null,
          },
          assessmentDraft.date,
          existing?.id
        );
        dashboardStore.closeAssessmentModal();
        dashboardStore.setState({
          loading: false,
          isOffline: true,
          error: '已保存到本机，恢复联网后将按顺序同步',
        });
        return;
      }

      if (err instanceof HttpClientError && err.isConflict && err.serverEntry) {
        const queued = syncQueueManager.queueEntrySave(
          { ...assessmentDraft, baseVersion: err.serverEntry.version },
          assessmentDraft.date,
          err.serverEntry.id
        );
        syncQueueManager.markConflict(queued, err.serverEntry);
        dashboardStore.closeAssessmentModal();
        dashboardStore.setState({
          loading: false,
          error: '服务器上的同一天记录已更新，请在待同步列表选择保留版本',
        });
        return;
      }

      const msg = err instanceof Error ? err.message : '提交评估失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(`保存失败: ${msg}`);
    }
  }

  public async deleteEntry(id: string): Promise<void> {
    if (!confirm('确定要删除这条心理评估记录吗？')) return;

    const entry = this.findEntryForOperation({ id });
    if (!entry) return;

    dashboardStore.setState({ loading: true });
    try {
      await httpClient.deleteEntry(id, { baseVersion: entry.version });
      syncQueueManager.cancelEntryOperations(entry);
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        const existsOnServer = Boolean(entry.id) && !entry.syncStatus;
        syncQueueManager.queueEntryDelete(entry, existsOnServer);
        dashboardStore.setState({ loading: false, isOffline: true });
        return;
      }

      if (err instanceof HttpClientError && err.isConflict && err.serverEntry) {
        alert('服务器上的这条记录有更新，请在待同步列表中选择保留本地删除还是服务器版本。');
        const queued = syncQueueManager.queueEntryDelete(err.serverEntry);
        if (queued) syncQueueManager.markConflict(queued, err.serverEntry);
        return;
      }

      const msg = err instanceof Error ? err.message : '删除失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async addNegentropy(input: CreateNegentropyEventInput): Promise<void> {
    const entry = this.findEntryForOperation({ id: input.entryId });
    if (!entry) {
      alert('找不到对应评估记录，负熵事件已保存在本机待同步队列中失败');
      return;
    }

    dashboardStore.setState({ loading: true });
    try {
      await httpClient.addNegentropy({ ...input, baseVersion: entry.version });
      await this.loadDashboard();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        syncQueueManager.queueNegentropyAdd(input, entry);
        dashboardStore.setState({ loading: false, isOffline: true });
        return;
      }

      if (err instanceof HttpClientError && err.isConflict && err.serverEntry) {
        const queued = syncQueueManager.queueNegentropyAdd(
          { ...input, baseVersion: err.serverEntry.version },
          err.serverEntry
        );
        syncQueueManager.markConflict(queued, err.serverEntry);
        dashboardStore.setState({
          loading: false,
          error: '服务器上的这条记录有更新，请在待同步列表选择保留版本',
        });
        return;
      }

      const msg = err instanceof Error ? err.message : '添加负熵事件失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async deleteNegentropy(id: string): Promise<void> {
    if (!confirm('确定删除此项负熵事件吗？')) return;

    const entry = this.currentEntries().find((candidate) =>
      candidate.negentropyEvents.some((event) => event.id === id || event.clientEventId === id)
    );
    if (!entry) return;

    dashboardStore.setState({ loading: true });
    try {
      await httpClient.deleteNegentropy(id, { baseVersion: entry.version });
      await this.loadDashboard();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        syncQueueManager.queueNegentropyDelete(id, entry);
        dashboardStore.setState({ loading: false, isOffline: true });
        return;
      }
      if (err instanceof HttpClientError && err.isConflict && err.serverEntry) {
        const queued = syncQueueManager.queueNegentropyDelete(id, err.serverEntry);
        if (queued) syncQueueManager.markConflict(queued, err.serverEntry);
        dashboardStore.setState({
          loading: false,
          error: '服务器上的这条记录有更新，请在待同步列表选择保留版本',
        });
        return;
      }
      const msg = err instanceof Error ? err.message : '删除失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async seedDemoData(): Promise<void> {
    if (!confirm('是否注入 14 天完整热力学演化测试数据（演示高熵危象、负熵削弱到低熵澄明的全流程）？')) {
      return;
    }

    dashboardStore.setState({ loading: true, error: null });
    try {
      await httpClient.seedDemo();
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '注入测试数据失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async loadHistory(limit = 100, offset = 0): Promise<void> {
    try {
      const { items, total } = await httpClient.getHistory(limit, offset);
      offlineCacheAdapter.saveHistoryCache(items, total);
      dashboardStore.setState({
        historyList: applyQueueToEntries(items, syncQueueManager.getItems()),
        historyTotal: total,
      });
    } catch (err) {
      console.warn('[DashboardController] Failed to load history list, using offline cache', err);
      const cached = offlineCacheAdapter.getHistoryCache();
      if (cached.items.length > 0) {
        dashboardStore.setState({
          historyList: applyQueueToEntries(cached.items, syncQueueManager.getItems()),
          historyTotal: cached.total,
          isOffline: true,
          cachedAt: cached.cachedAt,
        });
      }
    }
  }

  public async syncQueue(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const result = await syncQueueManager.sync();
    if (result.processed > 0) {
      await this.loadDashboard();
      await this.loadHistory();
    }
  }

  public resolveQueueConflict(item: SyncQueueItem, choice: 'local' | 'server'): void {
    syncQueueManager.resolveConflict(item.id, choice);
    if (choice === 'local') {
      void this.syncQueue();
    } else {
      void this.loadDashboard();
      void this.loadHistory();
    }
  }

  public discardQueuedItem(id: string): void {
    if (confirm('放弃这条尚未同步的本地操作？放弃后无法恢复。')) {
      syncQueueManager.discardItem(id);
    }
  }
}

export const dashboardController = new DashboardController();
