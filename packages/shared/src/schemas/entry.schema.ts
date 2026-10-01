import { z } from 'zod';
import { NEGENTROPY_CATEGORIES } from '../domain/negentropy.js';

export const dimensionScoresSchema = z.object({
  physicalTension: z.number().min(0, '身体紧绷度最低为0').max(10, '身体紧绷度最高为10'),
  rumination: z.number().min(0, '思维反刍度最低为0').max(10, '思维反刍度最高为10'),
  lackOfControl: z.number().min(0, '控制感缺失最低为0').max(10, '控制感缺失最高为10'),
  timePressure: z.number().min(0, '时间压迫感最低为0').max(10, '时间压迫感最高为10'),
  socialAvoidance: z.number().min(0, '社交回避度最低为0').max(10, '社交回避度最高为10'),
  futureUncertainty: z.number().min(0, '未来不确定感最低为0').max(10, '未来不确定感最高为10'),
});

export const createNegentropyEventInlineSchema = z.object({
  title: z.string().trim().min(1, '请输入负熵事件名称').max(80, '负熵事件名称最长80字符'),
  category: z.enum(NEGENTROPY_CATEGORIES as unknown as [string, ...string[]]),
  reductionValue: z.number().min(1, '削弱量最小为1').max(50, '单次负熵削弱量最大为50'),
  notes: z.string().max(300, '备注最多300字').optional(),
});

export const createEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  scores: dimensionScoresSchema,
  notes: z.string().max(500, '备注最多500字').optional(),
  negentropyEvent: createNegentropyEventInlineSchema.optional(),
});

export const updateEntrySchema = z.object({
  scores: dimensionScoresSchema.optional(),
  notes: z.string().max(500, '备注最多500字').optional(),
});

export type DimensionScoresInput = z.infer<typeof dimensionScoresSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
