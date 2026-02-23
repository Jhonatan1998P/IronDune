
import { BotState } from '../../types/bot';
import { PersonalityTraits } from './personalityWeights';
import { getTotalResources } from '../engine/botSimulation';

/**
 * Sistema de Selección de Objetivos
 * 
 * Determina a quién atacar basado en múltiples factores
 */

export interface TargetScore {
  targetId: string;
  score: number;
  reasons: string[];
}

interface WorldState {
  botStates: Record<string, BotState>;
  factions: Record<string, import('../../types/faction').Faction>;
  playerArmyScore?: number;
  playerFactionId?: string;
}

export function selectAttackTarget(
  bot: BotState,
  candidates: string[],
  worldState: WorldState,
  traits: PersonalityTraits
): TargetScore | null {
  if (candidates.length === 0) return null;

  const scores: TargetScore[] = candidates.map(candidateId => {
    const candidate = worldState.botStates[candidateId];
    const reasons: string[] = [];
    let score = 0;

    if (!candidate) return { targetId: candidateId, score: -999, reasons: ['Target not found'] };

    // FACTOR: Venganza
    if (bot.memory.recentAttackers.some(a => a.attackerId === candidateId)) {
      const revengeScore = 50 * traits.revenge;
      score += revengeScore;
      reasons.push(`Revenge target (+${revengeScore.toFixed(0)})`);
    }

    // FACTOR: Debilidad del objetivo
    const strengthRatio = bot.armyScore / Math.max(1, candidate.armyScore);
    if (strengthRatio > 1.5) {
      const weaknessScore = 30 * traits.opportunism;
      score += weaknessScore;
      reasons.push(`Weak target (+${weaknessScore.toFixed(0)})`);
    }

    // FACTOR: Riqueza del objetivo
    const targetWealth = getTotalResources(candidate);
    if (targetWealth > 10000) {
      const wealthScore = 20 * traits.greed;
      score += wealthScore;
      reasons.push(`Rich target (+${wealthScore.toFixed(0)})`);
    }

    // FACTOR: Enemigo de facción
    if (bot.factionId && candidate.factionId) {
      const myFaction = worldState.factions[bot.factionId];
      if (myFaction?.enemies.includes(candidate.factionId)) {
        const factionScore = 40 * traits.loyalty;
        score += factionScore;
        reasons.push(`Faction enemy (+${factionScore.toFixed(0)})`);
      }
    }

    // FACTOR: Sin alianzas (objetivo fácil)
    if (!candidate.factionId) {
      const isolatedScore = 15 * traits.opportunism;
      score += isolatedScore;
      reasons.push(`Isolated target (+${isolatedScore.toFixed(0)})`);
    }

    // PENALIZACIÓN: Aliado
    if (bot.memory.recentAllies.some(a => a.allyId === candidateId)) {
      const allyPenalty = -100 * traits.loyalty;
      score += allyPenalty;
      reasons.push(`Ally (${allyPenalty.toFixed(0)})`);
    }

    // PENALIZACIÓN: Misma facción
    if (bot.factionId && candidate.factionId === bot.factionId) {
      score -= 200;
      reasons.push('Same faction (-200)');
    }

    // PENALIZACIÓN: Muy fuerte
    if (strengthRatio < 0.7) {
      const dangerPenalty = -50 * (1 - traits.riskTolerance);
      score += dangerPenalty;
      reasons.push(`Dangerous (${dangerPenalty.toFixed(0)})`);
    }

    return { targetId: candidateId, score, reasons };
  });

  scores.sort((a, b) => b.score - a.score);

  return scores[0]?.score > 0 ? scores[0] : null;
}

/**
 * Selecciona objetivo para el jugador específicamente
 */
export function shouldTargetPlayer(
  bot: BotState,
  playerArmyScore: number,
  worldState: WorldState,
  traits: PersonalityTraits
): { should: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Venganza contra el jugador
  if (bot.memory.playerActions.some(a => a.action === 'attack')) {
    const revengeScore = 60 * traits.revenge;
    score += revengeScore;
    reasons.push(`Player attacked us (+${revengeScore.toFixed(0)})`);
  }

  // El jugador traicionó
  if (bot.memory.playerActions.some(a => a.action === 'betray')) {
    score += 100;
    reasons.push('Player betrayed us (+100)');
  }

  // El jugador es amenaza
  if (bot.memory.playerThreatLevel > 50) {
    const threatScore = bot.memory.playerThreatLevel * traits.aggression * 0.5;
    score += threatScore;
    reasons.push(`High threat level (+${threatScore.toFixed(0)})`);
  }

  // Facción enemiga del jugador
  if (bot.factionId && worldState.playerFactionId) {
    const myFaction = worldState.factions[bot.factionId];
    if (myFaction?.enemies.includes(worldState.playerFactionId)) {
      score += 50;
      reasons.push('Player faction is enemy (+50)');
    }
  }

  // Oportunidad: jugador débil
  const strengthRatio = bot.armyScore / Math.max(1, playerArmyScore);
  if (strengthRatio > 2) {
    const oppScore = 30 * traits.opportunism;
    score += oppScore;
    reasons.push(`Player is weak (+${oppScore.toFixed(0)})`);
  }

  // Penalización: aliado
  if (bot.memory.playerActions.some(a => a.action === 'alliance' || a.action === 'help')) {
    const allyPenalty = -80 * traits.loyalty;
    score += allyPenalty;
    reasons.push(`Player is ally (${allyPenalty.toFixed(0)})`);
  }

  return {
    should: score > 30,
    score,
    reasons
  };
}
