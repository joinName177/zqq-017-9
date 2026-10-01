import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DailyEntryService } from '../../../app/services/daily-entry.service.js';
import {
  ApiResponse,
  createEntrySchema,
  paginationQuerySchema,
  DailyEntry,
} from '../../../core/index.js';

export async function entryRoutes(
  fastify: FastifyInstance,
  options: { dailyEntryService: DailyEntryService }
): Promise<void> {
  const { dailyEntryService } = options;

  // 记录或更新每日评估
  fastify.post('/api/entries', async (req, reply) => {
    try {
      const parsedBody = createEntrySchema.parse(req.body);
      const entry = await dailyEntryService.recordDailyEntry(parsedBody);
      const response: ApiResponse<DailyEntry> = {
        success: true,
        data: entry,
        message: '每日心理熵值评估记录成功',
      };
      return reply.status(201).send(response);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        });
      }
      const message = err instanceof Error ? err.message : '保存评估记录失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });

  // 获取历史记录列表
  fastify.get('/api/entries', async (req, reply) => {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const result = await dailyEntryService.getHistory(query);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: err.errors.map((e) => e.message).join('; '),
        });
      }
      const message = err instanceof Error ? err.message : '获取历史记录失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });

  // 按日期查询单条记录
  fastify.get('/api/entries/:date', async (req, reply) => {
    const { date } = req.params as { date: string };
    try {
      const entry = await dailyEntryService.getByDate(date);
      if (!entry) {
        return reply.status(404).send({
          success: false,
          error: `未找到 ${date} 的心理评估记录`,
        });
      }
      return reply.send({
        success: true,
        data: entry,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '查询记录失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });

  // 删除单条记录
  fastify.delete('/api/entries/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const deleted = await dailyEntryService.deleteEntryById(id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: '未能找到待删除的记录',
        });
      }
      return reply.send({
        success: true,
        message: '评估记录删除成功',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除记录失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}
