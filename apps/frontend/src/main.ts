import { dashboardStore, DashboardState } from './app/state/dashboard-store.js';
import { dashboardController } from './app/controllers/dashboard-controller.js';
import { renderGauge } from './components/gauge.js';
import { renderRadar } from './components/radar.js';
import { renderRiver } from './components/river.js';
import { renderCrisisBanner } from './components/crisis-banner.js';
import { renderLeaderboard } from './components/leaderboard.js';
import { renderMetricsCards, renderAttributionList } from './components/metrics-cards.js';
import { renderAssessmentModal } from './components/assessment-modal.js';
import { renderHistoryModal } from './components/history-modal.js';
import { DimensionKey } from './core/index.js';

function renderApp(state: DashboardState): void {
  const app = document.getElementById('app');
  if (!app) return;

  const { dashboard, loading, error, isOffline, cachedAt } = state;

  // Header HTML
  const headerHtml = `
    <header class="header">
      <div class="brand">
        <svg class="brand-icon" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="45" stroke="var(--entropy-low)" stroke-width="3" opacity="0.4" />
          <circle cx="50" cy="50" r="30" stroke="var(--entropy-mid)" stroke-width="2" stroke-dasharray="6,4" />
          <path d="M 50 15 Q 65 40 50 85 Q 35 40 50 15 Z" fill="url(#brandGrad)" />
          <defs>
            <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00f2fe" />
              <stop offset="50%" stop-color="#f39c12" />
              <stop offset="100%" stop-color="#ff0844" />
            </linearGradient>
          </defs>
        </svg>
        <div>
          <div class="brand-title">焦虑熵值仪</div>
          <div class="brand-subtitle">Anxiety Entropy Meter · EMU Thermodynamic Model</div>
        </div>
      </div>

      <div class="header-actions">
        ${isOffline ? `<span class="badge badge-offline">⚠️ 离线缓存 (${cachedAt ? cachedAt.slice(11, 16) : ''})</span>` : ''}
        ${loading ? `<span style="font-size: 0.8rem; color: var(--text-muted);">同步中...</span>` : ''}
        <button id="btn-seed-data" class="btn btn-secondary btn-sm" title="注入14天完整演化演示数据">
          ✨ 演示数据
        </button>
        <button id="btn-open-history" class="btn btn-secondary btn-sm">
          📖 历史全景
        </button>
        <button id="btn-open-assessment" class="btn btn-primary btn-sm">
          ⚡ 今日评估
        </button>
      </div>
    </header>
  `;

  // Fallback if no dashboard data yet
  if (!dashboard) {
    app.innerHTML = `
      <div class="app-container">
        ${headerHtml}
        <main class="main-content" style="text-align: center; padding-top: 5rem;">
          ${loading ? '<div style="font-size: 1.25rem; color: var(--entropy-low);">正在加载热力学仪表盘...</div>' : ''}
          ${error ? `<div style="color: var(--entropy-high); margin-bottom: 1rem;">${error}</div><button id="btn-retry" class="btn btn-primary">重试连接</button>` : ''}
        </main>
      </div>
    `;
    document.getElementById('btn-retry')?.addEventListener('click', () => dashboardController.loadDashboard());
    document.getElementById('btn-seed-data')?.addEventListener('click', () => dashboardController.seedDemoData());
    return;
  }

  const { todayEntry, todayCalculation, attribution, crisisReport, trendReport, leaderboard, riverData } = dashboard;

  // Crisis Banner HTML
  const crisisHtml = renderCrisisBanner({ report: crisisReport });

  // Gauge HTML
  const gaugeHtml = renderGauge({
    grossEntropy: todayEntry ? todayEntry.grossEntropy : 0,
    netEntropy: todayEntry ? todayEntry.netEntropy : 0,
    totalReduction: todayEntry ? todayEntry.totalReduction : 0,
    stateLabel: crisisReport.stateLabel,
    level: crisisReport.level,
  });

  // Radar HTML
  const radarHtml = renderRadar({
    scores: todayEntry ? todayEntry.scores : {
      physicalTension: 0,
      rumination: 0,
      lackOfControl: 0,
      timePressure: 0,
      socialAvoidance: 0,
      futureUncertainty: 0,
    },
    topDimensionKey: attribution?.topDimension.key,
  });

  // River HTML
  const riverHtml = renderRiver({ riverData });

  // Leaderboard HTML
  const leaderboardHtml = renderLeaderboard({ items: leaderboard });

  // Metrics HTML
  const metricsHtml = renderMetricsCards({ trend: trendReport });

  // Attribution List HTML
  const attrListHtml = renderAttributionList(attribution);

  // Modals HTML
  const assessmentModalHtml = renderAssessmentModal({
    isOpen: state.isAssessmentModalOpen,
    draft: state.assessmentDraft,
    previewCalculation: state.previewCalculation,
    previewAttribution: state.previewAttribution,
    previewNetEntropy: state.previewNetEntropy,
  });

  const historyModalHtml = renderHistoryModal({
    isOpen: state.isHistoryModalOpen,
    entries: state.historyList,
  });

  // Complete Assembly
  app.innerHTML = `
    <div class="app-container">
      ${headerHtml}

      <main class="main-content">
        <!-- Crisis Alert Banner -->
        ${crisisHtml}

        <!-- Top Section: Gauge | Radar | Metrics -->
        <div class="dashboard-grid-top">
          <!-- Card 1: Gauge -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>🌡️</span>
                <span>热力学熵值表盘</span>
              </div>
              <span class="badge ${todayEntry && todayEntry.netEntropy > 75 ? 'badge-high' : todayEntry && todayEntry.netEntropy < 30 ? 'badge-low' : 'badge-mid'}">
                ${todayEntry ? todayEntry.date : '未记录'}
              </span>
            </div>
            ${gaugeHtml}
          </div>

          <!-- Card 2: 6-Dimension Radar -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>🕸️</span>
                <span>6维心理能量雷达</span>
              </div>
              ${attribution ? `
                <span class="badge badge-high" style="font-size: 0.7rem;">
                  首要诱因: ${attribution.topDimension.label}
                </span>
              ` : ''}
            </div>
            ${radarHtml}
          </div>

          <!-- Card 3: Trend & Volatility -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>📊</span>
                <span>动力学趋势与波动</span>
              </div>
              <span class="card-subtitle">滚动窗口 ${trendReport.sampleCount}d</span>
            </div>
            ${metricsHtml}
          </div>
        </div>

        <!-- Middle Section: Streamgraph River Chart (Full Width) -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <span>🌊</span>
                <span>熵变河流图 (Entropy Streamgraph)</span>
              </div>
              <div class="card-subtitle" style="margin-top: 2px;">
                手写贝塞尔流线 · 外层毛熵流动与内层负熵冷却涟漪
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="badge badge-high" style="font-size: 0.65rem;">红/琥珀: 紊乱波峰</span>
              <span class="badge badge-negentropy" style="font-size: 0.65rem;">翠绿: 负熵冷却</span>
            </div>
          </div>
          ${riverHtml}
        </div>

        <!-- Bottom Section: Leaderboard & Attribution Breakdown -->
        <div class="dashboard-grid-bottom">
          <!-- Negentropy Factor Leaderboard -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">
                  <span>🏆</span>
                  <span>负熵因子排行榜 (自愈效能)</span>
                </div>
                <div class="card-subtitle" style="margin-top: 2px;">
                  对心理熵削弱作用最显著的自愈微习惯
                </div>
              </div>
              <span class="badge badge-negentropy">${leaderboard.length} 种因子</span>
            </div>
            ${leaderboardHtml}
          </div>

          <!-- Attribution Breakdown -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">
                  <span>🔍</span>
                  <span>各维度熵源贡献占比</span>
                </div>
                <div class="card-subtitle" style="margin-top: 2px;">
                  微观状态熵 ci = -p·log₂p 边际占比
                </div>
              </div>
              <span class="card-subtitle">
                总容量 60分 / 基底有序度 ${60 - (todayCalculation?.totalScore || 0)}
              </span>
            </div>
            ${attrListHtml}
          </div>
        </div>
      </main>

      <!-- Modals -->
      ${assessmentModalHtml}
      ${historyModalHtml}
    </div>
  `;

  attachEventHandlers();
}

function attachEventHandlers(): void {
  // Open Assessment Modal
  document.getElementById('btn-open-assessment')?.addEventListener('click', () => {
    dashboardStore.openAssessmentModal();
  });

  // Banner action button
  document.getElementById('btn-banner-action')?.addEventListener('click', () => {
    dashboardStore.openAssessmentModal();
  });

  // Close Assessment Modal
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    dashboardStore.closeAssessmentModal();
  });
  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    dashboardStore.closeAssessmentModal();
  });

  // Open & Close History Modal
  document.getElementById('btn-open-history')?.addEventListener('click', async () => {
    await dashboardController.loadHistory();
    dashboardStore.openHistoryModal();
  });
  document.getElementById('btn-close-history')?.addEventListener('click', () => {
    dashboardStore.closeHistoryModal();
  });

  // Seed Demo Data
  document.getElementById('btn-seed-data')?.addEventListener('click', () => {
    dashboardController.seedDemoData();
  });

  // Dimension Sliders Real-Time Input
  const sliders = document.querySelectorAll<HTMLInputElement>('.dimension-slider');
  sliders.forEach((slider) => {
    slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const dim = target.getAttribute('data-dimension') as DimensionKey;
      const val = parseInt(target.value, 10);
      dashboardStore.updateDraftScore(dim, val);
    });
  });

  // Negentropy Reduction Slider
  const redSlider = document.getElementById('negentropy-reduction') as HTMLInputElement | null;
  redSlider?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    const existing = dashboardStore.getState().assessmentDraft.negentropyEvent;
    dashboardStore.updateDraftField({
      negentropyEvent: {
        title: existing?.title || '',
        category: existing?.category || 'breathwork',
        reductionValue: val,
        notes: existing?.notes,
      },
    });
  });

  // Negentropy Title & Category
  const negTitle = document.getElementById('negentropy-title') as HTMLInputElement | null;
  negTitle?.addEventListener('input', (e) => {
    const title = (e.target as HTMLInputElement).value;
    const existing = dashboardStore.getState().assessmentDraft.negentropyEvent;
    dashboardStore.updateDraftField({
      negentropyEvent: {
        title,
        category: existing?.category || 'breathwork',
        reductionValue: existing?.reductionValue || 15,
        notes: existing?.notes,
      },
    });
  });

  const negCat = document.getElementById('negentropy-category') as HTMLSelectElement | null;
  negCat?.addEventListener('change', (e) => {
    const category = (e.target as HTMLSelectElement).value as any;
    const existing = dashboardStore.getState().assessmentDraft.negentropyEvent;
    dashboardStore.updateDraftField({
      negentropyEvent: {
        title: existing?.title || '',
        category,
        reductionValue: existing?.reductionValue || 15,
        notes: existing?.notes,
      },
    });
  });

  // Quick preset chips
  const chips = document.querySelectorAll<HTMLElement>('.preset-chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const title = chip.getAttribute('data-title') || '';
      const category = (chip.getAttribute('data-cat') || 'breathwork') as any;
      const val = parseInt(chip.getAttribute('data-val') || '15', 10);

      dashboardStore.updateDraftField({
        negentropyEvent: {
          title,
          category,
          reductionValue: val,
        },
      });
    });
  });

  // Date & Notes Input
  const dateInput = document.getElementById('entry-date') as HTMLInputElement | null;
  dateInput?.addEventListener('change', (e) => {
    dashboardStore.updateDraftField({ date: (e.target as HTMLInputElement).value });
  });

  const notesInput = document.getElementById('entry-notes') as HTMLTextAreaElement | null;
  notesInput?.addEventListener('input', (e) => {
    dashboardStore.updateDraftField({ notes: (e.target as HTMLTextAreaElement).value });
  });

  // Assessment Form Submit
  const form = document.getElementById('assessment-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    dashboardController.submitAssessment();
  });

  // Delete history entry buttons
  const deleteBtns = document.querySelectorAll<HTMLButtonElement>('.btn-delete-entry');
  deleteBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        dashboardController.deleteEntry(id);
      }
    });
  });

  // River Chart Tooltip Hover Handlers
  const nodes = document.querySelectorAll<SVGGElement>('.river-node');
  const tooltip = document.getElementById('river-tooltip');

  nodes.forEach((node) => {
    node.addEventListener('mouseenter', (e) => {
      if (!tooltip) return;
      const date = node.getAttribute('data-date');
      const gross = node.getAttribute('data-gross');
      const net = node.getAttribute('data-net');
      const red = node.getAttribute('data-reduction');
      const top = node.getAttribute('data-top');

      tooltip.innerHTML = `
        <div style="font-weight: 700; color: #fff; margin-bottom: 2px;">${date}</div>
        <div>净熵: <strong style="color: var(--entropy-low);">${net}</strong> (毛熵 ${gross})</div>
        <div style="color: var(--negentropy-color);">负熵削减: -${red}</div>
        <div style="color: var(--text-secondary); font-size: 0.7rem; margin-top: 2px;">首要诱因: ${top}</div>
      `;

      const rect = (e.currentTarget as Element).getBoundingClientRect();
      const parentRect = tooltip.parentElement?.getBoundingClientRect();

      if (parentRect) {
        tooltip.style.left = `${rect.left - parentRect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - parentRect.top - 10}px`;
        tooltip.style.display = 'block';
      }
    });

    node.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
    });
  });
}

// Subscribe to store and render on state change
dashboardStore.subscribe((state) => {
  renderApp(state);
});

// Initial boot
dashboardController.loadDashboard();
