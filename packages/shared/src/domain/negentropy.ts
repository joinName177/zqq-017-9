export type NegentropyCategory =
  | 'breathwork'
  | 'nature'
  | 'social_connection'
  | 'creative'
  | 'rest'
  | 'exercise'
  | 'mindfulness'
  | 'other';

export const NEGENTROPY_CATEGORIES: readonly NegentropyCategory[] = [
  'breathwork',
  'nature',
  'social_connection',
  'creative',
  'rest',
  'exercise',
  'mindfulness',
  'other',
] as const;

export const NEGENTROPY_CATEGORY_LABELS: Record<NegentropyCategory, string> = {
  breathwork: '呼吸与正念',
  nature: '户外与自然',
  social_connection: '温暖社交',
  creative: '心流创作',
  rest: '优质休息',
  exercise: '躯体激活',
  mindfulness: '冥想觉察',
  other: '自愈小事',
};

export interface NegentropyEvent {
  id: string;
  entryId: string;
  title: string;
  category: NegentropyCategory;
  /**
   * 对熵值的削弱量 (5 - 35)
   */
  reductionValue: number;
  notes?: string;
  createdAt: string;
}

export interface NegentropyLeaderboardItem {
  rank: number;
  title: string;
  category: NegentropyCategory;
  categoryLabel: string;
  totalReduction: number;
  count: number;
  averageReduction: number;
}
