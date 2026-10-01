import { httpClient } from '../../adapters/api/http-client.js';
import { offlineCacheAdapter } from '../../adapters/storage/offline-cache-adapter.js';
import { dashboardStore } from '../state/dashboard-store.js';
import { CreateNegentropyEventInput } from '../../core/index.js';

export class DashboardController {
  public async loadDashboard(): Promise<void> {
    dashboardStore.setState({ loading: true, error: null });

    try {
      const data = await httpClient.getDashboard();
      offlineCacheAdapter.saveDashboardCache(data);

      dashboardStore.setState({
        dashboard: data,
        loading: false,
        isOffline: false,
        cachedAt: null,
      });
    } catch (err: unknown) {
      console.warn('[DashboardController] Online fetch failed, trying offline cache...', err);
      const { data: cached, cachedAt } = offlineCacheAdapter.getDashboardCache();

      if (cached) {
        dashboardStore.setState({
          dashboard: cached,
          loading: false,
          isOffline: true,
          cachedAt,
          error: '当前处于离线模式，显示本地缓存数据',
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
    dashboardStore.setState({ loading: true, error: null });

    try {
      await httpClient.recordEntry(assessmentDraft);
      dashboardStore.closeAssessmentModal();
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交评估失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(`保存失败: ${msg}`);
    }
  }

  public async deleteEntry(id: string): Promise<void> {
    if (!confirm('确定要删除这条心理评估记录吗？')) return;

    dashboardStore.setState({ loading: true });
    try {
      await httpClient.deleteEntry(id);
      await this.loadDashboard();
      await this.loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async addNegentropy(input: CreateNegentropyEventInput): Promise<void> {
    dashboardStore.setState({ loading: true });
    try {
      await httpClient.addNegentropy(input);
      await this.loadDashboard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '添加负熵事件失败';
      dashboardStore.setState({ loading: false, error: msg });
      alert(msg);
    }
  }

  public async deleteNegentropy(id: string): Promise<void> {
    if (!confirm('确定删除此项负熵事件吗？')) return;

    dashboardStore.setState({ loading: true });
    try {
      await httpClient.deleteNegentropy(id);
      await this.loadDashboard();
    } catch (err: unknown) {
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

  public async loadHistory(limit = 30, offset = 0): Promise<void> {
    try {
      const { items, total } = await httpClient.getHistory(limit, offset);
      dashboardStore.setState({
        historyList: items,
        historyTotal: total,
      });
    } catch (err) {
      console.warn('[DashboardController] Failed to load history list', err);
    }
  }
}

export const dashboardController = new DashboardController();
