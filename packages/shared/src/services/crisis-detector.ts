import { CrisisReport, CrisisState } from '../domain/crisis.js';

export interface EntryEntropyItem {
  date: string;
  netEntropy: number;
}

export class CrisisDetector {
  public static readonly HIGH_THRESHOLD = 75;
  public static readonly LOW_THRESHOLD = 30;
  public static readonly CONSECUTIVE_DAYS_REQUIRED = 3;

  /**
   * 检测临界状态
   * @param history 历史记录，按日期升序排列
   */
  public static detect(history: EntryEntropyItem[]): CrisisReport {
    if (!history || history.length === 0) {
      return {
        state: 'NORMAL',
        stateLabel: '无历史数据',
        level: 'stable',
        consecutiveDays: 0,
        thresholdExceeded: false,
        message: '尚未记录心理熵值，请完成今日评估。',
        recommendations: [
          '每天固定时间记录 6 维心理感受',
          '觉察内心细微的紧绷与反刍变化',
        ],
      };
    }

    // 从最近的一天向前倒推，计算连续满足条件的连续天数
    let highCount = 0;
    let lowCount = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      const entropy = history[i]!.netEntropy;
      if (entropy > this.HIGH_THRESHOLD) {
        if (lowCount > 0) break;
        highCount++;
      } else if (entropy < this.LOW_THRESHOLD) {
        if (highCount > 0) break;
        lowCount++;
      } else {
        break;
      }
    }

    if (highCount >= this.CONSECUTIVE_DAYS_REQUIRED) {
      return {
        state: 'HIGH_ENTROPY_CRISIS',
        stateLabel: '高熵危象',
        level: 'danger',
        consecutiveDays: highCount,
        thresholdExceeded: true,
        message: `⚠️ 系统检测到已连续 ${highCount} 天净熵值高于 ${this.HIGH_THRESHOLD}，内心正处于高度无序与超载危象，认知带宽严重耗竭！`,
        recommendations: [
          '生理性叹息呼吸法：连续快速双吸气，慢长呼气，重复 5 分钟降低交感神经兴奋',
          '信息断舍离：立即关闭社交媒体与即时通讯推送，远离信息过载',
          '触觉着陆（5-4-3-2-1 法）：注视 5 样物品、触摸 4 个质感、聆听 3 种声音，唤回秩序感',
          '立刻在系统中登记一件能够削弱熵值的微习惯（负熵事件）',
        ],
      };
    }

    if (lowCount >= this.CONSECUTIVE_DAYS_REQUIRED) {
      return {
        state: 'LOW_ENTROPY_CLARITY',
        stateLabel: '低熵澄明',
        level: 'optimal',
        consecutiveDays: lowCount,
        thresholdExceeded: true,
        message: `✨ 系统检测到已连续 ${lowCount} 天处于低熵澄明态 (<${this.LOW_THRESHOLD})，内心高度自洽有序，能量流动轻盈平顺。`,
        recommendations: [
          '把握心流时刻：将充沛的心智带宽投入到最重要的深度创造或复杂决策中',
          '锚定秩序基石：觉察并巩固这几天促使内心平静的关键生活节奏与习惯',
          '建立认知安全感：在内心记录当前宁静有力的感知锚点，作为应对波动的灯塔',
        ],
      };
    }

    // 如果未达到连续 3 天，但最近一天有极端值，给出温和提示
    const latest = history[history.length - 1]!.netEntropy;
    let state: CrisisState = 'NORMAL';
    let message = '心理熵值处于动态调节常态，系统保持自愈弹性。';

    if (latest > this.HIGH_THRESHOLD) {
      message = `今日熵值偏高 (${latest})，已连续 ${highCount} 天高熵，请注意减压与休息，防止演变为高熵危象。`;
    } else if (latest < this.LOW_THRESHOLD) {
      message = `今日处于平静状态 (${latest})，已连续 ${lowCount} 天低熵，请保持良好心境。`;
    }

    return {
      state,
      stateLabel: '稳态平衡',
      level: 'stable',
      consecutiveDays: Math.max(highCount, lowCount),
      thresholdExceeded: false,
      message,
      recommendations: [
        '保持每日自省觉察，追踪身体与情绪的微小变化',
        '遇到压力时及时记录一件负熵小事，平衡精神消耗',
      ],
    };
  }
}
