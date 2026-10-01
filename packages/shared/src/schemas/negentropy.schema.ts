import { z } from 'zod';
import { NEGENTROPY_CATEGORIES } from '../domain/negentropy.js';

export const createNegentropyEventSchema = z.object({
  entryId: z.string().min(1, '条目ID不能为空'),
  title: z.string().trim().min(1, '请输入负熵事件名称').max(80, '负熵事件名称最长80字符'),
  category: z.enum(NEGENTROPY_CATEGORIES as unknown as [string, ...string[]]),
  reductionValue: z.number().min(1, '削弱量最小为1').max(50, '单次负熵削弱量最大为50'),
  notes: z.string().max(300, '备注最多300字').optional(),
});

export type CreateNegentropyEventInput = z.infer<typeof createNegentropyEventSchema>;
