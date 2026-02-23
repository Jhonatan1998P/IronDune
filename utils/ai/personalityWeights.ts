
import { BotPersonality } from '../../types/enums';

/**
 * Configuración de personalidades de bots
 * 
 * Cada rasgo va de 0.0 a 1.0
 */

export interface PersonalityTraits {
  // Comportamiento militar
  aggression: number;
  riskTolerance: number;
  revenge: number;

  // Comportamiento social
  loyalty: number;
  diplomacy: number;
  greed: number;

  // Comportamiento estratégico
  patience: number;
  adaptability: number;
  opportunism: number;
}

export const PERSONALITY_WEIGHTS: Record<BotPersonality, PersonalityTraits> = {
  [BotPersonality.WARLORD]: {
    aggression: 0.9,
    riskTolerance: 0.8,
    revenge: 0.95,
    loyalty: 0.4,
    diplomacy: 0.2,
    greed: 0.5,
    patience: 0.2,
    adaptability: 0.4,
    opportunism: 0.6
  },

  [BotPersonality.TURTLE]: {
    aggression: 0.2,
    riskTolerance: 0.2,
    revenge: 0.6,
    loyalty: 0.9,
    diplomacy: 0.7,
    greed: 0.3,
    patience: 0.95,
    adaptability: 0.5,
    opportunism: 0.3
  },

  [BotPersonality.TYCOON]: {
    aggression: 0.3,
    riskTolerance: 0.5,
    revenge: 0.3,
    loyalty: 0.6,
    diplomacy: 0.8,
    greed: 0.95,
    patience: 0.7,
    adaptability: 0.8,
    opportunism: 0.7
  },

  [BotPersonality.ROGUE]: {
    aggression: 0.6,
    riskTolerance: 0.9,
    revenge: 0.5,
    loyalty: 0.1,
    diplomacy: 0.4,
    greed: 0.8,
    patience: 0.3,
    adaptability: 0.95,
    opportunism: 0.95
  }
};

/**
 * Descripciones de comportamiento para UI/tooltips (bilingüe)
 */
export const PERSONALITY_DESCRIPTIONS: Record<BotPersonality, { es: string; en: string }> = {
  [BotPersonality.WARLORD]: {
    es: "Agresivo y vengativo. Ataca rápido y nunca olvida las ofensivas. Busca alianzas para conquistar, pero puede abandonarlas si le conviene.",
    en: "Aggressive and vengeful. Strikes fast and never forgets offenses. Seeks alliances to conquer, but may abandon them if convenient."
  },

  [BotPersonality.TURTLE]: {
    es: "Defensivo y leal. Prefiere construir en paz y solo ataca cuando es provocado. Excelente aliado, pero lento para actuar. Cuando ataca, ataca con fuerza.",
    en: "Defensive and loyal. Prefers to build in peace and only attacks when provoked. Excellent ally, but slow to act. When they strike, they strike hard."
  },

  [BotPersonality.TYCOON]: {
    es: "Enfocado en la economía. Prefiere comerciar antes que luchar. Busca acuerdos rentables y evita conflictos costosos.",
    en: "Economy-focused. Prefers trading over fighting. Seeks profitable deals and avoids costly conflicts."
  },

  [BotPersonality.ROGUE]: {
    es: "Impredecible y oportunista. Puede ser tu mejor aliado un momento y traicionarte al siguiente. Muy peligroso pero útil si se gestiona bien.",
    en: "Unpredictable and opportunistic. Can be your best ally one moment and betray you the next. Very dangerous but useful if managed well."
  }
};
