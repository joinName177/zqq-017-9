import {
  DailyEntry,
  DailyRiverPoint,
  DashboardData,
  NegentropyEvent,
  ShannonEntropyCalculator,
  EntropySourceAttributor,
  NegentropyLedger,
  EntropyTrendAnalyzer,
  CrisisDetector,
} from '../../core/index.js';
import {
  SyncQueueItem,
  CreateEntryQueueItem,
} from '../../adapters/storage/sync-queue-adapter.js';

/**
 * 本地视图投影：在「服务器/缓存数据」之上叠加离线队列操作，得到用户
 * 离线时看到的仪表盘与历史列表。纯函数，不触碰网络与存储，便于单测。
 */

export type EntrySyncStatus = 'synced' | 'pending-create' | 'pending-update' | 'pending-delete';

export interface ProjectedEntry extends DailyEntry {
  syncStatus: EntrySyncStatus;
  pendingOps: SyncQueueItem[];
}

export interface ProjectedView {
  /** 叠加队列后的仪表盘数据 */
  dashboard: DashboardData;
  /** 叠加队列后的历史（按日期倒序，已剔除待删除日期） */
  history: ProjectedEntry[];
  statusByDate: Record<string, EntrySyncStatus>;
  /** 有任意待同步操作的日期 */
  pendingDates: string[];
  /** 待删除日期（界面需明确标出） */
  tombstoneDates: string[];
  pendingItems: SyncQueueItem[];
}

interface InternalState {
  map: Map<string, DailyEntry>;
  /** 存在于队列提交之前（服务器基线或本地已建）则视为更新 */
  existedBeforeQueue: Set<string>;
  dirtyDates: Set<string>;
  tombstones: Set<string>;
  pendingDates: Set<string>;
}

function recalcEntry(entry: DailyEntry): DailyEntry {
  const calc = ShannonEntropyCalculator.calculate(entry.scores);
  const totalReduction = NegentropyLedger.calculateTotalReduction(entry.negentropyEvents);
  return {
    ...entry,
    grossEntropy: calc.grossEntropy,
    totalReduction,
    netEntropy: NegentropyLedger.calculateNetEntropy(calc.grossEntropy, totalReduction),
  };
}

/** 把单条评估提交叠加到该日期条目上（语义与后端 recordDailyEntry 一致：覆盖评分/笔记、追加事件） */
function applyCreateEntry(state: InternalState, item: CreateEntryQueueItem): void {
  const prev = state.map.get(item.date);
  if (prev) state.existedBeforeQueue.add(item.date);

  const calc = ShannonEntropyCalculator.calculate(item.input.scores);
  const events: NegentropyEvent[] = prev ? [...prev.negentropyEvents] : [];

  if (item.input.negentropyEvent) {
    events.push({
      id: `local-inline-${item.id}`,
      entryId: prev?.id || `local-entry-${item.date}`,
      title: item.input.negentropyEvent.title,
      category: item.input.negentropyEvent.category as NegentropyEvent['category'],
      reductionValue: item.input.negentropyEvent.reductionValue,
      notes: item.input.negentropyEvent.notes,
      createdAt: new Date(item.clientAt).toISOString(),
    });
  }

  const totalReduction = NegentropyLedger.calculateTotalReduction(events);
  const entry: DailyEntry = {
    id: prev?.id || `local-entry-${item.date}`,
    date: item.date,
    scores: item.input.scores,
    grossEntropy: calc.grossEntropy,
    netEntropy: NegentropyLedger.calculateNetEntropy(calc.grossEntropy, totalReduction),
    totalReduction,
    notes: item.input.notes,
    negentropyEvents: events,
    createdAt: prev?.createdAt || new Date(item.clientAt).toISOString(),
    updatedAt: new Date(item.clientAt).toISOString(),
  };
  state.map.set(item.date, entry);
  state.dirtyDates.add(item.date);
  state.pendingDates.add(item.date);
  state.tombstones.delete(item.date); // 先删后建：以最新意图为准
}

/**
 * 构造投影视图。
 * @param baseDashboard 在线或缓存的仪表盘（可能为 null：首次启动即断网且无缓存）
 * @param baseHistory   在线或缓存的历史全量列表（携带完整负熵事件）
 */
export function projectView(
  baseDashboard: DashboardData | null,
  baseHistory: DailyEntry[],
  queue: SyncQueueItem[],
  todayStr: string
): ProjectedView {
  const state: InternalState = {
    map: new Map<string, DailyEntry>(),
    existedBeforeQueue: new Set<string>(),
    dirtyDates: new Set<string>(),
    tombstones: new Set<string>(),
    pendingDates: new Set<string>(),
  };

  // 基线：历史全量优先，再补入仪表盘的 todayEntry（历史缓存可能缺失当日）
  for (const e of baseHistory) {
    state.map.set(e.date, { ...e, negentropyEvents: [...(e.negentropyEvents || [])] });
  }
  if (baseDashboard?.todayEntry) {
    const t = baseDashboard.todayEntry;
    if (!state.map.has(t.date)) {
      state.map.set(t.date, { ...t, negentropyEvents: [...(t.negentropyEvents || [])] });
    }
  }

  const sortedQueue = [...queue].sort((a, b) => a.clientAt - b.clientAt);

  for (const item of sortedQueue) {
    switch (item.type) {
      case 'create-entry':
        applyCreateEntry(state, item);
        break;

      case 'delete-entry':
        state.map.delete(item.date);
        state.tombstones.add(item.date);
        state.pendingDates.add(item.date);
        break;

      case 'add-negentropy': {
        state.existedBeforeQueue.add(item.date);
        const prev = state.map.get(item.date);
        if (!prev) break; // 条目不存在的冲突在补交时处理；本地不凭空创建
        const evt: NegentropyEvent = {
          id: item.clientEventId,
          entryId: prev.id,
          title: item.input.title,
          category: item.input.category as NegentropyEvent['category'],
          reductionValue: item.input.reductionValue,
          notes: item.input.notes,
          createdAt: new Date(item.clientAt).toISOString(),
        };
        state.map.set(item.date, recalcEntry({ ...prev, negentropyEvents: [...prev.negentropyEvents, evt] }));
        state.dirtyDates.add(item.date);
        state.pendingDates.add(item.date);
        break;
      }

      case 'delete-negentropy': {
        const prev = state.map.get(item.date);
        if (!prev) break;
        const remaining = prev.negentropyEvents.filter((e) => e.id !== item.eventId);
        state.map.set(item.date, recalcEntry({ ...prev, negentropyEvents: remaining }));
        state.dirtyDates.add(item.date);
        state.pendingDates.add(item.date);
        break;
      }
    }
  }

  const asc = [...state.map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const trendItems = asc.map((e) => ({ date: e.date, netEntropy: e.netEntropy }));

  const projectedToday = state.map.get(todayStr) || asc[asc.length - 1] || null;
  const todayCalc = projectedToday
    ? ShannonEntropyCalculator.calculate(projectedToday.scores)
    : null;
  const attribution = projectedToday
    ? EntropySourceAttributor.attribute(projectedToday.scores)
    : null;

  const allEvents = asc.flatMap((e) => e.negentropyEvents);
  const leaderboard = NegentropyLedger.buildLeaderboard(allEvents);

  const riverData: DailyRiverPoint[] = asc.slice(-14).map((e) => ({
    date: e.date,
    grossEntropy: e.grossEntropy,
    netEntropy: e.netEntropy,
    totalReduction: e.totalReduction,
    scores: e.scores,
  }));

  const dashboard: DashboardData = {
    todayEntry: projectedToday,
    todayCalculation: todayCalc,
    attribution,
    crisisReport: CrisisDetector.detect(trendItems),
    trendReport: EntropyTrendAnalyzer.analyze(trendItems, 7),
    leaderboard,
    riverData,
    historyCount: asc.length,
  };

  const statusByDate: Record<string, EntrySyncStatus> = {};
  const opsByDate = new Map<string, SyncQueueItem[]>();
  for (const item of queue) {
    const list = opsByDate.get(item.date) || [];
    list.push(item);
    opsByDate.set(item.date, list);
  }
  for (const date of state.pendingDates) {
    statusByDate[date] = state.tombstones.has(date)
      ? 'pending-delete'
      : state.existedBeforeQueue.has(date)
        ? 'pending-update'
        : 'pending-create';
  }

  const history: ProjectedEntry[] = asc
    .filter((e) => !state.tombstones.has(e.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      ...e,
      syncStatus: statusByDate[e.date] || 'synced',
      pendingOps: opsByDate.get(e.date) || [],
    }));

  return {
    dashboard,
    history,
    statusByDate,
    pendingDates: [...state.pendingDates].filter((d) => !state.tombstones.has(d)),
    tombstoneDates: [...state.tombstones],
    pendingItems: sortedQueue,
  };
}
