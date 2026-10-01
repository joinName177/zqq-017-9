import {
  NegentropyEvent,
  NegentropyLeaderboardItem,
  NEGENTROPY_CATEGORY_LABELS,
} from '../domain/negentropy.js';

export class NegentropyLedger {
  /**
   * 累加单日所有负熵事件的总削弱量
   */
  public static calculateTotalReduction(events: NegentropyEvent[]): number {
    if (!events || events.length === 0) return 0;
    const total = events.reduce((sum, e) => sum + (e.reductionValue || 0), 0);
    return Math.round(total * 10) / 10;
  }

  /**
   * 计算消除负熵后的净心理熵值 (Net Entropy)
   */
  public static calculateNetEntropy(grossEntropy: number, totalReduction: number): number {
    return Math.max(0, Math.min(100, Math.round(grossEntropy - totalReduction)));
  }

  /**
   * 生成负熵因子排行榜
   * 统计每个自愈事件的累计削弱量、频次及平均单次降熵效果
   */
  public static buildLeaderboard(events: NegentropyEvent[]): NegentropyLeaderboardItem[] {
    if (!events || events.length === 0) return [];

    const groupMap = new Map<
      string,
      {
        title: string;
        category: NegentropyEvent['category'];
        totalReduction: number;
        count: number;
      }
    >();

    for (const evt of events) {
      const key = evt.title.trim().toLowerCase();
      const existing = groupMap.get(key);
      if (existing) {
        existing.totalReduction += evt.reductionValue;
        existing.count += 1;
      } else {
        groupMap.set(key, {
          title: evt.title.trim(),
          category: evt.category,
          totalReduction: evt.reductionValue,
          count: 1,
        });
      }
    }

    const items: NegentropyLeaderboardItem[] = Array.from(groupMap.values()).map((item) => {
      const avg = item.count > 0 ? Math.round((item.totalReduction / item.count) * 10) / 10 : 0;
      return {
        rank: 0,
        title: item.title,
        category: item.category,
        categoryLabel: NEGENTROPY_CATEGORY_LABELS[item.category] || '自愈小事',
        totalReduction: Math.round(item.totalReduction * 10) / 10,
        count: item.count,
        averageReduction: avg,
      };
    });

    items.sort((a, b) => {
      if (b.totalReduction !== a.totalReduction) {
        return b.totalReduction - a.totalReduction;
      }
      return b.count - a.count;
    });

    return items.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }
}
