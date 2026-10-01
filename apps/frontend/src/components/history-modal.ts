import { DailyEntry } from '../core/index.js';
import { EntrySyncStatus } from '../app/services/local-view-projection.js';

export interface HistoryEntryView {
  entry: DailyEntry;
  syncStatus: EntrySyncStatus;
}

export interface HistoryModalProps {
  isOpen: boolean;
  entries: HistoryEntryView[];
  /** 待删除但尚未同步的日期（单独列出，防止用户以为没删掉） */
  pendingDeleteDates: string[];
}

const STATUS_BADGE: Record<EntrySyncStatus, string> = {
  synced: '',
  'pending-create': '<span class="badge badge-low" style="font-size: 0.65rem; margin-left: 0.35rem;">待同步·新建</span>',
  'pending-update': '<span class="badge badge-low" style="font-size: 0.65rem; margin-left: 0.35rem;">待同步·更新</span>',
  'pending-delete': '<span class="badge badge-high" style="font-size: 0.65rem; margin-left: 0.35rem;">待同步·删除</span>',
};

export function renderHistoryModal(props: HistoryModalProps): string {
  const { isOpen, entries, pendingDeleteDates } = props;

  let rowsHtml = '';
  if ((!entries || entries.length === 0) && pendingDeleteDates.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          暂无历史评估记录
        </td>
      </tr>
    `;
  } else {
    rowsHtml = entries.map(({ entry: e, syncStatus }) => {
      const netColor = e.netEntropy > 75 ? 'var(--entropy-high)' : e.netEntropy < 30 ? 'var(--entropy-low)' : 'var(--entropy-mid)';
      const negEventsCount = e.negentropyEvents ? e.negentropyEvents.length : 0;
      const negTitles = e.negentropyEvents ? e.negentropyEvents.map((ev) => ev.title).join('; ') : '';
      const pending = syncStatus === 'pending-create' || syncStatus === 'pending-update';
      const rowStyle = pending ? 'background: rgba(0, 242, 254, 0.05);' : '';

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle); ${rowStyle}">
          <td style="padding: 0.75rem 0.5rem; font-family: var(--font-mono); font-weight: 600;">
            ${e.date}
            ${STATUS_BADGE[syncStatus]}
          </td>
          <td style="padding: 0.75rem 0.5rem; font-family: var(--font-mono);">${e.grossEntropy}</td>
          <td style="padding: 0.75rem 0.5rem; font-family: var(--font-mono); font-weight: 700; color: ${netColor};">${e.netEntropy}</td>
          <td style="padding: 0.75rem 0.5rem; color: var(--negentropy-color); font-family: var(--font-mono);">
            -${e.totalReduction}
            ${negEventsCount > 0 ? `<div style="font-size: 0.7rem; color: var(--text-muted);">${negTitles}</div>` : ''}
          </td>
          <td style="padding: 0.75rem 0.5rem; font-size: 0.8rem; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${e.notes || '-'}
          </td>
          <td style="padding: 0.75rem 0.5rem; text-align: right;">
            <button class="btn btn-danger btn-sm btn-delete-entry" data-id="${e.id}" data-date="${e.date}">删除</button>
          </td>
        </tr>
      `;
    }).join('');

    if (pendingDeleteDates.length > 0) {
      rowsHtml += pendingDeleteDates.map((date) => `
        <tr style="border-bottom: 1px solid var(--border-subtle); opacity: 0.6;">
          <td colspan="5" style="padding: 0.75rem 0.5rem; color: var(--text-muted); text-decoration: line-through;">
            ${date}
            <span class="badge badge-high" style="font-size: 0.65rem; margin-left: 0.35rem;">待同步·删除（联网后生效）</span>
          </td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.7rem; color: var(--text-muted);">
            已排队
          </td>
        </tr>
      `).join('');
    }
  }

  return `
    <div id="history-modal-overlay" class="modal-overlay ${isOpen ? 'open' : ''}">
      <div class="modal-card" style="max-width: 850px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">📖 心理熵变历史全景日志</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              查看与管理过往心理状态及负熵干预轨迹 ·
              <span style="color: var(--entropy-low);">蓝色标记为待同步记录</span>
            </div>
          </div>
          <button id="btn-close-history" class="modal-close">&times;</button>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">
                <th style="padding: 0.5rem;">日期</th>
                <th style="padding: 0.5rem;">毛熵</th>
                <th style="padding: 0.5rem;">净熵</th>
                <th style="padding: 0.5rem;">负熵削弱</th>
                <th style="padding: 0.5rem;">觉察手记</th>
                <th style="padding: 0.5rem; text-align: right;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
