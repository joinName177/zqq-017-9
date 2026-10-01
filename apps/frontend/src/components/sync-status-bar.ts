import { SyncQueueItem } from '../adapters/storage/sync-queue-adapter.js';

export interface SyncStatusBarProps {
  isOffline: boolean;
  isSyncing: boolean;
  queue: SyncQueueItem[];
  message: { kind: 'info' | 'success' | 'error'; text: string } | null;
}

const TYPE_LABELS: Record<SyncQueueItem['type'], string> = {
  'create-entry': '评估提交',
  'delete-entry': '删除评估',
  'add-negentropy': '负熵事件',
  'delete-negentropy': '删除负熵',
};

/**
 * 离线提交队列状态条。只要有未补交操作就常驻显示，
 * 让用户明确知道哪些内容还没同步；支持手动触发补交。
 */
export function renderSyncStatusBar(props: SyncStatusBarProps): string {
  const { isOffline, isSyncing, queue, message } = props;

  if (queue.length === 0 && !message) return '';

  const counts: Record<string, number> = {};
  for (const item of queue) {
    counts[item.type] = (counts[item.type] || 0) + 1;
  }
  const summary = Object.entries(counts)
    .map(([type, n]) => `${TYPE_LABELS[type as SyncQueueItem['type']]} ${n}`)
    .join(' · ');

  const failedItems = queue.filter((i) => i.lastError);

  const toneClass = message?.kind === 'error'
    ? 'sync-bar-error'
    : message?.kind === 'success'
      ? 'sync-bar-success'
      : isOffline
        ? 'sync-bar-offline'
        : 'sync-bar-online';

  const failedHtml = failedItems.length > 0
    ? failedItems
        .map(
          (i) => `
        <div class="sync-failed-row">
          <span>⚠️ ${TYPE_LABELS[i.type]}（${i.date}）补交失败：${i.lastError}</span>
          <span style="display: inline-flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm btn-retry-queue" data-id="${i.id}">重试</button>
            <button class="btn btn-danger btn-sm btn-discard-queue" data-id="${i.id}">移除</button>
          </span>
        </div>`
        )
        .join('')
    : '';

  return `
    <div class="sync-status-bar ${toneClass}">
      <div class="sync-status-main">
        <span class="sync-status-icon">${isSyncing ? '🔄' : isOffline ? '📵' : '☁️'}</span>
        <div class="sync-status-text">
          ${message
            ? `<div class="sync-status-msg">${message.text}</div>`
            : ''}
          ${queue.length > 0
            ? `<div class="sync-status-count">
                 <span class="badge ${isOffline ? 'badge-offline' : 'badge-low'}">${queue.length} 条待同步</span>
                 <span class="sync-status-detail">${summary}</span>
               </div>`
            : ''}
        </div>
        ${!isOffline && queue.length > 0
          ? `<button id="btn-flush-queue" class="btn btn-primary btn-sm" ${isSyncing ? 'disabled' : ''}>
               ${isSyncing ? '补交中…' : '立即补交'}
             </button>`
          : ''}
      </div>
      ${failedHtml}
    </div>
  `;
}
