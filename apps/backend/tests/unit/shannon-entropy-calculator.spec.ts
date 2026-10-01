import { describe, it, expect } from 'vitest';
import { ShannonEntropyCalculator, DimensionScores } from '../../src/core/index.js';

describe('ShannonEntropyCalculator', () => {
  it('should return 0 grossEntropy and 0 rawEntropy when all dimensions are 0 (zero anxiety)', () => {
    const scores: DimensionScores = {
      physicalTension: 0,
      rumination: 0,
      lackOfControl: 0,
      timePressure: 0,
      socialAvoidance: 0,
      futureUncertainty: 0,
    };

    const res = ShannonEntropyCalculator.calculate(scores);
    expect(res.grossEntropy).toBe(0);
    expect(res.rawEntropy).toBe(0);
    expect(res.totalScore).toBe(0);
    expect(res.averageScore).toBe(0);
    expect(res.distributionEntropy).toBe(0);
  });

  it('should return 100 grossEntropy when all dimensions are at maximum 10 (maximum disorder)', () => {
    const scores: DimensionScores = {
      physicalTension: 10,
      rumination: 10,
      lackOfControl: 10,
      timePressure: 10,
      socialAvoidance: 10,
      futureUncertainty: 10,
    };

    const res = ShannonEntropyCalculator.calculate(scores);
    expect(res.grossEntropy).toBe(100);
    expect(res.totalScore).toBe(60);
    expect(res.averageScore).toBe(10);
    // Theoretical max entropy in bits is log2(6) ≈ 2.585
    expect(res.rawEntropy).toBeCloseTo(res.maxEntropy, 2);
  });

  it('should calculate low entropy (< 30) for very mild anxiety (all 1s)', () => {
    const scores: DimensionScores = {
      physicalTension: 1,
      rumination: 1,
      lackOfControl: 1,
      timePressure: 1,
      socialAvoidance: 1,
      futureUncertainty: 1,
    };

    const res = ShannonEntropyCalculator.calculate(scores);
    expect(res.grossEntropy).toBeLessThan(30);
    expect(res.grossEntropy).toBeGreaterThan(0);
  });

  it('should calculate high entropy (> 75) for pervasive severe anxiety (all 8s)', () => {
    const scores: DimensionScores = {
      physicalTension: 8,
      rumination: 8,
      lackOfControl: 8,
      timePressure: 8,
      socialAvoidance: 8,
      futureUncertainty: 8,
    };

    const res = ShannonEntropyCalculator.calculate(scores);
    expect(res.grossEntropy).toBeGreaterThan(75);
  });

  it('should handle single spike dimension correctly', () => {
    const scores: DimensionScores = {
      physicalTension: 9,
      rumination: 0,
      lackOfControl: 0,
      timePressure: 0,
      socialAvoidance: 0,
      futureUncertainty: 0,
    };

    const res = ShannonEntropyCalculator.calculate(scores);
    expect(res.grossEntropy).toBeGreaterThan(0);
    expect(res.grossEntropy).toBeLessThan(40);
    expect(res.totalScore).toBe(9);
  });
});
