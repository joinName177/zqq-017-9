import { DailyEntry } from '../core/index.js';

export interface HistoryModalProps {
  isOpen: boolean;
  entries: DailyEntry[];
}

export function renderHistoryModal(props: HistoryModalProps): string {
  const { isOpen, entries } = props;

  let rowsHtml = '';
  if (!entries || entries.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          暂无历史评估记录
        </td>
      </tr>
    `;
  } else {
    rowsHtml = entries.map((e) => {
      const netColor = e.netEntropy > 75 ? 'var(--entropy-high)' : e.netEntropy < 30 ? 'var(--entropy-low)' : 'var(--entropy-mid)';
      const negEventsCount = e.negentropyEvents ? e.negentropyEvents.length : 0;
      const negTitles = e.negentropyEvents ? e.negentropyEvents.map((ev) => ev.title).join('; ') : '';

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 0.75rem 0.5rem; font-family: var(--font-mono); font-weight: 600;">${e.date}</td>
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
            <button class="btn btn-danger btn-sm btn-delete-entry" data-id="${e.id}">删除</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  return `
    <div id="history-modal-overlay" class="modal-overlay ${isOpen ? 'open' : ''}">
      <div class="modal-card" style="max-width: 850px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">📖 心理熵变历史全景日志</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              查看与管理过往心理状态及负熵干预轨迹
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
