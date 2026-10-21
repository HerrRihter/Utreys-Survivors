import type { GameSession } from './game-session.js';
import type { createAccount } from '../services/auth.js';
import type { createLeaderboard } from '../services/leaderboard.js';
import type { createPreviewKit } from './preview-kit.js';
import type { mapDefinitions } from '../../data/maps/maps.js';
import type { statMetrics } from '../../data/leaderboards.js';
import type { learningResult } from './views/result.js';

export type LearningOption = { id: string; text: string; selected: boolean; correct: boolean };
export type LearningTerminal = { id: string; label: string };
export type LearningReport = NonNullable<ReturnType<typeof learningResult>>;

// Shapes the app layer hands to React; components import them from here, never the reverse.
export type Session = ReturnType<typeof GameSession.create>;
export type Account = ReturnType<typeof createAccount>;
export type Leaderboard = ReturnType<typeof createLeaderboard>;
export type PreviewKit = ReturnType<typeof createPreviewKit>;
export type MapId = keyof typeof mapDefinitions;
export type Metric = (typeof statMetrics)[number];
export type { UnitKey, OpponentMeta } from '../ui/opponent-details';
