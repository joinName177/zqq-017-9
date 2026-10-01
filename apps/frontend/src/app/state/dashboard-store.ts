import {
  CreateEntryInput,
  DailyEntry,
  DashboardData,
  EntropyCalculationResult,
  AttributionResult,
  ShannonEntropyCalculator,
  EntropySourceAttributor,
  NegentropyLedger,
} from '../../core/index.js';
import {
  SyncQueueItem,
  syncQueueStore,
} from '../../adapters/storage/sync-queue-adapter.js';
import { SyncConflict, ConflictDecision } from '../services/sync-service.js';

export type SyncInfoKind = 'info' | 'success' | 'error';

export interface DashboardState {
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  cachedAt: string | null;
  dashboard: DashboardData | null;
  isAssessmentModalOpen: boolean;
  isHistoryModalOpen: boolean;
  assessmentDraft: CreateEntryInput;
  previewCalculation: EntropyCalculationResult;
  previewAttribution: AttributionResult;
  previewNetEntropy: number;
  historyList: DailyEntry[];
  historyTotal: number;
  /** 服务器/缓存返回的未叠加队列的原始数据（供渲染层投影使用） */
  rawDashboard: DashboardData | null;
  rawHistory: DailyEntry[];
  /** 离线提交队列（待补交操作） */
  syncQueue: SyncQueueItem[];
  isSyncing: boolean;
  /** 需要用户裁决的补交冲突 */
  activeConflict: SyncConflict | null;
  /** 顶部同步条提示文案 */
  syncMessage: { kind: SyncInfoKind; text: string } | null;
}

type Listener = (state: DashboardState) => void;

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const initialScores = {
  physicalTension: 5,
  rumination: 5,
  lackOfControl: 5,
  timePressure: 5,
  socialAvoidance: 5,
  futureUncertainty: 5,
};

const initialCalc = ShannonEntropyCalculator.calculate(initialScores);
const initialAttr = EntropySourceAttributor.attribute(initialScores);

export class DashboardStore {
  private state: DashboardState = {
    loading: false,
    error: null,
    isOffline: false,
    cachedAt: null,
    dashboard: null,
    isAssessmentModalOpen: false,
    isHistoryModalOpen: false,
    assessmentDraft: {
      date: getTodayDateString(),
      scores: { ...initialScores },
      notes: '',
      negentropyEvent: {
        title: '腹式深呼吸 10分钟',
        category: 'breathwork',
        reductionValue: 15,
        notes: '',
      },
    },
    previewCalculation: initialCalc,
    previewAttribution: initialAttr,
    previewNetEntropy: NegentropyLedger.calculateNetEntropy(initialCalc.grossEntropy, 15),
    historyList: [],
    historyTotal: 0,
    rawDashboard: null,
    rawHistory: [],
    syncQueue: syncQueueStore.getItems(),
    isSyncing: false,
    activeConflict: null,
    syncMessage: null,
  };

  private listeners: Set<Listener> = new Set();

  private syncMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingConflictDecisionResolve: ((decision: ConflictDecision) => void) | null = null;

  public getState(): DashboardState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public setState(patch: Partial<DashboardState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  /**
   * 实时更新评估草稿中的分数，并同步使用核心服务实时重算熵值与归因
   */
  public updateDraftScore(key: keyof CreateEntryInput['scores'], value: number): void {
    const newScores = {
      ...this.state.assessmentDraft.scores,
      [key]: value,
    };

    const previewCalculation = ShannonEntropyCalculator.calculate(newScores);
    const previewAttribution = EntropySourceAttributor.attribute(newScores);
    const reduction = this.state.assessmentDraft.negentropyEvent?.reductionValue || 0;
    const previewNetEntropy = NegentropyLedger.calculateNetEntropy(
      previewCalculation.grossEntropy,
      reduction
    );

    this.setState({
      assessmentDraft: {
        ...this.state.assessmentDraft,
        scores: newScores,
      },
      previewCalculation,
      previewAttribution,
      previewNetEntropy,
    });
  }

  public updateDraftField(patch: Partial<CreateEntryInput>): void {
    const updated = {
      ...this.state.assessmentDraft,
      ...patch,
    };

    const reduction = updated.negentropyEvent?.reductionValue || 0;
    const previewNetEntropy = NegentropyLedger.calculateNetEntropy(
      this.state.previewCalculation.grossEntropy,
      reduction
    );

    this.setState({
      assessmentDraft: updated,
      previewNetEntropy,
    });
  }

  public openAssessmentModal(forDate?: string): void {
    const date = forDate || getTodayDateString();
    // If an entry exists for that date, pre-populate
    const existing = this.state.dashboard?.todayEntry?.date === date
      ? this.state.dashboard.todayEntry
      : null;

    const scores = existing ? { ...existing.scores } : { ...initialScores };
    const previewCalculation = ShannonEntropyCalculator.calculate(scores);
    const previewAttribution = EntropySourceAttributor.attribute(scores);

    this.setState({
      isAssessmentModalOpen: true,
      assessmentDraft: {
        date,
        scores,
        notes: existing?.notes || '',
        negentropyEvent: {
          title: '规律腹式呼吸',
          category: 'breathwork',
          reductionValue: 15,
          notes: '',
        },
      },
      previewCalculation,
      previewAttribution,
      previewNetEntropy: NegentropyLedger.calculateNetEntropy(previewCalculation.grossEntropy, 15),
    });
  }

  public closeAssessmentModal(): void {
    this.setState({ isAssessmentModalOpen: false });
  }

  public openHistoryModal(): void {
    this.setState({ isHistoryModalOpen: true });
  }

  public closeHistoryModal(): void {
    this.setState({ isHistoryModalOpen: false });
  }

  // ---- 离线提交队列相关 ----

  /** 从持久化层重新读取队列（入队/出队/补交通用） */
  public refreshSyncQueue(): void {
    this.setState({ syncQueue: syncQueueStore.getItems() });
  }

  public setSyncing(isSyncing: boolean): void {
    this.setState({ isSyncing });
  }

  public setConflict(activeConflict: SyncConflict | null): void {
    this.setState({ activeConflict });
  }

  public setSyncMessage(kind: SyncInfoKind, text: string, autoClearMs = 4000): void {
    this.setState({ syncMessage: { kind, text } });
    if (this.syncMessageTimer) {
      clearTimeout(this.syncMessageTimer);
    }
    if (autoClearMs > 0) {
      this.syncMessageTimer = setTimeout(() => {
        this.setState({ syncMessage: null });
      }, autoClearMs);
    }
  }

  /** 用户在冲突弹窗中作出选择（由 controller 监听并驱动补交） */
  public resolveConflict(decision: ConflictDecision): void {
    this.pendingConflictDecisionResolve?.(decision);
    this.pendingConflictDecisionResolve = null;
    this.setState({ activeConflict: null });
  }

  /** controller 通过该 Promise 等待用户的冲突裁决 */
  public awaitConflictDecision(conflict: SyncConflict): Promise<ConflictDecision> {
    this.setState({ activeConflict: conflict });
    return new Promise<ConflictDecision>((resolve) => {
      this.pendingConflictDecisionResolve = resolve;
    });
  }
}

export const dashboardStore = new DashboardStore();
