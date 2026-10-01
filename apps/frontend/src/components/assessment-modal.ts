import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  DIMENSION_DESCRIPTIONS,
  NEGENTROPY_CATEGORIES,
  NEGENTROPY_CATEGORY_LABELS,
  CreateEntryInput,
  EntropyCalculationResult,
  AttributionResult,
} from '../core/index.js';

export interface AssessmentModalProps {
  isOpen: boolean;
  draft: CreateEntryInput;
  previewCalculation: EntropyCalculationResult;
  previewAttribution: AttributionResult;
  previewNetEntropy: number;
}

export function renderAssessmentModal(props: AssessmentModalProps): string {
  const { isOpen, draft, previewCalculation, previewAttribution, previewNetEntropy } = props;

  const reduction = draft.negentropyEvent?.reductionValue || 0;

  // Sliders for 6 dimensions
  const slidersHtml = DIMENSION_KEYS.map((key) => {
    const val = draft.scores[key] ?? 0;
    const label = DIMENSION_LABELS[key];
    const desc = DIMENSION_DESCRIPTIONS[key];
    const isTop = previewAttribution.topDimension.key === key && val > 0;

    return `
      <div class="form-group" style="margin-bottom: 1rem;">
        <div class="form-label">
          <span style="color: ${isTop ? '#ff7675' : 'var(--text-primary)'};">
            ${isTop ? '🔥 ' : ''}${label}
          </span>
          <span class="form-label-desc">${desc}</span>
        </div>
        <div class="slider-container">
          <input type="range" min="0" max="10" step="1" value="${val}"
                 class="range-slider dimension-slider"
                 data-dimension="${key}" />
          <span class="slider-val-badge">${val}</span>
        </div>
      </div>
    `;
  }).join('');

  // Category options
  const categoryOptions = NEGENTROPY_CATEGORIES.map((cat) => {
    const selected = draft.negentropyEvent?.category === cat ? 'selected' : '';
    return `<option value="${cat}" ${selected}>${NEGENTROPY_CATEGORY_LABELS[cat]}</option>`;
  }).join('');

  return `
    <div id="assessment-modal-overlay" class="modal-overlay ${isOpen ? 'open' : ''}">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <div class="modal-title">⚡ 记录每日心理熵值与负熵微习惯</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              依据香农熵公式实时量化内心微观无序状态
            </div>
          </div>
          <button id="btn-close-modal" class="modal-close">&times;</button>
        </div>

        <!-- Live Real-Time Entropy Preview Box -->
        <div style="background: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">实时推演净熵值</div>
            <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-top: 2px;">
              <span style="font-size: 2rem; font-weight: 800; font-family: var(--font-mono); color: var(--entropy-low);">
                ${previewNetEntropy}
              </span>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">
                (毛熵 ${previewCalculation.grossEntropy} - 负熵削弱 ${reduction})
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
              主要熵增诱因: <strong style="color: #ff7675;">${previewAttribution.topDimension.label}</strong>
              (${previewAttribution.topDimension.contributionPercentage}%)
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${previewNetEntropy > 75 ? 'badge-high' : previewNetEntropy < 30 ? 'badge-low' : 'badge-mid'}">
              ${previewNetEntropy > 75 ? '高熵危象阈值' : previewNetEntropy < 30 ? '低熵澄明阈值' : '稳态范围'}
            </span>
          </div>
        </div>

        <form id="assessment-form">
          <!-- Date Picker -->
          <div class="form-group">
            <label class="form-label" for="entry-date">评估日期</label>
            <input type="date" id="entry-date" class="input-text" value="${draft.date}" />
          </div>

          <!-- 6 Dimension Sliders -->
          <div style="margin-top: 1.25rem;">
            <div style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary); display: flex; justify-content: space-between;">
              <span>6 维心理能量测评 (0=完全无, 10=极度严重)</span>
              <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: normal;">总分: ${previewCalculation.totalScore} / 60</span>
            </div>
            ${slidersHtml}
          </div>

          <!-- Negentropy Event Section -->
          <div style="margin-top: 1.5rem; padding: 1.25rem; background: rgba(0, 230, 118, 0.05); border: 1px solid rgba(0, 230, 118, 0.2); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="font-size: 0.95rem; font-weight: 700; color: var(--negentropy-color);">🌱 负熵小事记账 (让自己平静下来的一件事)</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">削弱内心熵值</span>
            </div>

            <div class="quick-presets">
              <span class="preset-chip" data-title="生理性叹息深呼吸 10分钟" data-cat="breathwork" data-val="18">💨 叹息深呼吸 (-18)</span>
              <span class="preset-chip" data-title="公园森林赤足漫步 30分钟" data-cat="nature" data-val="20">🌲 森林漫步 (-20)</span>
              <span class="preset-chip" data-title="与知心朋友深度倾诉" data-cat="social_connection" data-val="22">💬 朋友倾诉 (-22)</span>
              <span class="preset-chip" data-title="沉浸式手作创作 40分钟" data-cat="creative" data-val="15">🎨 心流创作 (-15)</span>
              <span class="preset-chip" data-title="9小时无干扰深度睡眠" data-cat="rest" data-val="20">🛌 深度好眠 (-20)</span>
              <span class="preset-chip" data-title="5公里户外慢跑" data-cat="exercise" data-val="16">🏃 慢跑暴汗 (-16)</span>
            </div>

            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
              <div>
                <label class="form-label" style="font-size: 0.8rem;" for="negentropy-title">小事名称</label>
                <input type="text" id="negentropy-title" class="input-text" placeholder="例如：在阳台安静看云15分钟"
                       value="${draft.negentropyEvent?.title || ''}" />
              </div>
              <div>
                <label class="form-label" style="font-size: 0.8rem;" for="negentropy-category">类型分类</label>
                <select id="negentropy-category" class="select-input">
                  ${categoryOptions}
                </select>
              </div>
            </div>

            <div style="margin-top: 0.75rem;">
              <div class="form-label" style="font-size: 0.8rem;">
                <span>削弱熵值力量 (降熵量)</span>
                <span id="reduction-badge" style="color: var(--negentropy-color); font-weight: 700; font-family: var(--font-mono);">
                  -${reduction} 熵值
                </span>
              </div>
              <input type="range" id="negentropy-reduction" min="1" max="35" step="1"
                     value="${reduction}" class="range-slider" />
            </div>
          </div>

          <!-- Notes -->
          <div class="form-group" style="margin-top: 1.25rem;">
            <label class="form-label" for="entry-notes">觉察笔记 (可选)</label>
            <textarea id="entry-notes" class="textarea-input" rows="2" placeholder="记录今天发生的诱发事件或内在感悟...">${draft.notes || ''}</textarea>
          </div>

          <!-- Submit Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-modal" class="btn btn-secondary">取消</button>
            <button type="submit" id="btn-save-entry" class="btn btn-primary">
              💾 保存今日评估并更新熵变
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
