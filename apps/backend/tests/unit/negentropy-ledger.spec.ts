import { describe, it, expect } from 'vitest';
import { NegentropyLedger, NegentropyEvent } from '../../src/core/index.js';

describe('NegentropyLedger', () => {
  it('should sum reductions across multiple negentropy events', () => {
    const events: NegentropyEvent[] = [
      {
        id: '1',
        entryId: 'e1',
        title: '冥想 15分钟',
        category: 'mindfulness',
        reductionValue: 12,
        createdAt: '2026-03-01',
      },
      {
        id: '2',
        entryId: 'e1',
        title: '公园漫步',
        category: 'nature',
        reductionValue: 15,
        createdAt: '2026-03-01',
      },
    ];

    const total = NegentropyLedger.calculateTotalReduction(events);
    expect(total).toBe(27);
  });

  it('should compute net entropy bounded by zero and not negative', () => {
    const grossEntropy = 20;
    const totalReduction = 30; // exceeds gross entropy
    const net = NegentropyLedger.calculateNetEntropy(grossEntropy, totalReduction);
    expect(net).toBe(0);
  });

  it('should build and rank leaderboard properly', () => {
    const events: NegentropyEvent[] = [
      { id: '1', entryId: 'e1', title: '慢跑', category: 'exercise', reductionValue: 10, createdAt: '2026-03-01' },
      { id: '2', entryId: 'e2', title: '冥想', category: 'mindfulness', reductionValue: 15, createdAt: '2026-03-02' },
      { id: '3', entryId: 'e3', title: '慢跑', category: 'exercise', reductionValue: 12, createdAt: '2026-03-03' },
    ];

    const leaderboard = NegentropyLedger.buildLeaderboard(events);
    expect(leaderboard).toHaveLength(2);
    // 慢跑: 10 + 12 = 22 total reduction, count = 2
    expect(leaderboard[0]!.title).toBe('慢跑');
    expect(leaderboard[0]!.totalReduction).toBe(22);
    expect(leaderboard[0]!.count).toBe(2);
    expect(leaderboard[0]!.averageReduction).toBe(11);
    expect(leaderboard[0]!.rank).toBe(1);

    // 冥想: 15 total reduction, count = 1
    expect(leaderboard[1]!.title).toBe('冥想');
    expect(leaderboard[1]!.rank).toBe(2);
  });
});
