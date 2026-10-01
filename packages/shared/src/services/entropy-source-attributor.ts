import {
  DimensionScores,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  AttributionResult,
  DimensionContribution,
} from '../domain/entropy.js';

export class EntropySourceAttributor {
  /**
   * 计算各维度对总熵的贡献占比
   *
   * 对 6 个维度计算其微观状态熵分量 ci = - (si/60) * log2(si/60)
   * 由于各维度分数 si <= 10，状态概率 pi = si/60 <= 1/6 ≈ 0.167 < 1/e (≈ 0.368)，
   * 在 [0, 1/e] 区间内 -p*log2(p) 严格单调递增，
   * 因此打分越高的维度，对熵增的贡献占比严格越大，不存在逆序反常。
   */
  public static attribute(scores: DimensionScores): AttributionResult {
    const rawContributions: {
      key: (typeof DIMENSION_KEYS)[number];
      score: number;
      entropyShare: number;
    }[] = [];

    let totalEntropyContribution = 0;

    for (const key of DIMENSION_KEYS) {
      const score = Math.max(0, Math.min(10, scores[key] ?? 0));
      if (score > 0) {
        const p = score / 60;
        const c = -p * Math.log2(p);
        rawContributions.push({ key, score, entropyShare: c });
        totalEntropyContribution += c;
      } else {
        rawContributions.push({ key, score, entropyShare: 0 });
      }
    }

    const contributions: DimensionContribution[] = rawContributions.map((item) => {
      const percentage =
        totalEntropyContribution > 0
          ? Math.round((item.entropyShare / totalEntropyContribution) * 1000) / 10
          : 0;

      return {
        key: item.key,
        label: DIMENSION_LABELS[item.key],
        score: item.score,
        contributionPercentage: percentage,
        contributionScore: Number(item.entropyShare.toFixed(4)),
      };
    });

    // 降序排列
    contributions.sort((a, b) => {
      if (b.contributionPercentage !== a.contributionPercentage) {
        return b.contributionPercentage - a.contributionPercentage;
      }
      return b.score - a.score;
    });

    const topDimension = contributions[0] || {
      key: 'rumination',
      label: DIMENSION_LABELS['rumination'],
      score: 0,
      contributionPercentage: 0,
      contributionScore: 0,
    };

    return {
      topDimension,
      contributions,
    };
  }
}
