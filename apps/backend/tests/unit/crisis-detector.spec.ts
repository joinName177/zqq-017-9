import { describe, it, expect } from 'vitest';
import { CrisisDetector } from '../../src/core/index.js';

describe('CrisisDetector', () => {
  it('should trigger HIGH_ENTROPY_CRISIS when entropy > 75 for 3 consecutive days', () => {
    const history = [
      { date: '2026-03-01', netEntropy: 60 },
      { date: '2026-03-02', netEntropy: 80 },
      { date: '2026-03-03', netEntropy: 85 },
      { date: '2026-03-04', netEntropy: 82 },
    ];

    const report = CrisisDetector.detect(history);
    expect(report.state).toBe('HIGH_ENTROPY_CRISIS');
    expect(report.level).toBe('danger');
    expect(report.stateLabel).toBe('高熵危象');
    expect(report.consecutiveDays).toBe(3);
    expect(report.thresholdExceeded).toBe(true);
  });

  it('should trigger LOW_ENTROPY_CLARITY when entropy < 30 for 3 consecutive days', () => {
    const history = [
      { date: '2026-03-01', netEntropy: 50 },
      { date: '2026-03-02', netEntropy: 24 },
      { date: '2026-03-03', netEntropy: 18 },
      { date: '2026-03-04', netEntropy: 22 },
    ];

    const report = CrisisDetector.detect(history);
    expect(report.state).toBe('LOW_ENTROPY_CLARITY');
    expect(report.level).toBe('optimal');
    expect(report.stateLabel).toBe('低熵澄明');
    expect(report.consecutiveDays).toBe(3);
    expect(report.thresholdExceeded).toBe(true);
  });

  it('should NOT trigger crisis if high entropy occurs for only 2 consecutive days', () => {
    const history = [
      { date: '2026-03-01', netEntropy: 60 },
      { date: '2026-03-02', netEntropy: 80 },
      { date: '2026-03-03', netEntropy: 85 },
    ];

    const report = CrisisDetector.detect(history);
    expect(report.state).toBe('NORMAL');
    expect(report.level).toBe('stable');
    expect(report.thresholdExceeded).toBe(false);
  });
});
