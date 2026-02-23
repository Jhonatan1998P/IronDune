
import { BotState, BotGoal } from '../../types/bot';
import { BotPersonality } from '../../types/enums';
import { Faction } from '../../types/faction';
import { DiplomaticAction, DealTerms, DiplomacyState } from '../../types/diplomacy';
import { PERSONALITY_WEIGHTS } from './personalityWeights';
import { createProposal } from '../engine/diplomacy';
import { shouldSeekFaction, findBestFaction } from '../engine/factions';

/**
 * IA Diplomática
 * 
 * Determina cuándo y cómo los bots inician acciones diplomáticas
 */

const DIPLOMATIC_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

/**
 * Procesa la IA diplomática para todos los bots
 */
export function processDiplomaticAI(
  botStates: Record<string, BotState>,
  factions: Record<string, Faction>,
  diplomacy: DiplomacyState,
  currentTime: number
): DiplomacyState {
  let updatedDiplomacy = { ...diplomacy };

  for (const [id, bot] of Object.entries(botStates)) {
    // Only process bots that are due for diplomatic check
    if (currentTime - bot.lastDecisionTime < DIPLOMATIC_CHECK_INTERVAL) continue;

    const traits = PERSONALITY_WEIGHTS[bot.personality];

    // Skip low-diplomacy bots most of the time
    if (traits.diplomacy < 0.3 && Math.random() > 0.2) continue;

    // 1. Seek faction if needed
    if (!bot.factionId && shouldSeekFaction(bot, factions)) {
      const bestFaction = findBestFaction(bot, factions, botStates);
      if (bestFaction) {
        const proposal = createProposal(
          { id: bot.id, type: 'bot' },
          { id: bestFaction.leaderId, type: 'bot' },
          DiplomaticAction.INVITE_TO_FACTION,
          { duration: 0 }
        );
        updatedDiplomacy = {
          ...updatedDiplomacy,
          proposals: { ...updatedDiplomacy.proposals, [proposal.id]: proposal }
        };
      }
      continue;
    }

    // 2. Consider proposing alliances to non-faction bots
    if (bot.factionId && traits.diplomacy > 0.5 && Math.random() < 0.1) {
      const unalliedBots = Object.keys(botStates).filter(otherId => {
        const other = botStates[otherId];
        return otherId !== id && !other.factionId &&
          !bot.memory.betrayals.some(b => b.traitorId === otherId) &&
          (bot.reputation[otherId] || 0) >= 0;
      });

      if (unalliedBots.length > 0) {
        const targetId = unalliedBots[Math.floor(Math.random() * unalliedBots.length)];
        const proposal = createProposal(
          { id: bot.id, type: 'bot' },
          { id: targetId, type: 'bot' },
          DiplomaticAction.PROPOSE_ALLIANCE,
          { duration: 4 * 60 * 60 * 1000 } // 4 hours
        );
        updatedDiplomacy = {
          ...updatedDiplomacy,
          proposals: { ...updatedDiplomacy.proposals, [proposal.id]: proposal }
        };
      }
    }

    // 3. Tycoons propose trade deals
    if (bot.personality === BotPersonality.TYCOON && Math.random() < 0.15) {
      const tradeCandidates = Object.keys(botStates).filter(otherId => {
        return otherId !== id && (bot.reputation[otherId] || 0) > -25;
      });

      if (tradeCandidates.length > 0) {
        const targetId = tradeCandidates[Math.floor(Math.random() * tradeCandidates.length)];
        const proposal = createProposal(
          { id: bot.id, type: 'bot' },
          { id: targetId, type: 'bot' },
          DiplomaticAction.PROPOSE_TRADE_DEAL,
          {
            resourcesOffered: {},
            resourcesRequested: {},
            duration: 2 * 60 * 60 * 1000
          }
        );
        updatedDiplomacy = {
          ...updatedDiplomacy,
          proposals: { ...updatedDiplomacy.proposals, [proposal.id]: proposal }
        };
      }
    }

    // 4. Warlords may threaten weaker bots
    if (bot.personality === BotPersonality.WARLORD && Math.random() < 0.08) {
      const weakTargets = Object.keys(botStates).filter(otherId => {
        const other = botStates[otherId];
        return otherId !== id && other.armyScore < bot.armyScore * 0.5 &&
          (!bot.factionId || other.factionId !== bot.factionId);
      });

      if (weakTargets.length > 0) {
        const targetId = weakTargets[Math.floor(Math.random() * weakTargets.length)];
        const proposal = createProposal(
          { id: bot.id, type: 'bot' },
          { id: targetId, type: 'bot' },
          DiplomaticAction.DEMAND_TRIBUTE,
          { tributePercentage: 10 }
        );
        updatedDiplomacy = {
          ...updatedDiplomacy,
          proposals: { ...updatedDiplomacy.proposals, [proposal.id]: proposal }
        };
      }
    }

    // 5. Propose ceasefire if in losing war
    if (bot.factionId) {
      const faction = factions[bot.factionId];
      if (faction && bot.factionRole === 'LEADER') {
        const losingWars = faction.activeWars.filter(w =>
          w.status === 'active' && w.currentScore.them > w.currentScore.us * 1.5
        );

        for (const war of losingWars) {
          if (Math.random() < 0.2) {
            const proposal = createProposal(
              { id: bot.factionId, type: 'faction' },
              { id: war.enemyFactionId, type: 'faction' },
              DiplomaticAction.OFFER_CEASEFIRE,
              { duration: 2 * 60 * 60 * 1000 }
            );
            updatedDiplomacy = {
              ...updatedDiplomacy,
              proposals: { ...updatedDiplomacy.proposals, [proposal.id]: proposal }
            };
          }
        }
      }
    }
  }

  return updatedDiplomacy;
}
