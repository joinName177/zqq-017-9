import {
  DimensionScores,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  DimensionKey,
} from '../core/index.js';

export interface RadarProps {
  scores: DimensionScores;
  topDimensionKey?: DimensionKey;
}

export function renderRadar(props: RadarProps): string {
  const { scores, topDimensionKey } = props;

  const cx = 175;
  const cy = 145;
  const maxR = 90;
  const numAxes = DIMENSION_KEYS.length; // 6

  // Calculate angles for 6 axes (starting at top: -PI/2)
  const angles = DIMENSION_KEYS.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / numAxes);

  // Concentric reference rings (levels 2, 4, 6, 8, 10)
  const ringLevels = [2, 4, 6, 8, 10];
  const gridPolygons: string[] = [];

  for (const level of ringLevels) {
    const r = (level / 10) * maxR;
    const points = angles
      .map((angle) => {
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    gridPolygons.push(`
      <polygon points="${points}" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
    `);
  }

  // Radial spokes
  const spokes: string[] = [];
  for (const angle of angles) {
    const x = cx + maxR * Math.cos(angle);
    const y = cy + maxR * Math.sin(angle);
    spokes.push(`
      <line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
            stroke="rgba(255, 255, 255, 0.12)" stroke-width="1" stroke-dasharray="2,2" />
    `);
  }

  // Data polygon points
  const dataPoints = DIMENSION_KEYS.map((key, i) => {
    const score = Math.max(0, Math.min(10, scores[key] ?? 0));
    const r = (score / 10) * maxR;
    const angle = angles[i]!;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { key, score, x, y };
  });

  const polygonPointsStr = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Vertex circles
  const vertexDots = dataPoints.map((p) => {
    const isTop = p.key === topDimensionKey;
    const color = isTop ? 'var(--entropy-high)' : 'var(--entropy-low)';
    return `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isTop ? 5 : 3.5}"
              fill="${color}" stroke="#ffffff" stroke-width="1.5" />
    `;
  });

  // Text labels around the perimeter
  const labels = DIMENSION_KEYS.map((key, i) => {
    const angle = angles[i]!;
    const labelR = maxR + 25;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);

    const isTop = key === topDimensionKey;
    const label = DIMENSION_LABELS[key];
    const score = scores[key] ?? 0;

    let anchor = 'middle';
    if (Math.cos(angle) > 0.3) anchor = 'start';
    else if (Math.cos(angle) < -0.3) anchor = 'end';

    return `
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"
            fill="${isTop ? '#ff7675' : 'var(--text-secondary)'}"
            font-size="11"
            font-weight="${isTop ? '700' : '500'}"
            text-anchor="${anchor}"
            dominant-baseline="central">
        ${label} <tspan fill="${isTop ? '#ff7675' : 'var(--entropy-low)'}" font-family="var(--font-mono)">${score}</tspan>
      </text>
    `;
  });

  return `
    <div class="radar-container" style="display: flex; flex-direction: column; align-items: center;">
      <svg viewBox="0 0 350 290" width="100%" height="260" style="overflow: visible;">
        <defs>
          <radialGradient id="radarAreaGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.4" />
            <stop offset="80%" stop-color="#0984e3" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#ff0844" stop-opacity="0.1" />
          </radialGradient>
        </defs>

        <!-- Concentric Ring Polygons -->
        ${gridPolygons.join('')}

        <!-- Radial Spokes -->
        ${spokes.join('')}

        <!-- Data Polygon Fill -->
        <polygon points="${polygonPointsStr}"
                 fill="url(#radarAreaGradient)"
                 stroke="var(--entropy-low)"
                 stroke-width="2"
                 stroke-linejoin="round" />

        <!-- Data Vertices -->
        ${vertexDots.join('')}

        <!-- Outer Axis Labels -->
        ${labels.join('')}
      </svg>
    </div>
  `;
}
