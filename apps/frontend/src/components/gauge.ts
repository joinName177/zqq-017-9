export interface GaugeProps {
  grossEntropy: number;
  netEntropy: number;
  totalReduction: number;
  stateLabel?: string;
  level?: 'danger' | 'optimal' | 'stable';
}

export function renderGauge(props: GaugeProps): string {
  const { grossEntropy, netEntropy, totalReduction, stateLabel = '稳态平衡' } = props;

  // Clamp netEntropy to 0 - 100
  const val = Math.max(0, Math.min(100, netEntropy));

  // Center & Radius
  const cx = 160;
  const cy = 145;
  const r = 95;

  // Arc angle spans 220 degrees: from -200 deg to 20 deg (in standard math coords)
  // Let start angle = 160 deg (in radians), end angle = 380 deg
  const startAngleDeg = 150;
  const endAngleDeg = 390;
  const totalSpanDeg = endAngleDeg - startAngleDeg; // 240 deg

  // Needle angle
  const needleAngleDeg = startAngleDeg + (val / 100) * totalSpanDeg;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLen = 75;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  // Color selection
  let themeColor = 'var(--entropy-mid)';
  let glowFilter = 'url(#glowMid)';
  let badgeClass = 'badge-mid';

  if (val < 30) {
    themeColor = 'var(--entropy-low)';
    glowFilter = 'url(#glowLow)';
    badgeClass = 'badge-low';
  } else if (val > 75) {
    themeColor = 'var(--entropy-high)';
    glowFilter = 'url(#glowHigh)';
    badgeClass = 'badge-high';
  }

  // Generate tick marks (11 ticks: 0, 10, ..., 100)
  const ticks: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const angle = ((startAngleDeg + (i / 10) * totalSpanDeg) * Math.PI) / 180;
    const x1 = cx + (r - 8) * Math.cos(angle);
    const y1 = cy + (r - 8) * Math.sin(angle);
    const x2 = cx + (r + 2) * Math.cos(angle);
    const y2 = cy + (r + 2) * Math.sin(angle);

    const isMajor = i % 2 === 0;
    ticks.push(`
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
            stroke="${isMajor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}"
            stroke-width="${isMajor ? 2 : 1}" />
    `);
  }

  // Active arc path
  const startRad = (startAngleDeg * Math.PI) / 180;
  const currentRad = (needleAngleDeg * Math.PI) / 180;
  const sx = cx + r * Math.cos(startRad);
  const sy = cy + r * Math.sin(startRad);
  const ex = cx + r * Math.cos(currentRad);
  const ey = cy + r * Math.sin(currentRad);
  const largeArcFlag = (needleAngleDeg - startAngleDeg) <= 180 ? 0 : 1;

  const activeArcD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 ${largeArcFlag} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;

  // Background full arc
  const endRad = (endAngleDeg * Math.PI) / 180;
  const bx = cx + r * Math.cos(endRad);
  const by = cy + r * Math.sin(endRad);
  const bgArcD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 1 1 ${bx.toFixed(1)} ${by.toFixed(1)}`;

  return `
    <div class="gauge-container" style="display: flex; flex-direction: column; align-items: center;">
      <svg viewBox="0 0 320 200" width="100%" height="200" style="overflow: visible;">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00f2fe" />
            <stop offset="35%" stop-color="#4facfe" />
            <stop offset="65%" stop-color="#f39c12" />
            <stop offset="100%" stop-color="#ff0844" />
          </linearGradient>

          <filter id="glowLow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowHigh" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Background Track -->
        <path d="${bgArcD}" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="12" stroke-linecap="round" />

        <!-- Ticks -->
        ${ticks.join('')}

        <!-- Active Color Arc -->
        <path d="${activeArcD}" fill="none" stroke="url(#gaugeGradient)" stroke-width="12" stroke-linecap="round" />

        <!-- Pivot Center Circle -->
        <circle cx="${cx}" cy="${cy}" r="8" fill="${themeColor}" filter="${glowFilter}" />
        <circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff" />

        <!-- Needle -->
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"
              stroke="${themeColor}" stroke-width="3.5" stroke-linecap="round" filter="${glowFilter}" />

        <!-- Gauge Labels at extremities -->
        <text x="50" y="170" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">0 澄明</text>
        <text x="270" y="170" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">100 混乱</text>
      </svg>

      <!-- Numeric Entropy Readout -->
      <div style="margin-top: -15px; text-align: center;">
        <div style="font-size: 3rem; font-weight: 800; font-family: var(--font-mono); color: ${themeColor}; line-height: 1; text-shadow: 0 0 20px ${themeColor};">
          ${val}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; font-weight: 600;">
          净心理熵值 (Net Entropy)
        </div>
        <div style="margin-top: 6px;">
          <span class="badge ${badgeClass}">${stateLabel}</span>
        </div>
      </div>

      <!-- Gross vs Net Breakdown Stats -->
      <div class="gauge-stats" style="width: 100%;">
        <div class="stat-box">
          <div class="stat-label">原始毛熵</div>
          <div class="stat-value" style="color: var(--text-primary);">${grossEntropy}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">负熵削减总量</div>
          <div class="stat-value" style="color: var(--negentropy-color);">-${totalReduction}</div>
        </div>
      </div>
    </div>
  `;
}
