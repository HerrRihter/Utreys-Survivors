import type { GameSession } from './game-session.js';
import type { createAccount } from '../services/auth.js';
import type { createLeaderboard } from '../services/leaderboard.js';
import type { createPreviewKit } from './preview-kit.js';
import type { mapDefinitions } from '../../data/maps/maps.js';
import type { statMetrics } from '../../data/leaderboards.js';
import type { learningResult } from './views/result.js';
import type { escalationResult, escalationView } from './views/escalation.js';

export type LearningOption = { id: string; text: string; selected: boolean; correct: boolean };
export type LearningTerminal = { id: string; label: string };
export type LearningReport = NonNullable<ReturnType<typeof learningResult>>;
// The incident shift's console and results (app/views/escalation.js). The run state behind
// them is untyped JS, so the lists are described here.
export type AskedQuestion = {
  id: string;
  text: string;
  multiple: boolean;
  options: { id: string; text: string }[];
};
export type ShiftTicket = {
  id: number;
  title: string;
  component: string;
  opened: string;
  created: string | null;
  status: string | null;
  statusName: string;
  next: { id: string; name: string }[];
  card: Record<string, any>;
  asked: string[];
  levels: { level: number; name: string; reached: string; due: string }[];
  calls: { role: string; at: string; answered: boolean; arrive: string; working: boolean }[];
  internal: boolean;
  updates: number;
  lastUpdate: string;
  nextUpdateIn: number | null;
  workaroundKnown: boolean;
  workaroundApplied: boolean;
  fixed: boolean;
  impactDown: boolean;
  questions: (AskedQuestion & { key: string })[];
};
export type ShiftInboxItem = {
  inject: string;
  at: string;
  text: string;
  answered: boolean;
  question: AskedQuestion | null;
  steps: { index: number; text: string }[];
};
export type EscalationConsoleView = Omit<
  NonNullable<ReturnType<typeof escalationView>>,
  'tickets' | 'inbox' | 'journal' | 'notes'
> & {
  tickets: ShiftTicket[];
  inbox: ShiftInboxItem[];
  journal: { index: number; at: string; ticket: string; text: string; recorded: boolean }[];
  notes: { name: string; note: string }[];
};
export type ShiftReport = Omit<NonNullable<ReturnType<typeof escalationResult>>, 'review'> & {
  review: (AskedQuestion & { key: string })[];
};

// Shapes the app layer hands to React; components import them from here, never the reverse.
export type Session = ReturnType<typeof GameSession.create>;
export type Account = ReturnType<typeof createAccount>;
export type Leaderboard = ReturnType<typeof createLeaderboard>;
export type PreviewKit = ReturnType<typeof createPreviewKit>;
export type MapId = keyof typeof mapDefinitions;
export type Metric = (typeof statMetrics)[number];
export type { UnitKey, OpponentMeta } from '../ui/opponent-details';
