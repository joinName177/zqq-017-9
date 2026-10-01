import crypto from 'node:crypto';
import {
  CreateEntryInput,
  CreateNegentropyEventInput,
  DailyEntry,
  DailyRiverPoint,
  DashboardData,
  IEntryRepository,
  NegentropyEvent,
  ShannonEntropyCalculator,
  EntropySourceAttributor,
  NegentropyLedger,
  EntropyTrendAnalyzer,
  CrisisDetector,
  PaginationQuery,
} from '../../core/index.js';

export class DailyEntryService {
  constructor(private readonly repository: IEntryRepository) {}

  /**
   * 记录或更新每日心理评估与负熵小事
   */
  public async recordDailyEntry(input: CreateEntryInput): Promise<DailyEntry> {
    const calculation = ShannonEntropyCalculator.calculate(input.scores);
    const existingEntry = await this.repository.findByDate(input.date);

    const entryId = existingEntry ? existingEntry.id : crypto.randomUUID();
    const now = new Date().toISOString();

    let events: NegentropyEvent[] = existingEntry ? [...existingEntry.negentropyEvents] : [];

    if (input.negentropyEvent) {
      const newEvent: NegentropyEvent = {
        id: crypto.randomUUID(),
        entryId,
        title: input.negentropyEvent.title,
        category: input.negentropyEvent.category as NegentropyEvent['category'],
        reductionValue: input.negentropyEvent.reductionValue,
        notes: input.negentropyEvent.notes,
        createdAt: now,
      };
      events.push(newEvent);
    }

    const totalReduction = NegentropyLedger.calculateTotalReduction(events);
    const netEntropy = NegentropyLedger.calculateNetEntropy(calculation.grossEntropy, totalReduction);

    const entryToSave: DailyEntry = {
      id: entryId,
      date: input.date,
      scores: input.scores,
      grossEntropy: calculation.grossEntropy,
      netEntropy,
      totalReduction,
      notes: input.notes,
      negentropyEvents: events,
      createdAt: existingEntry ? existingEntry.createdAt : now,
      updatedAt: now,
    };

    return this.repository.save(entryToSave);
  }

  /**
   * 获取聚合热力学仪表盘全景数据
   */
  public async getDashboardSummary(): Promise<DashboardData> {
    const todayStr = new Date().toISOString().split('T')[0]!;
    const allEntries = await this.repository.findAll(60, 0); // up to 60 days
    const totalCount = await this.repository.count();

    // 历史数据按日期升序用于河流图、趋势分析与危象检测
    const chronologicalEntries = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));

    // 今日数据或最新一条记录
    let todayEntry = await this.repository.findByDate(todayStr);
    if (!todayEntry && chronologicalEntries.length > 0) {
      todayEntry = chronologicalEntries[chronologicalEntries.length - 1]!;
    }

    const todayCalculation = todayEntry
      ? ShannonEntropyCalculator.calculate(todayEntry.scores)
      : null;

    const attribution = todayEntry
      ? EntropySourceAttributor.attribute(todayEntry.scores)
      : null;

    // 趋势与危象分析
    const trendItems = chronologicalEntries.map((e) => ({
      date: e.date,
      netEntropy: e.netEntropy,
    }));

    const crisisReport = CrisisDetector.detect(trendItems);
    const trendReport = EntropyTrendAnalyzer.analyze(trendItems, 7);

    // 负熵因子排行榜
    const leaderboard = await this.repository.getNegentropyLeaderboard();

    // 熵变河流图点阵
    const riverData: DailyRiverPoint[] = chronologicalEntries.slice(-14).map((e) => ({
      date: e.date,
      grossEntropy: e.grossEntropy,
      netEntropy: e.netEntropy,
      totalReduction: e.totalReduction,
      scores: e.scores,
    }));

    return {
      todayEntry,
      todayCalculation,
      attribution,
      crisisReport,
      trendReport,
      leaderboard,
      riverData,
      historyCount: totalCount,
    };
  }

  /**
   * 分页查询历史条目
   */
  public async getHistory(query: PaginationQuery): Promise<{ items: DailyEntry[]; total: number }> {
    const items = await this.repository.findAll(query.limit, query.offset);
    const total = await this.repository.count();
    return { items, total };
  }

  /**
   * 按日期查询单条条目
   */
  public async getByDate(date: string): Promise<DailyEntry | null> {
    return this.repository.findByDate(date);
  }

  /**
   * 按 ID 删除条目
   */
  public async deleteEntryById(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }

  /**
   * 为指定条目追加负熵事件
   */
  public async addNegentropyEvent(input: CreateNegentropyEventInput): Promise<NegentropyEvent> {
    const entry = await this.repository.findById(input.entryId);
    if (!entry) {
      throw new Error(`找不到对应的评估条目 (ID: ${input.entryId})`);
    }

    const event: NegentropyEvent = {
      id: crypto.randomUUID(),
      entryId: input.entryId,
      title: input.title,
      category: input.category as NegentropyEvent['category'],
      reductionValue: input.reductionValue,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };

    return this.repository.addNegentropyEvent(event);
  }

  /**
   * 删除负熵事件
   */
  public async deleteNegentropyEvent(id: string): Promise<boolean> {
    return this.repository.deleteNegentropyEvent(id);
  }

  /**
   * 初始化 14 天高质量热力学测试演示数据
   */
  public async seedDemoData(): Promise<number> {
    const demoDates: string[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      demoDates.push(d.toISOString().split('T')[0]!);
    }

    // 预设呈现"从高熵紊乱 -> 经负熵干预 -> 转向低熵澄明"的完整动力学曲线
    const scorePresets: Array<{
      scores: CreateEntryInput['scores'];
      notes: string;
      event?: { title: string; category: NegentropyEvent['category']; reductionValue: number };
    }> = [
      {
        scores: { physicalTension: 8, rumination: 9, lackOfControl: 8, timePressure: 9, socialAvoidance: 7, futureUncertainty: 9 },
        notes: '多项目同时截止，交感神经高度亢奋，头脑严重反刍',
      },
      {
        scores: { physicalTension: 8, rumination: 8, lackOfControl: 9, timePressure: 8, socialAvoidance: 8, futureUncertainty: 8 },
        notes: '睡眠严重不足，身体极度酸胀，进入高熵超载阶段',
      },
      {
        scores: { physicalTension: 9, rumination: 9, lackOfControl: 8, timePressure: 8, socialAvoidance: 8, futureUncertainty: 8 },
        notes: '连续第三天高压，触发高熵危象阈值预警',
        event: { title: '生理性叹息呼吸 15分钟', category: 'breathwork', reductionValue: 18 },
      },
      {
        scores: { physicalTension: 7, rumination: 7, lackOfControl: 6, timePressure: 7, socialAvoidance: 6, futureUncertainty: 7 },
        notes: '呼吸练习后心率下降，开始主动推掉非必要事务',
        event: { title: '公园赤足踩草地 30分钟', category: 'nature', reductionValue: 20 },
      },
      {
        scores: { physicalTension: 6, rumination: 5, lackOfControl: 5, timePressure: 6, socialAvoidance: 5, futureUncertainty: 6 },
        notes: '秩序感逐渐恢复，思绪开始聚焦',
        event: { title: '与知心老友深度倾诉', category: 'social_connection', reductionValue: 22 },
      },
      {
        scores: { physicalTension: 5, rumination: 4, lackOfControl: 4, timePressure: 5, socialAvoidance: 4, futureUncertainty: 5 },
        notes: '平稳过渡，身体紧张明显缓解',
        event: { title: '40分钟无扰慢跑', category: 'exercise', reductionValue: 15 },
      },
      {
        scores: { physicalTension: 4, rumination: 3, lackOfControl: 3, timePressure: 4, socialAvoidance: 3, futureUncertainty: 4 },
        notes: '进入稳态动态平衡，专注力显著回升',
        event: { title: '专注沉浸式拼图', category: 'creative', reductionValue: 14 },
      },
      {
        scores: { physicalTension: 3, rumination: 3, lackOfControl: 2, timePressure: 3, socialAvoidance: 2, futureUncertainty: 3 },
        notes: '内心情绪恒定，几乎无思维反刍',
        event: { title: '无声颂钵正念冥想', category: 'mindfulness', reductionValue: 16 },
      },
      {
        scores: { physicalTension: 2, rumination: 2, lackOfControl: 2, timePressure: 2, socialAvoidance: 2, futureUncertainty: 2 },
        notes: '内心极其宁静有序，进入低熵状态',
        event: { title: '9小时全黑深度睡眠', category: 'rest', reductionValue: 20 },
      },
      {
        scores: { physicalTension: 1, rumination: 1, lackOfControl: 1, timePressure: 2, socialAvoidance: 1, futureUncertainty: 2 },
        notes: '低熵澄明第 1 天，心智带宽极其充沛',
        event: { title: '清晨林间快走看日出', category: 'nature', reductionValue: 15 },
      },
      {
        scores: { physicalTension: 1, rumination: 1, lackOfControl: 1, timePressure: 1, socialAvoidance: 1, futureUncertainty: 1 },
        notes: '低熵澄明第 2 天，深度心流沉浸工作 4 小时',
        event: { title: '冲泡手冲咖啡与静心记录', category: 'creative', reductionValue: 12 },
      },
      {
        scores: { physicalTension: 1, rumination: 0, lackOfControl: 1, timePressure: 1, socialAvoidance: 1, futureUncertainty: 1 },
        notes: '连续 3 天低熵，成功触发"低熵澄明"临界最优态！',
        event: { title: '温暖香薰热水浴', category: 'rest', reductionValue: 15 },
      },
      {
        scores: { physicalTension: 2, rumination: 1, lackOfControl: 2, timePressure: 2, socialAvoidance: 2, futureUncertainty: 2 },
        notes: '低熵澄明延续，能量流转充沛自如',
        event: { title: '瑜伽拉伸放松', category: 'exercise', reductionValue: 14 },
      },
      {
        scores: { physicalTension: 2, rumination: 2, lackOfControl: 1, timePressure: 2, socialAvoidance: 1, futureUncertainty: 1 },
        notes: '今日评估：内心秩序良好，保持觉察与自洽',
        event: { title: '腹式呼吸觉察练习', category: 'breathwork', reductionValue: 16 },
      },
    ];

    let seededCount = 0;
    for (let i = 0; i < demoDates.length; i++) {
      const date = demoDates[i]!;
      const preset = scorePresets[i]!;

      await this.recordDailyEntry({
        date,
        scores: preset.scores,
        notes: preset.notes,
        negentropyEvent: preset.event,
      });
      seededCount++;
    }

    return seededCount;
  }
}
