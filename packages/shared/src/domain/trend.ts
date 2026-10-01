export interface TrendReport {
  windowSize: number;
  sampleCount: number;
  /**
   * 滚动线性拟合斜率 (beta)
   */
  slope: number;
  slopeLabel: string;
  isIncreasing: boolean;
  /**
   * 滚动标准差 (波动率)
   */
  volatility: number;
  volatilityLabel: string;
  minEntropy: number;
  maxEntropy: number;
  avgEntropy: number;
  movingAverage3: number | null;
  movingAverage7: number | null;
}
