import { DimensionScores } from './entropy.js';
import { NegentropyEvent } from './negentropy.js';

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  scores: DimensionScores;
  grossEntropy: number;
  netEntropy: number;
  totalReduction: number;
  notes?: string;
  negentropyEvents: NegentropyEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyRiverPoint {
  date: string;
  grossEntropy: number;
  netEntropy: number;
  totalReduction: number;
  scores: DimensionScores;
}
