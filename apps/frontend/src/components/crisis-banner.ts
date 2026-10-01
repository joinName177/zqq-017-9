import { CrisisReport } from '../core/index.js';

export interface CrisisBannerProps {
  report: CrisisReport;
}

export function renderCrisisBanner(props: CrisisBannerProps): string {
  const { report } = props;

  let bannerClass = 'crisis-banner-stable';
  let icon = '⚖️';
  let titleColor = 'var(--text-primary)';

  if (report.state === 'HIGH_ENTROPY_CRISIS') {
    bannerClass = 'crisis-banner-danger';
    icon = '🚨';
    titleColor = 'var(--entropy-high)';
  } else if (report.state === 'LOW_ENTROPY_CLARITY') {
    bannerClass = 'crisis-banner-optimal';
    icon = '✨';
    titleColor = 'var(--entropy-low)';
  }

  const recPills = report.recommendations
    .slice(0, 3)
    .map((rec) => `<span class="crisis-pill">• ${rec}</span>`)
    .join('');

  return `
    <div class="crisis-banner ${bannerClass}">
      <div class="crisis-content">
        <div class="crisis-icon">${icon}</div>
        <div>
          <div class="crisis-title" style="color: ${titleColor};">
            ${report.stateLabel} ${report.consecutiveDays > 0 ? `(连续 ${report.consecutiveDays} 天)` : ''}
          </div>
          <div class="crisis-desc">${report.message}</div>
          <div class="crisis-recs">
            ${recPills}
          </div>
        </div>
      </div>
      <div>
        <button id="btn-banner-action" class="btn ${report.state === 'HIGH_ENTROPY_CRISIS' ? 'btn-danger' : 'btn-secondary'} btn-sm">
          ${report.state === 'HIGH_ENTROPY_CRISIS' ? '🔥 紧急录入负熵' : '📝 记录今日状态'}
        </button>
      </div>
    </div>
  `;
}
