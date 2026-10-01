import { DailyEntry, ShannonEntropyCalculator, NegentropyLedger } from '../core/index.js';
import { SyncQueueItem } from '../adapters/storage/sync-queue-adapter.js';

interface SyncPanelProps {
  items: SyncQueueItem[];
  isSyncing: boolean;
}

const STATUS_LABELS: Record<SyncQueueItem['status'], string> = {
  queued: '待同步',
  syncing: '同步中',
  conflict: '版本冲突',
  error: '同步失败',
};

function describeItem(item: SyncQueueItem): string {
  if (item.type === 'entry-save') {
    return `评估 ${item.date}：毛熵已暂存${item.payload.negentropyEvent ? `，含负熵「${item.payload.negentropyEvent.title}」` : ''}`;
  }
  if (item.type === 'entry-delete') return `删除评估 ${item.date}`;
  if (item.type === 'negentropy-add') {
    return `${item.date || '记录'}：追加负熵「${item.payload.title}」(-${item.payload.reductionValue})`;
  }
  return `${item.date || '记录'}：删除一项负熵事件`;
}

function summarizeEntry(entry: DailyEntry): string {
  const eventNames = entry.negentropyEvents.map((event) => event.title).join('、') || '无负熵事件';
  return `毛熵 ${entry.grossEntropy} / 净熵 ${entry.netEntropy}；${eventNames}；备注：${entry.notes || '无'}`;
}

function summarizeLocalItem(item: SyncQueueItem): string {
  if (item.type === 'entry-delete') return '你的本地操作：删除这一天的完整评估及其负熵事件';
  if (item.type === 'negentropy-delete') return '你的本地操作：删除一项负熵事件';
  if (item.type === 'negentropy-add') {
    return `你的本地版本：追加「${item.payload.title}」(-${item.payload.reductionValue})；备注：${item.payload.notes || '无'}`;
  }

  const gross = ShannonEntropyCalculator.calculate(item.payload.scores).grossEntropy;
  const inlineReduction = item.payload.negentropyEvent?.reductionValue || 0;
  const net = NegentropyLedger.calculateNetEntropy(gross, inlineReduction);
  const eventName = item.payload.negentropyEvent?.title || '无新增负熵事件';
  return `你的本地版本：毛熵 ${gross} / 预计净熵 ${net}；${eventName}；备注：${item.payload.notes || '无'}`;
}

export function renderSyncPanel({ items, isSyncing }: SyncPanelProps): string {
  if (items.length === 0) return '';

  const conflictCount = items.filter((item) => item.status === 'conflict').length;

  return `
    <section class="card sync-panel">
      <div class="card-header">
        <div>
          <div class="card-title">
            <span>📮</span>
            <span>本地提交队列</span>
          </div>
          <div class="card-subtitle" style="margin-top: 2px;">
            ${conflictCount > 0 ? `有 ${conflictCount} 项需要选择版本，其余内容将按顺序补交` : '断网时保存在本机，联网后按顺序补交'}
          </div>
        </div>
        <div style="display:flex; gap:.5rem; align-items:center;">
          <span class="badge ${conflictCount > 0 ? 'badge-high' : 'badge-mid'}">
            ${isSyncing ? '正在同步…' : `${items.length} 项待处理`}
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-sync-now">立即同步</button>
        </div>
      </div>
      <div class="sync-queue-list">
        ${items.map((item) => `
          <div class="sync-queue-item sync-status-${item.status}">
            <div class="sync-queue-main">
              <div style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;">
                <span class="badge ${item.status === 'conflict' ? 'badge-high' : item.status === 'error' ? 'badge-high' : 'badge-mid'}">
                  ${STATUS_LABELS[item.status]}
                </span>
                <strong>${describeItem(item)}</strong>
              </div>
              ${item.lastError ? `<div class="sync-queue-error">${item.lastError}</div>` : ''}
              ${item.status === 'conflict' && item.conflict ? `
                <div class="conflict-detail">
                  <div><strong>${summarizeLocalItem(item)}</strong></div>
                  <div><strong>服务器新版本：</strong>${summarizeEntry(item.conflict.serverEntry)}</div>
                  <div class="conflict-actions">
                    <button class="btn btn-primary btn-sm btn-conflict-keep-local" data-id="${item.id}">
                      保留我的本地版本
                    </button>
                    <button class="btn btn-secondary btn-sm btn-conflict-keep-server" data-id="${item.id}">
                      使用服务器版本
                    </button>
                  </div>
                </div>
              ` : `
                <button class="btn btn-danger btn-sm btn-discard-queue" data-id="${item.id}">
                  放弃本地操作
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}
