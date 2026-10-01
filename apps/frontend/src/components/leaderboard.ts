import { NegentropyLeaderboardItem } from '../core/index.js';

export interface LeaderboardProps {
  items: NegentropyLeaderboardItem[];
}

export function renderLeaderboard(props: LeaderboardProps): string {
  const { items } = props;

  if (!items || items.length === 0) {
    return `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
        暂无负熵事件记录。在每日评估中记录一件让你平静下来的小事，解锁降熵排行。
      </div>
    `;
  }

  const listHtml = items.map((item) => {
    let rankColorClass = '';
    if (item.rank === 1) rankColorClass = 'rank-1';
    else if (item.rank === 2) rankColorClass = 'rank-2';
    else if (item.rank === 3) rankColorClass = 'rank-3';

    return `
      <div class="leaderboard-item">
        <div class="leaderboard-rank ${rankColorClass}">#${item.rank}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-title">${item.title}</div>
          <div class="leaderboard-meta">
            <span class="badge badge-negentropy" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${item.categoryLabel}</span>
            <span>频次: ${item.count} 次</span>
            <span>均次削减: -${item.averageReduction}</span>
          </div>
        </div>
        <div class="leaderboard-reduction">
          <div class="reduction-val">-${item.totalReduction}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">累计降熵</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="leaderboard-list">
      ${listHtml}
    </div>
  `;
}
