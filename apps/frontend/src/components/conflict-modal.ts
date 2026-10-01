import { DailyEntry, DIMENSION_LABELS } from '../core/index.js';
import { SyncConflict } from '../app/services/sync-service.js';

export interface ConflictModalProps {
  conflict: SyncConflict | null;
  /** 本地版本（create 冲突时由本地投影计算；delete 冲突即服务器版本） */
  localEntry: DailyEntry | null;
}

function scoreDots(entry: DailyEntry): string {
  return Object.entries(entry.scores)
    .map(([key, val]) => `<span class="conflict-score-chip">${DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]} ${val}</span>`)
    .join('');
}

function entryPanel(entry: DailyEntry | null, title: string, tone: 'local' | 'server'): string {
  if (!entry) {
    return `
      <div class="conflict-panel conflict-panel-empty">
        <div class="conflict-panel-title">${title}</div>
        <div class="conflict-panel-body">无记录（删除后为空）</div>
      </div>`;
  }
  return `
    <div class="conflict-panel conflict-panel-${tone}">
      <div class="conflict-panel-title">
        ${title}
        <span class="badge ${tone === 'local' ? 'badge-low' : 'badge-mid'}">更新于 ${entry.updatedAt.replace('T', ' ').slice(0, 16)}</span>
      </div>
      <div class="conflict-panel-body">
        <div class="conflict-metrics">
          <span>毛熵 <strong>${entry.grossEntropy}</strong></span>
          <span>净熵 <strong>${entry.netEntropy}</strong></span>
          <span>负熵削减 <strong>-${entry.totalReduction}</strong></span>
        </div>
        <div class="conflict-scores">${scoreDots(entry)}</div>
        ${entry.notes ? `<div class="conflict-notes">📝 ${entry.notes}</div>` : ''}
        ${entry.negentropyEvents.length > 0
          ? `<div class="conflict-events">🌱 ${entry.negentropyEvents.map((e) => `${e.title}(-${e.reductionValue})`).join('；')}</div>`
          : ''}
      </div>
    </div>`;
}

/**
 * 补交冲突裁决弹窗。服务器同日存在更新记录时弹出，
 * 用户必须明确选择保留本地版本还是服务器版本，系统不做静默覆盖。
 */
export function renderConflictModal(props: ConflictModalProps): string {
  const { conflict, localEntry } = props;
  if (!conflict) return '';

  let localPanel: string;
  let serverPanel: string;
  let localBtn: string;
  let showServerBtn = true;

  if (conflict.kind === 'entry-create') {
    localPanel = entryPanel(localEntry, '本地待补交版本', 'local');
    serverPanel = entryPanel(conflict.serverEntry, '服务器现有版本', 'server');
    localBtn = '💾 保留本地（覆盖服务器）';
  } else if (conflict.kind === 'entry-delete') {
    localPanel = entryPanel(null, '本地操作：删除该记录', 'local');
    serverPanel = entryPanel(conflict.serverEntry, '服务器现有版本（已更新）', 'server');
    localBtn = '🗑️ 确认删除（以本地为准）';
  } else {
    localPanel = `
      <div class="conflict-panel conflict-panel-local">
        <div class="conflict-panel-title">本地待补交的负熵事件</div>
        <div class="conflict-panel-body">
          <div class="conflict-notes">
            无法补交：所属的 ${conflict.date} 评估记录在服务器上不存在。
          </div>
        </div>
      </div>`;
    serverPanel = entryPanel(conflict.serverEntry, '服务器版本', 'server');
    localBtn = '丢弃该本地事件';
    showServerBtn = false;
  }

  return `
    <div id="conflict-modal-overlay" class="modal-overlay open">
      <div class="modal-card conflict-card">
        <div class="modal-header">
          <div>
            <div class="modal-title">⚠️ 同步冲突：${conflict.date}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; max-width: 520px;">
              ${conflict.message}
            </div>
          </div>
        </div>

        <div class="conflict-panels">
          ${localPanel}
          ${serverPanel}
        </div>

        <div class="conflict-actions">
          <button id="btn-conflict-cancel" class="btn btn-secondary">暂停同步（稍后再问我）</button>
          ${showServerBtn
            ? `<button id="btn-conflict-server" class="btn btn-secondary">☁️ 保留服务器版本（放弃本地）</button>`
            : ''}
          <button id="btn-conflict-local" class="btn btn-primary">${localBtn}</button>
        </div>
      </div>
    </div>
  `;
}
