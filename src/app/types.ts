import type { GameSession } from './game-session.js';
import type { createAccount } from '../services/auth.js';

// Shapes the app layer hands to React; components import them from here, never the reverse.
export type Session = ReturnType<typeof GameSession.create>;
export type Account = ReturnType<typeof createAccount>;
