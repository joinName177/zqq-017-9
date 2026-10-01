import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DailyEntryService } from '../../../app/services/daily-entry.service.js';
import { createNegentropyEventSchema } from '../../../core/index.js';

export async function negentropyRoutes(
  fastify: FastifyInstance,
  options: { dailyEntryService: DailyEntryService }
): Promise<void> {
  const { dailyEntryService } = options;

  fastify.post('/api/negentropy', async (req, reply) => {
    try {
      const parsedBody = createNegentropyEventSchema.parse(req.body);
      const event = await dailyEntryService.addNegentropyEvent(parsedBody);
      return reply.status(201).send({
        success: true,
        data: event,
        message: '负熵事件记录成功，已削弱心理熵值',
      });
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: err.errors.map((e) => e.message).join('; '),
        });
      }
      const message = err instanceof Error ? err.message : '添加负熵事件失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });

  fastify.delete('/api/negentropy/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const deleted = await dailyEntryService.deleteNegentropyEvent(id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: '未能找到待删除的负熵事件',
        });
      }
      return reply.send({
        success: true,
        message: '负熵事件已删除',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除负熵事件失败';
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}
