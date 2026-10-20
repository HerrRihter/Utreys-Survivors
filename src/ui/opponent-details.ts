import { unitDefinitions } from '../../data/enemies/units.js';
import { bestiary } from '../../data/enemies/bestiary.js';
export interface OpponentMeta {
  category: 'regulators' | 'clients';
  badge: string;
  badgeColor: string;
  role: string;
  protocol: string;
  frequency: string;
  aggregation: string;
  description: string;
  tactics: string;
}

export type UnitKey = keyof typeof unitDefinitions;
export const ALL_UNIT_KEYS = Object.keys(unitDefinitions) as UnitKey[];

// The texts live in data/enemies/bestiary.js.
export const OPPONENTS_META: Record<UnitKey, OpponentMeta> = bestiary;
