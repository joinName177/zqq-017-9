import {
  httpClient,
  isOfflineError,
} from '../../adapters/api/http-client.js';
import { offlineCacheAdapter } from '../../adapters/storage/offline-cache-adapter.js';
import { syncQueueStore } from '../../adapters/storage/sync-queue-adapter.js';
import {
  CreateNegentropyEventInput,
  CreateEntryInput,
  DailyEntry,
} from '../../core/index.js';
import { syncService } from '../services/sync-service.js';
import { projectView } from '../services/local-view-projection.js';
import { dashboardStore, getTodayDateString } from '../state/dashboard-store.js';

/**
 * 仪表盘控制器：所有写操作遵循同一条路径——
 * 在线则直接请求服务器；断网（或服务器不可达）则写入本地提交队列，
 * 并立即刷新本地投影视图，用户在断网时也能看到刚记录的内容。
 */
export class DashboardController {
  private baseDashboard: Awaited<ReturnType<typeof httpClient.getDashboard>> | null = null;
  private baseHistory: DailyEntry[] = [];

  /** 应用本地提交队列后的视图（驱动渲染） */
  private getProjectedView() {
    return projectView(this.baseDashboard, this.baseHistory, syncQueueStore.getItems(), getTodayDateString());
  }

  /** 用投影视图刷新 store（不触碰网络） */
  private applyProjection(): void {
    const view = this.getProjectedView();
    dashboardStore.setState({
      rawDashboard: this.baseDashboard,
      rawHistory: this.baseHistory,
      dashboard: view.dashboard,
      historyList: view.history,
      historyTotal: view.history.length,
      syncQueue: view.pendingItems,
    });
  }

  public async loadDashboard(options: { autoFlush?: boolean } = {}): Promise<void> {
    const { autoFlush = true } = options;
    dashboardStore.setState({ loading: true, error: null });

    try {
      const data = await httpClient.getDashboard();
      offlineCacheAdapter.saveDashboardCache(data);
      this.baseDashboard = data;
      syncQueueStore.hydrateKnown(
        [data.todayEntry].filter((e): e is DailyEntry => !!e)
      );

      // 在线加载成功：刷新基线并尝试补交离线队列
      dashboardStore.setState({
        loading: false,
        isOffline: false,
        cachedAt: null,
      });
      this.applyProjection();
      if (autoFlush) void this.flushQueue();
    } catch (err: unknown) {
      console.warn('[DashboardController] Online fetch failed, trying offline cache...', err);
      const { data: cached, cachedAt } = offlineCacheAdapter.getDashboardCache();
      const { items: cachedHistory } = offlineCacheAdapter.getHistoryCache();
      this.baseDashboard = cached;
      this.baseHistory = cachedHistory;

      if (cached || syncQueueStore.count() > 0) {
        this.applyProjection();
        dashboardStore.setState({
          loading: false,
          isOffline: true,
          cachedAt,
          error: syncQueueStore.count() > 0
            ? '当前处于离线模式，显示本地数据，有记录等待联网后补交'
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

    try {
      dashboardStore.setState({ loading: true, error: null });
      const saved = await httpClient.recordEntry(assessmentDraft);
      syncQueueStore.touchKnown(saved.date, { id: saved.id, updatedAt: saved.updatedAt });
      dashboardStore.closeAssessmentModal();
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        this.enqueueAssessment(assessmentDraft);
        dashboardStore.setState({ loading: false });
        dashboardStore.closeAssessmentModal();
        return;
      }
      const msg = err instanceof Error ? err.message : '提交评估失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(`保存失败: ${msg}`);
    }
  }

  /** 断网时把评估提交存入本地队列，并立刻在本地视图中呈现 */
  private enqueueAssessment(draft: CreateEntryInput): void {
    const known = syncQueueStore.getKnown(draft.date);
    syncQueueStore.enqueueCreateEntry(draft, known?.updatedAt || null);
    dashboardStore.refreshSyncQueue();
    this.applyProjection();
    dashboardStore.setSyncMessage(
      'info',
      `当前离线，已将 ${draft.date} 的评估存入本机（第 ${syncQueueStore.count()} 条待同步），联网后自动补交`
    );
  }

  public async deleteEntry(id: string, date: string): Promise<void> {
    if (!confirm('确定要删除这条心理评估记录吗？')) return;

    try {
      dashboardStore.setState({ loading: true });
      await httpClient.deleteEntry(id);
      syncQueueStore.removeKnown(date);
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        const known = syncQueueStore.getKnown(date);
        syncQueueStore.enqueueDeleteEntry(date, id, known?.updatedAt ?? null);
        dashboardStore.refreshSyncQueue();
        this.applyProjection();
        dashboardStore.setState({ loading: false });
        dashboardStore.setSyncMessage(
          'info',
          `当前离线，删除 ${date} 记录的操作已排队，联网后同步，不会被旧数据同步回来`
        );
        return;
      }
      const msg = err instanceof Error ? err.message : '删除失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async addNegentropy(input: CreateNegentropyEventInput): Promise<void> {
    const date = this.resolveDateForEntryId(input.entryId);

    try {
      dashboardStore.setState({ loading: true });
      await httpClient.addNegentropy(input);
      await this.loadDashboard();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        syncQueueStore.enqueueAddNegentropy(date, input.entryId, input);
        dashboardStore.refreshSyncQueue();
        this.applyProjection();
        dashboardStore.setState({ loading: false });
        dashboardStore.setSyncMessage('info', '当前离线，负熵事件已存入本机，联网后自动补交');
        return;
      }
      const msg = err instanceof Error ? err.message : '添加负熵事件失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async deleteNegentropy(id: string, entryIdHint: string, date?: string): Promise<void> {
    if (!confirm('确定删除此项负熵事件吗？')) return;

    const resolvedDate = date || this.resolveDateForEntryId(entryIdHint);

    try {
      dashboardStore.setState({ loading: true });
      await httpClient.deleteNegentropy(id);
      await this.loadDashboard();
    } catch (err: unknown) {
      if (isOfflineError(err)) {
        syncQueueStore.enqueueDeleteNegentropy(resolvedDate, id, entryIdHint);
        dashboardStore.refreshSyncQueue();
        this.applyProjection();
        dashboardStore.setState({ loading: false });
        dashboardStore.setSyncMessage('info', '当前离线，删除负熵事件的操作已排队，联网后同步');
        return;
      }
      const msg = err instanceof Error ? err.message : '删除失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  /** 通过 entryId 在当前基线中找到所属日期（离线负熵队列需要日期定位） */
  private resolveDateForEntryId(entryId: string): string {
    const fromHistory = this.baseHistory.find((e) => e.id === entryId);
    if (fromHistory) return fromHistory.date;
    if (this.baseDashboard?.todayEntry?.id === entryId) {
      return this.baseDashboard.todayEntry.date;
    }
    // 本地待同步条目 id 形如 local-entry-YYYY-MM-DD
    const match = /^local-entry-(\d{4}-\d{2}-\d{2})$/.exec(entryId);
    if (match) return match[1]!;
    return getTodayDateString();
  }

  /** 手动放弃某条无法补交的队列项（4xx 永久失败或用户主动取消） */
  public discardQueuedItem(id: string): void {
    syncQueueStore.removeItem(id);
    dashboardStore.refreshSyncQueue();
    this.applyProjection();
  }

  /** 清除某条队列项的失败标记并重新发起补交 */
  public retryQueuedItem(id: string): void {
    syncQueueStore.updateItem(id, { lastError: null });
    dashboardStore.refreshSyncQueue();
    void this.flushQueue();
  }

  /**
   * 联网后补交队列。冲突时同步引擎会回调 resolver，
   * 这里把冲突推给 store 并等待用户在界面上选择保留哪一份。
   */
  public async flushQueue(): Promise<void> {
    if (syncService.isFlushing() || syncQueueStore.count() === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    dashboardStore.setSyncing(true);
    dashboardStore.setSyncMessage('info', `正在补交 ${syncQueueStore.count()} 条离线记录…`, 0);

    const result = await syncService.flush();

    dashboardStore.refreshSyncQueue();
    dashboardStore.setSyncing(false);

    if (result.offline) {
      dashboardStore.setSyncMessage(
        'info',
        `网络仍不可用，${result.remaining} 条记录保留在本机，稍后自动补交`
      );
    } else if (result.cancelled) {
      dashboardStore.setSyncMessage('info', `补交已暂停，还有 ${result.remaining} 条待处理`);
    } else if (result.failed.length > 0) {
      dashboardStore.setSyncMessage(
        'error',
        `${result.failed.length} 条记录被服务器拒绝，已从队列移除，请检查后重新记录`
      );
    } else if (result.synced > 0 && result.remaining === 0) {
      dashboardStore.setSyncMessage('success', `✅ ${result.synced} 条离线记录已全部补交成功`);
    } else if (result.remaining > 0) {
      dashboardStore.setSyncMessage('info', `${result.remaining} 条记录仍待补交`);
    } else {
      dashboardStore.setState({ syncMessage: null });
    }

    // 补交后重新拉取服务器最新数据（关闭 autoFlush，避免加载成功回调再次进入补交）
    await this.loadDashboard({ autoFlush: false });
    await this.loadHistory();
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

  public async loadHistory(limit = 30, offset = 0): Promise<void> {
    try {
      const { items, total } = await httpClient.getHistory(limit, offset);
      offlineCacheAdapter.saveHistoryCache(items);
      this.baseHistory = items;
      syncQueueStore.hydrateKnown(items);
      this.applyProjection();
      dashboardStore.setState({ historyTotal: total });
    } catch (err) {
      console.warn('[DashboardController] Failed to load history list, using cache + queue projection', err);
      const { items: cachedHistory } = offlineCacheAdapter.getHistoryCache();
      this.baseHistory = cachedHistory;
      this.applyProjection();
    }
  }
}

export const dashboardController = new DashboardController();
