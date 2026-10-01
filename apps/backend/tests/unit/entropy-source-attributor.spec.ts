import { describe, it, expect } from 'vitest';
import { EntropySourceAttributor, DimensionScores } from '../../src/core/index.js';

describe('EntropySourceAttributor', () => {
  it('should identify the highest scoring dimension as top contributor', () => {
    const scores: DimensionScores = {
      physicalTension: 2,
      rumination: 9, // highest
      lackOfControl: 4,
      timePressure: 3,
      socialAvoidance: 1,
      futureUncertainty: 5,
    };

    const attribution = EntropySourceAttributor.attribute(scores);
    expect(attribution.topDimension.key).toBe('rumination');
    expect(attribution.topDimension.label).toBe('思维反刍度');
    expect(attribution.topDimension.score).toBe(9);
    expect(attribution.topDimension.contributionPercentage).toBeGreaterThan(25);
  });

  it('should return equal contributions when all non-zero dimensions have identical scores', () => {
    const scores: DimensionScores = {
      physicalTension: 6,
      rumination: 6,
      lackOfControl: 6,
      timePressure: 6,
      socialAvoidance: 6,
      futureUncertainty: 6,
    };

    const attribution = EntropySourceAttributor.attribute(scores);
    for (const c of attribution.contributions) {
      expect(c.contributionPercentage).toBeCloseTo(16.7, 0);
    }
  });

  it('should handle all-zero scores gracefully without NaN or infinite values', () => {
    const scores: DimensionScores = {
      physicalTension: 0,
      rumination: 0,
      lackOfControl: 0,
      timePressure: 0,
      socialAvoidance: 0,
      futureUncertainty: 0,
    };

    const attribution = EntropySourceAttributor.attribute(scores);
    expect(attribution.contributions).toHaveLength(6);
    for (const c of attribution.contributions) {
      expect(c.contributionPercentage).toBe(0);
      expect(Number.isNaN(c.contributionPercentage)).toBe(false);
    }
  });
});
