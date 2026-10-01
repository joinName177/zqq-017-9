import { FastifyInstance } from 'fastify';
import { DailyEntryService } from '../../../app/services/daily-entry.service.js';
import { ApiResponse, DashboardData } from '../../../core/index.js';

export async function dashboardRoutes(
  fastify: FastifyInstance,
  options: { dailyEntryService: DailyEntryService }
): Promise<void> {
  const { dailyEntryService } = options;

  fastify.get('/api/dashboard', async (_req, reply) => {
    try {
      const data = await dailyEntryService.getDashboardSummary();
      const response: ApiResponse<DashboardData> = {
        success: true,
        data,
      };
      return reply.send(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '获取仪表盘数据失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });

  fastify.post('/api/seed', async (_req, reply) => {
    try {
      const count = await dailyEntryService.seedDemoData();
      return reply.send({
        success: true,
        message: `成功注入 ${count} 天热力学演示测试数据`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注入测试数据失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}
