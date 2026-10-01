import {
  DailyEntry,
  DashboardData,
  NegentropyEvent,
  ShannonEntropyCalculator,
  EntropySourceAttributor,
  NegentropyLedger,
  CrisisDetector,
  EntropyTrendAnalyzer,
  SyncStatus,
} from '../core/index.js';
import { SyncQueueItem } from '../adapters/storage/sync-queue-adapter.js';

function getQueueStatus(item: SyncQueueItem): SyncStatus {
  if (item.status === 'conflict') return 'conflict';
  if (item.status === 'error') return 'error';
  if (item.status === 'syncing') return 'syncing';
  return 'pending';
}

function getEventQueueStatus(item: SyncQueueItem): NonNullable<NegentropyEvent['syncStatus']> {
  const status = getQueueStatus(item);
  return status === 'pending-delete' ? 'pending' : status;
}

function withRecalculatedMetrics(entry: DailyEntry): DailyEntry {
  const calculation = ShannonEntropyCalculator.calculate(entry.scores);
  const totalReduction = NegentropyLedger.calculateTotalReduction(entry.negentropyEvents);
  return {
    ...entry,
    grossEntropy: calculation.grossEntropy,
    totalReduction,
    netEntropy: NegentropyLedger.calculateNetEntropy(calculation.grossEntropy, totalReduction),
  };
}

function findEntry(entries: DailyEntry[], item: SyncQueueItem): { index: number; entry: DailyEntry | null } {
  if (item.type === 'entry-save') {
    const index = entries.findIndex((entry) => entry.date === item.date);
    return { index, entry: index >= 0 ? entries[index]! : null };
  }

  if (item.type === 'entry-delete') {
    const index = entries.findIndex(
      (entry) => entry.id === item.entryId || entry.date === item.date
    );
    return { index, entry: index >= 0 ? entries[index]! : null };
  }

  const index = entries.findIndex((entry) => entry.id === item.entryId || entry.date === item.date);
  return { index, entry: index >= 0 ? entries[index]! : null };
}

function applyItem(entries: DailyEntry[], item: SyncQueueItem): DailyEntry[] {
  const status = getQueueStatus(item);

  if (item.type === 'entry-save') {
    const { index, entry } = findEntry(entries, item);
    const now = item.createdAt;
    const localEventId = item.payload.negentropyEvent?.clientEventId || `local-event-${item.id}`;
    const inlineEvent: NegentropyEvent | null = item.payload.negentropyEvent
      ? {
          id: localEventId,
          entryId: entry?.id || `local-entry-${item.date}`,
          title: item.payload.negentropyEvent.title,
          category: item.payload.negentropyEvent.category as NegentropyEvent['category'],
          reductionValue: item.payload.negentropyEvent.reductionValue,
          notes: item.payload.negentropyEvent.notes,
          createdAt: now,
          clientEventId: item.payload.negentropyEvent.clientEventId,
          syncStatus: getEventQueueStatus(item),
        }
      : null;

    const events = entry ? [...entry.negentropyEvents] : [];
    if (inlineEvent) {
      if (!events.some((event) => event.clientEventId === inlineEvent.clientEventId)) {
        events.push(inlineEvent);
      }
    }

    const nextEntry = withRecalculatedMetrics({
      id: entry?.id || item.entryId || `local-entry-${item.date}`,
      date: item.date,
      scores: { ...item.payload.scores },
      grossEntropy: 0,
      netEntropy: 0,
      totalReduction: 0,
      notes: item.payload.notes,
      negentropyEvents: events.map((event) => {
        if (inlineEvent && event.clientEventId === inlineEvent.clientEventId) return inlineEvent;
        return event;
      }),
      createdAt: entry?.createdAt || now,
      updatedAt: entry?.updatedAt || now,
      version: entry?.version || 1,
      syncStatus: status,
    });

    if (index >= 0) {
      const next = [...entries];
      next[index] = nextEntry;
      return next;
    }
    return [nextEntry, ...entries];
  }

  if (item.type === 'entry-delete') {
    const { entry } = findEntry(entries, item);
    if (!entry) return entries;
    return entries
      .filter((candidate) => candidate.id !== entry.id && candidate.date !== item.date)
      .concat([{ ...entry, syncStatus: 'pending-delete' }]);
  }

  const { index, entry } = findEntry(entries, item);
  if (!entry) return entries;

  let nextEntry: DailyEntry = { ...entry, syncStatus: status };

  if (item.type === 'negentropy-add') {
    const event: NegentropyEvent = {
      id: `local-event-${item.id}`,
      entryId: entry.id,
      title: item.payload.title,
      category: item.payload.category as NegentropyEvent['category'],
      reductionValue: item.payload.reductionValue,
      notes: item.payload.notes,
      createdAt: item.createdAt,
      clientEventId: item.payload.clientEventId,
      syncStatus: getEventQueueStatus(item),
    };
    const events = entry.negentropyEvents.some(
      (candidate) => candidate.clientEventId && candidate.clientEventId === event.clientEventId
    )
      ? entry.negentropyEvents.map((candidate) =>
          candidate.clientEventId === event.clientEventId ? event : candidate
        )
      : [...entry.negentropyEvents, event];
    nextEntry = withRecalculatedMetrics({ ...nextEntry, negentropyEvents: events });
  }

  if (item.type === 'negentropy-delete') {
    nextEntry = withRecalculatedMetrics({
      ...nextEntry,
      negentropyEvents: entry.negentropyEvents.filter(
        (event) => event.id !== item.eventId && event.clientEventId !== item.eventId
      ),
    });
  }

  const next = [...entries];
  next[index] = nextEntry;
  return next;
}

export function applyQueueToEntries(
  entries: DailyEntry[],
  queue: SyncQueueItem[]
): DailyEntry[] {
  let result: DailyEntry[] = entries.map((entry) => ({ ...entry, syncStatus: undefined }));
  for (const item of queue) {
    result = applyItem(result, item);
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export function applyQueueToDashboard(
  dashboard: DashboardData,
  queue: SyncQueueItem[],
  historyEntries: DailyEntry[] = []
): DashboardData {
  const historyMap = new Map(historyEntries.map((entry) => [entry.date, entry]));
  const baseEntries: DailyEntry[] = dashboard.riverData.length > 0
    ? dashboard.riverData.map((point) => {
        const fullEntry = historyMap.get(point.date);
        return {
          id: fullEntry?.id || '',
          date: point.date,
          scores: point.scores,
          grossEntropy: point.grossEntropy,
          netEntropy: point.netEntropy,
          totalReduction: point.totalReduction,
          negentropyEvents: fullEntry?.negentropyEvents.length
            ? [{
                id: `baseline-${point.date}`,
                entryId: fullEntry.id,
                title: '__BASELINE_REDUCTION__',
                category: 'other' as const,
                reductionValue: point.totalReduction,
                createdAt: point.date,
              }]
            : [],
          createdAt: point.date,
          updatedAt: fullEntry?.updatedAt || point.date,
          version: fullEntry?.version || 0,
        };
      })
    : [];

  for (const entry of historyEntries) {
    if (!baseEntries.some((candidate) => candidate.date === entry.date)) {
      baseEntries.push({ ...entry });
    }
  }

  if (dashboard.todayEntry) {
    const index = baseEntries.findIndex((entry) => entry.date === dashboard.todayEntry!.date);
    if (index >= 0) baseEntries[index] = dashboard.todayEntry;
    else baseEntries.push(dashboard.todayEntry);
  }

  const projectedEntries = applyQueueToEntries(baseEntries, queue)
    .filter((entry) => entry.syncStatus !== 'pending-delete')
    .sort((a, b) => b.date.localeCompare(a.date));

  const chronologicalEntries = [...projectedEntries].sort((a, b) => a.date.localeCompare(b.date));
  const todayString = new Date().toISOString().split('T')[0];
  const todayEntry = projectedEntries.find((entry) => entry.date === todayString)
    || projectedEntries[0]
    || null;
  const todayCalculation = todayEntry
    ? ShannonEntropyCalculator.calculate(todayEntry.scores)
    : null;
  const attribution = todayEntry
    ? EntropySourceAttributor.attribute(todayEntry.scores)
    : null;
  const trendItems = chronologicalEntries.map((entry) => ({
    date: entry.date,
    netEntropy: entry.netEntropy,
  }));

  return {
    ...dashboard,
    todayEntry,
    todayCalculation,
    attribution,
    crisisReport: CrisisDetector.detect(trendItems),
    trendReport: EntropyTrendAnalyzer.analyze(trendItems, 7),
    riverData: chronologicalEntries.slice(-14).map((entry) => ({
      date: entry.date,
      grossEntropy: entry.grossEntropy,
      netEntropy: entry.netEntropy,
      totalReduction: entry.totalReduction,
      scores: entry.scores,
    })),
    historyCount: Math.max(dashboard.historyCount, projectedEntries.length),
  };
}
