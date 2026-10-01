import { TrendReport } from '../domain/trend.js';

export interface TrendDataPoint {
  date: string;
  netEntropy: number;
}

export class EntropyTrendAnalyzer {
  /**
   * 滚动窗口趋势分析（计算线性拟合斜率与波动率）
   * @param entries 历史数据点（应按日期升序排列）
   * @param windowSize 滚动窗口大小（默认最近 7 天）
   */
  public static analyze(entries: TrendDataPoint[], windowSize = 7): TrendReport {
    if (!entries || entries.length === 0) {
      return {
        windowSize,
        sampleCount: 0,
        slope: 0,
        slopeLabel: '暂无趋势数据',
        isIncreasing: false,
        volatility: 0,
        volatilityLabel: '平稳',
        minEntropy: 0,
        maxEntropy: 0,
        avgEntropy: 0,
        movingAverage3: null,
        movingAverage7: null,
      };
    }

    // 截取窗口内最新的 N 条数据
    const windowSlice = entries.slice(0, windowSize);
    const n = windowSlice.length;
    const yValues = windowSlice.map((d) => d.netEntropy);

    const sumY = yValues.reduce((acc, v) => acc + v, 0);
    const avgY = sumY / n;
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // 计算标准差（波动率）
    let varianceSum = 0;
    for (const y of yValues) {
      varianceSum += Math.pow(y - avgY, 2);
    }
    const volatility = n > 1 ? Math.round(Math.sqrt(varianceSum / n) * 100) / 100 : 0;

    // 线性回归斜率计算: t = 0, 1, ..., n-1
    let slope = 0;
    if (n >= 2) {
      let sumT = 0;
      let sumT2 = 0;
      let sumTY = 0;

      for (let i = 0; i < n; i++) {
        const t = i;
        const y = yValues[i]!;
        sumT += t;
        sumT2 += t * t;
        sumTY += t * y;
      }

      const denominator = n * sumT2 - sumT * sumT;
      if (denominator !== 0) {
        slope = Math.round(((n * sumTY - sumT * sumY) / denominator) * 100) / 100;
      }
    }

    // 移动平均
    const ma3 =
      entries.length >= 3
        ? Math.round((entries.slice(-3).reduce((s, e) => s + e.netEntropy, 0) / 3) * 10) / 10
        : null;

    const ma7 =
      entries.length >= 7
        ? Math.round((entries.slice(-7).reduce((s, e) => s + e.netEntropy, 0) / 7) * 10) / 10
        : null;

    // 斜率文字解析
    let slopeLabel = '稳态平衡 (动态平衡)';
    if (slope > 1.5) {
      slopeLabel = '急剧熵增 (紊乱加速)';
    } else if (slope > 0.5) {
      slopeLabel = '温和熵增 (紊乱累积)';
    } else if (slope < -1.5) {
      slopeLabel = '显著减熵 (秩序重建)';
    } else if (slope < -0.5) {
      slopeLabel = '温和减熵 (紊乱消退)';
    }

    // 波动率文字解析
    let volatilityLabel = '平稳自洽 (情绪恒定)';
    if (volatility > 15) {
      volatilityLabel = '剧烈动荡 (情绪起伏)';
    } else if (volatility > 8) {
      volatilityLabel = '中度起伏 (情绪周期)';
    }

    return {
      windowSize,
      sampleCount: n,
      slope,
      slopeLabel,
      isIncreasing: slope > 0.5,
      volatility,
      volatilityLabel,
      minEntropy: Math.round(minY),
      maxEntropy: Math.round(maxY),
      avgEntropy: Math.round(avgY * 10) / 10,
      movingAverage3: ma3,
      movingAverage7: ma7,
    };
  }
}
