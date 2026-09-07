export type PulseStatus = 'green' | 'amber' | 'red';

export interface PulseCard {
  id: string;
  title: string;
  status: PulseStatus;
  note: string;
  updatedAt: string;
}

export interface PulseCardInput {
  title: string;
  status: PulseStatus;
  note: string;
}

export const STORAGE_KEY = 'pulse-board:cards';

export const STATUS_LABELS: Record<PulseStatus, string> = {
  green: 'OK',
  amber: 'WARN',
  red: 'FAIL',
};
