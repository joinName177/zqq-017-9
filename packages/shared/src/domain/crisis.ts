export type CrisisState = 'HIGH_ENTROPY_CRISIS' | 'LOW_ENTROPY_CLARITY' | 'NORMAL';

export type CrisisSeverity = 'danger' | 'optimal' | 'stable';

export interface CrisisReport {
  state: CrisisState;
  stateLabel: string;
  level: CrisisSeverity;
  consecutiveDays: number;
  thresholdExceeded: boolean;
  message: string;
  recommendations: string[];
}
