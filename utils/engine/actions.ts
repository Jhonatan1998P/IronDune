
// This file acts as a barrel for all action sub-modules.
// Maintains backward compatibility with existing imports.

export * from './actions/types';
export * from './actions/constructionActions';
export { 
    executeRecruit, 
    executeStartMission, 
    executeCampaignAttack, 
    executePvpAttack, 
    executeDeclareWar, 
    executeEspionage as executeWarEspionage, // Alias for backward compat
    executeEspionage // Export new name
} from './actions/militaryActions';
export * from './actions/researchActions';
export * from './actions/economyActions';
export * from './actions/marketActions';
