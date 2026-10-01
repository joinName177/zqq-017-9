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
  };

  private listeners: Set<Listener> = new Set();

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
}

export const dashboardStore = new DashboardStore();
