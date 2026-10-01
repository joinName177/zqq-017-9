import { describe, it, expect } from 'vitest';
import { EntropyTrendAnalyzer } from '../../src/core/index.js';

describe('EntropyTrendAnalyzer', () => {
  it('should detect positive slope for ascending entropy data', () => {
    const data = [
      { date: '2026-03-01', netEntropy: 40 },
      { date: '2026-03-02', netEntropy: 50 },
      { date: '2026-03-03', netEntropy: 60 },
      { date: '2026-03-04', netEntropy: 70 },
      { date: '2026-03-05', netEntropy: 80 },
    ];

    const report = EntropyTrendAnalyzer.analyze(data, 5);
    expect(report.slope).toBeGreaterThan(0);
    expect(report.isIncreasing).toBe(true);
    expect(report.minEntropy).toBe(40);
    expect(report.maxEntropy).toBe(80);
    expect(report.avgEntropy).toBe(60);
    expect(report.movingAverage3).toBe(70); // (60+70+80)/3
  });

  it('should detect negative slope for recovering/decreasing entropy data', () => {
    const data = [
      { date: '2026-03-01', netEntropy: 85 },
      { date: '2026-03-02', netEntropy: 70 },
      { date: '2026-03-03', netEntropy: 55 },
      { date: '2026-03-04', netEntropy: 40 },
      { date: '2026-03-05', netEntropy: 25 },
    ];

    const report = EntropyTrendAnalyzer.analyze(data, 5);
    expect(report.slope).toBeLessThan(0);
    expect(report.isIncreasing).toBe(false);
    expect(report.slopeLabel).toContain('减熵');
  });

  it('should calculate zero volatility for constant entropy data', () => {
    const data = [
      { date: '2026-03-01', netEntropy: 50 },
      { date: '2026-03-02', netEntropy: 50 },
      { date: '2026-03-03', netEntropy: 50 },
    ];

    const report = EntropyTrendAnalyzer.analyze(data);
    expect(report.volatility).toBe(0);
    expect(report.slope).toBe(0);
  });
});
