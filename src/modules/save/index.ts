// Public surface of the save module. Other modules import ONLY from here.
export type { SaveData, SaveDataV1, SaveDataV2, SavedCoach, SavedTree } from './internal/schema.ts';
export { migrateSave } from './internal/schema.ts';
export type { GameState, SaveInput } from './internal/serialize.ts';
export { createDemoState, fromSave, toSave } from './internal/serialize.ts';
export type {
  AuthGateway,
  AuthResult,
  Gateways,
  NullGatewaySeed,
  SaveGateway,
} from './internal/gateways.ts';
export { createNullGateways } from './internal/gateways.ts';
export { createSupabaseGateways } from './internal/supabase-gateways.ts';
export type { Autosaver, AutosaverTimers } from './internal/autosaver.ts';
export { createAutosaver, loadOrCreate } from './internal/autosaver.ts';
