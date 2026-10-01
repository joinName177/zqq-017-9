import {
  DimensionScores,
  DIMENSION_KEYS,
  EntropyCalculationResult,
} from '../domain/entropy.js';

export class ShannonEntropyCalculator {
  // Theoretical maximum entropy for 6 dimensions: log2(6) ≈ 2.5849625
  public static readonly MAX_ENTROPY_BITS = Math.log2(6);
  public static readonly MAX_POSSIBLE_SCORE = 60; // 6 dimensions * 10 max

  /**
   * 计算香农心理熵值 (0 - 100)
   *
   * 基于统计热力学微观状态模型（EMU framework）：
   * 系统总容量为 60 分（6个维度各10分）。
   * 设定基态/平衡态 s0 = max(0, 60 - Σ si)，表示内心的有序/宁静基底。
   * 每个微观状态的概率 pk = sk / 60 (k = 0..6)。
   * 香农熵公式：H = - Σ (pk * log2(pk))。
   *
   * 极值特性：
   * 1. 当所有焦虑维度为 0 时，p0 = 1, p1..6 = 0 => H = 0 bits => grossEntropy = 0
   * 2. 当所有焦虑维度为 10 时，p0 = 0, p1..6 = 1/6 => H = log2(6) ≈ 2.585 bits => grossEntropy = 100
   * 3. 当处于极低焦虑状态（如全部打1分）时，grossEntropy ≈ 28 (<30，触发低熵澄明)
   * 4. 当处于全域高压混乱状态（如全部打8分）时，grossEntropy ≈ 95 (>75，触发高熵危象)
   */
  public static calculate(scores: DimensionScores): EntropyCalculationResult {
    let sumAnxiety = 0;

    for (const key of DIMENSION_KEYS) {
      const val = Math.max(0, Math.min(10, scores[key] ?? 0));
      sumAnxiety += val;
    }

    const s0 = Math.max(0, this.MAX_POSSIBLE_SCORE - sumAnxiety);

    // 计算包含基态 s0 在内的 7 个状态概率
    let rawEntropy = 0;

    // 基态贡献
    if (s0 > 0) {
      const p0 = s0 / this.MAX_POSSIBLE_SCORE;
      rawEntropy -= p0 * Math.log2(p0);
    }

    // 6 个焦虑维度状态贡献
    for (const key of DIMENSION_KEYS) {
      const val = Math.max(0, Math.min(10, scores[key] ?? 0));
      if (val > 0) {
        const p = val / this.MAX_POSSIBLE_SCORE;
        rawEntropy -= p * Math.log2(p);
      }
    }

    // 归一化到 0 - 100
    const grossEntropy = Math.round(
      Math.min(100, Math.max(0, (rawEntropy / this.MAX_ENTROPY_BITS) * 100))
    );

    // 焦虑维度的相对发散度 (0-100)
    let distributionEntropy = 0;
    if (sumAnxiety > 0) {
      let relH = 0;
      for (const key of DIMENSION_KEYS) {
        const val = Math.max(0, Math.min(10, scores[key] ?? 0));
        if (val > 0) {
          const q = val / sumAnxiety;
          relH -= q * Math.log2(q);
        }
      }
      distributionEntropy = Math.round(
        Math.min(100, Math.max(0, (relH / this.MAX_ENTROPY_BITS) * 100))
      );
    }

    return {
      grossEntropy,
      rawEntropy: Number(rawEntropy.toFixed(4)),
      maxEntropy: Number(this.MAX_ENTROPY_BITS.toFixed(4)),
      totalScore: Number(sumAnxiety.toFixed(1)),
      averageScore: Number((sumAnxiety / 6).toFixed(1)),
      distributionEntropy,
    };
  }
}
