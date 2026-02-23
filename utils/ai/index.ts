
// AI Module - Public API

export { PERSONALITY_WEIGHTS, PERSONALITY_DESCRIPTIONS } from './personalityWeights';
export type { PersonalityTraits } from './personalityWeights';

export { makeBotDecision, processBotDecisions } from './decisionEngine';
export type { BotDecision, WorldState } from './decisionEngine';

export { selectAttackTarget, shouldTargetPlayer } from './targetSelection';
export type { TargetScore } from './targetSelection';

export { processDiplomaticAI } from './diplomaticAI';
