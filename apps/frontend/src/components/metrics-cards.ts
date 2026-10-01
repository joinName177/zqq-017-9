import { TrendReport, AttributionResult } from '../core/index.js';

export interface MetricsProps {
  trend: TrendReport;
}

export function renderMetricsCards(props: MetricsProps): string {
  const { trend } = props;

  let slopeColor = 'var(--text-primary)';
  let slopeArrow = '→';
  if (trend.slope > 0.5) {
    slopeColor = 'var(--entropy-high)';
    slopeArrow = '↗';
  } else if (trend.slope < -0.5) {
    slopeColor = 'var(--negentropy-color)';
    slopeArrow = '↘';
  }

  let volatilityColor = 'var(--text-primary)';
  if (trend.volatility > 15) {
    volatilityColor = 'var(--entropy-high)';
  } else if (trend.volatility > 8) {
    volatilityColor = 'var(--entropy-mid)';
  } else {
    volatilityColor = 'var(--entropy-low)';
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 0.9rem;">
      <div class="metric-row">
        <div>
          <div class="metric-title">滚动拟合斜率 (Slope β)</div>
          <div style="font-size: 0.75rem; color: ${slopeColor}; margin-top: 2px;">
            ${trend.slopeLabel}
          </div>
        </div>
        <div class="metric-val" style="color: ${slopeColor}; font-size: 1.25rem;">
          ${slopeArrow} ${trend.slope > 0 ? '+' : ''}${trend.slope}
        </div>
      </div>

      <div class="metric-row">
        <div>
          <div class="metric-title">情绪波动率 (Volatility σ)</div>
          <div style="font-size: 0.75rem; color: ${volatilityColor}; margin-top: 2px;">
            ${trend.volatilityLabel}
          </div>
        </div>
        <div class="metric-val" style="color: ${volatilityColor}; font-size: 1.25rem;">
          ±${trend.volatility}
        </div>
      </div>

      <div class="metric-row">
        <div>
          <div class="metric-title">3日 / 7日 移动平均</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
            近周期平滑均线
          </div>
        </div>
        <div class="metric-val">
          <span style="color: var(--entropy-low);">${trend.movingAverage3 ?? '-'}</span>
          <span style="color: var(--text-muted); font-size: 0.8rem;"> / </span>
          <span style="color: var(--text-secondary);">${trend.movingAverage7 ?? '-'}</span>
        </div>
      </div>

      <div class="metric-row">
        <div>
          <div class="metric-title">最高 / 最低净熵值</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
            历史区间极值
          </div>
        </div>
        <div class="metric-val">
          <span style="color: var(--entropy-high);">${trend.maxEntropy}</span>
          <span style="color: var(--text-muted); font-size: 0.8rem;"> ~ </span>
          <span style="color: var(--entropy-low);">${trend.minEntropy}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderAttributionList(attribution: AttributionResult | null): string {
  if (!attribution || attribution.contributions.length === 0) {
    return `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
        暂无熵源归因数据，请完成评估。
      </div>
    `;
  }

  const topKey = attribution.topDimension.key;

  const itemsHtml = attribution.contributions.map((c) => {
    const isTop = c.key === topKey;
    const barColor = isTop ? 'linear-gradient(90deg, #f39c12, #ff0844)' : 'linear-gradient(90deg, #0984e3, #00f2fe)';

    return `
      <div class="attr-item">
        <div class="attr-header">
          <span style="font-weight: ${isTop ? '700' : '500'}; color: ${isTop ? '#ff7675' : 'var(--text-primary)'};">
            ${isTop ? '🔥 ' : ''}${c.label} (${c.score}分)
          </span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: ${isTop ? '#ff7675' : 'var(--text-secondary)'};">
            ${c.contributionPercentage}%
          </span>
        </div>
        <div class="attr-bar-bg">
          <div class="attr-bar-fill" style="width: ${c.contributionPercentage}%; background: ${barColor};"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="attr-list">
      ${itemsHtml}
    </div>
  `;
}
