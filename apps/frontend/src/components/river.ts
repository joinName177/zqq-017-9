import { DailyRiverPoint, DIMENSION_LABELS, DIMENSION_KEYS } from '../core/index.js';

export interface RiverProps {
  riverData: DailyRiverPoint[];
}

/**
 * 手写高阶平滑贝塞尔曲线生成算法
 */
function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    // Catmull-Rom to Cubic Bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

export function renderRiver(props: RiverProps): string {
  const { riverData } = props;

  if (!riverData || riverData.length === 0) {
    return `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        暂无河流图历史轨迹，请在上方完成每日评估以生成热力学演化河流。
      </div>
    `;
  }

  const svgWidth = 840;
  const svgHeight = 220;
  const padLeft = 50;
  const padRight = 30;
  const usableWidth = svgWidth - padLeft - padRight;
  const yMid = 110;
  const maxAmp = 85; // Max half-amplitude in pixels

  const n = riverData.length;
  const stepX = n > 1 ? usableWidth / (n - 1) : 0;

  // Compute coordinate trajectories for Gross and Net Entropy
  const grossTopPts: { x: number; y: number }[] = [];
  const grossBottomPts: { x: number; y: number }[] = [];
  const netTopPts: { x: number; y: number }[] = [];
  const netBottomPts: { x: number; y: number }[] = [];
  const nodeMarkers: {
    x: number;
    y: number;
    date: string;
    gross: number;
    net: number;
    reduction: number;
    topLabel: string;
  }[] = [];

  for (let i = 0; i < n; i++) {
    const pt = riverData[i]!;
    const x = padLeft + i * stepX;

    const gAmp = (pt.grossEntropy / 100) * maxAmp;
    const nAmp = (pt.netEntropy / 100) * maxAmp;

    grossTopPts.push({ x, y: yMid - gAmp });
    grossBottomPts.push({ x, y: yMid + gAmp });

    netTopPts.push({ x, y: yMid - nAmp });
    netBottomPts.push({ x, y: yMid + nAmp });

    // Find top dimension for tooltip
    let maxVal = -1;
    let maxKey = DIMENSION_KEYS[0]!;
    for (const k of DIMENSION_KEYS) {
      if ((pt.scores[k] ?? 0) > maxVal) {
        maxVal = pt.scores[k] ?? 0;
        maxKey = k;
      }
    }

    nodeMarkers.push({
      x,
      y: yMid - nAmp,
      date: pt.date,
      gross: pt.grossEntropy,
      net: pt.netEntropy,
      reduction: pt.totalReduction,
      topLabel: `${DIMENSION_LABELS[maxKey]} (${maxVal}分)`,
    });
  }

  // Generate Gross River Path (closed stream ribbon)
  const grossTopPath = createSmoothPath(grossTopPts);
  const grossBottomRev = createSmoothPath([...grossBottomPts].reverse());
  const grossRiverPathD = `${grossTopPath} L ${grossBottomPts[n - 1]!.x.toFixed(1)} ${grossBottomPts[n - 1]!.y.toFixed(1)} ${grossBottomRev.replace(/^M[^C]*/, '')} Z`;

  // Generate Net River Path (cooled core stream)
  const netTopPath = createSmoothPath(netTopPts);
  const netBottomRev = createSmoothPath([...netBottomPts].reverse());
  const netRiverPathD = `${netTopPath} L ${netBottomPts[n - 1]!.x.toFixed(1)} ${netBottomPts[n - 1]!.y.toFixed(1)} ${netBottomRev.replace(/^M[^C]*/, '')} Z`;

  // Date labels along X axis
  const dateLabels = riverData.map((pt, i) => {
    const x = padLeft + i * stepX;
    // Show only month-day e.g. "03-12"
    const shortDate = pt.date.slice(5);
    return `
      <text x="${x.toFixed(1)}" y="${svgHeight - 8}" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">
        ${shortDate}
      </text>
    `;
  });

  // Interactive node circles with data attributes for tooltips
  const dots = nodeMarkers.map((m) => {
    const isCooled = m.reduction > 0;
    return `
      <g class="river-node"
         data-date="${m.date}"
         data-gross="${m.gross}"
         data-net="${m.net}"
         data-reduction="${m.reduction}"
         data-top="${m.topLabel}"
         style="cursor: pointer;">
        <circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="4.5"
                fill="${isCooled ? 'var(--negentropy-color)' : 'var(--entropy-low)'}"
                stroke="#0a0d14" stroke-width="2" />
        ${isCooled ? `
          <circle cx="${m.x.toFixed(1)}" cy="${(yMid + (m.gross / 100) * maxAmp).toFixed(1)}" r="3"
                  fill="var(--negentropy-color)" opacity="0.7" />
        ` : ''}
      </g>
    `;
  });

  // High threshold (>75) & Low threshold (<30) guide dashed lines
  const yCrisis = yMid - (75 / 100) * maxAmp;
  const yClarity = yMid - (30 / 100) * maxAmp;

  return `
    <div style="position: relative; width: 100%;">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="220" style="overflow: visible;">
        <defs>
          <linearGradient id="riverThermalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.5" />
            <stop offset="50%" stop-color="#f39c12" stop-opacity="0.6" />
            <stop offset="85%" stop-color="#ff0844" stop-opacity="0.7" />
            <stop offset="100%" stop-color="#00e676" stop-opacity="0.5" />
          </linearGradient>

          <linearGradient id="riverNetGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.8" />
            <stop offset="60%" stop-color="#4facfe" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#00e676" stop-opacity="0.8" />
          </linearGradient>
        </defs>

        <!-- Threshold Guide Lines -->
        <line x1="${padLeft}" y1="${yCrisis.toFixed(1)}" x2="${svgWidth - padRight}" y2="${yCrisis.toFixed(1)}"
              stroke="rgba(255, 8, 68, 0.25)" stroke-width="1" stroke-dasharray="4,4" />
        <text x="${padLeft - 8}" y="${(yCrisis + 3).toFixed(1)}" fill="rgba(255, 8, 68, 0.6)" font-size="9" text-anchor="end" font-family="var(--font-mono)">75危象</text>

        <line x1="${padLeft}" y1="${yClarity.toFixed(1)}" x2="${svgWidth - padRight}" y2="${yClarity.toFixed(1)}"
              stroke="rgba(0, 242, 254, 0.25)" stroke-width="1" stroke-dasharray="4,4" />
        <text x="${padLeft - 8}" y="${(yClarity + 3).toFixed(1)}" fill="rgba(0, 242, 254, 0.6)" font-size="9" text-anchor="end" font-family="var(--font-mono)">30澄明</text>

        <!-- Zero Center Line -->
        <line x1="${padLeft}" y1="${yMid}" x2="${svgWidth - padRight}" y2="${yMid}"
              stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />

        <!-- Gross Entropy Thermal Outer Stream -->
        <path d="${grossRiverPathD}" fill="url(#riverThermalGradient)" />

        <!-- Net Entropy Cooled Inner Stream -->
        <path d="${netRiverPathD}" fill="url(#riverNetGradient)" />

        <!-- Top Outline Crest -->
        <path d="${netTopPath}" fill="none" stroke="#00f2fe" stroke-width="2" />

        <!-- Interactive Node Circles -->
        ${dots.join('')}

        <!-- Bottom Date Axis -->
        ${dateLabels.join('')}
      </svg>

      <!-- Floating Hover Tooltip -->
      <div id="river-tooltip" class="river-tooltip"></div>
    </div>
  `;
}
