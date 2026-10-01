export type DimensionKey =
  | 'physicalTension'
  | 'rumination'
  | 'lackOfControl'
  | 'timePressure'
  | 'socialAvoidance'
  | 'futureUncertainty';

export const DIMENSION_KEYS: readonly DimensionKey[] = [
  'physicalTension',
  'rumination',
  'lackOfControl',
  'timePressure',
  'socialAvoidance',
  'futureUncertainty',
] as const;

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  physicalTension: '身体紧绷度',
  rumination: '思维反刍度',
  lackOfControl: '控制感缺失',
  timePressure: '时间压迫感',
  socialAvoidance: '社交回避度',
  futureUncertainty: '未来不确定感',
};

export const DIMENSION_DESCRIPTIONS: Record<DimensionKey, string> = {
  physicalTension: '躯体紧绷、肌肉酸胀或自主神经反应',
  rumination: '头脑反复盘旋负面想法、无法关闭思维跑道',
  lackOfControl: '感觉生活失控、无力感与被动应对',
  timePressure: '被截止日期或紧迫感追赶、窒息感',
  socialAvoidance: '对社交互动感到疲惫、回避外界接触',
  futureUncertainty: '对未来发展感到模糊、迷茫与不可控恐慌',
};

export type DimensionScores = Record<DimensionKey, number>;

export interface EntropyCalculationResult {
  /**
   * 归一化后的心理熵值 (0 - 100)
   */
  grossEntropy: number;
  /**
   * 原始香农熵 (bits)
   */
  rawEntropy: number;
  /**
   * 6维度最大理论香农熵 (log2(6) ≈ 2.585)
   */
  maxEntropy: number;
  /**
   * 6维度各分数之和 (0 - 60)
   */
  totalScore: number;
  /**
   * 6维度平均分 (0 - 10)
   */
  averageScore: number;
  /**
   * 相对分布离散度 (0 - 100)
   */
  distributionEntropy: number;
}

export interface DimensionContribution {
  key: DimensionKey;
  label: string;
  score: number;
  /**
   * 贡献度百分比 (0 - 100%)
   */
  contributionPercentage: number;
  /**
   * 单项熵贡献数值
   */
  contributionScore: number;
}

export interface AttributionResult {
  topDimension: DimensionContribution;
  contributions: DimensionContribution[];
}
