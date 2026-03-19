
import { BuildingType, BotPersonality, ResourceType } from "./types/enums";

// --- CONSTANTES DE LA APP ---
export const APP_VERSION = "Alpha 10.0.2";

// --- CONSTANTES DE CONFIGURACION ---
export const TICK_RATE_MS = 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// PROTECCION DE NOVATO
export const NEWBIE_PROTECTION_THRESHOLD = 1200; // Puntos requeridos para habilitar Amenaza y PvP

// AJUSTES DE PVP
export const GLOBAL_ATTACK_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 minutos estandar para PvP, PvE y Guerra
export const P2P_ATTACK_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 minutos estandar para ataques P2P directos
export const MAP_MISSION_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 minutos estandar para misiones del mapa de campana
export const PVP_RANGE_MIN = 0.5; // 50%
export const PVP_RANGE_MAX = 1.5 // 150%
export const PVP_LOOT_FACTOR = 0.15; // Factor heredado (se mantiene por compatibilidad)
export const MAX_ATTACKS_PER_TARGET = 3; // Limite de ataques por objetivo por dia (bots)

// REGLAS DE COMBATE P2P
export const P2P_MAX_ATTACKS_PER_TARGET_PER_DAY = 6; // Maximo de ataques P2P normales por objetivo por dia
export const P2P_ATTACK_RESET_INTERVAL_MS = ONE_DAY_MS; // Reinicio cada 24 horas

// Tasas de saqueo de edificios en P2P (por numero de ataque: 1ro=33%, 2do=25%, 3ro-6to=15%)
export const P2P_PLUNDER_RATES = [0.33, 0.25, 0.15, 0.15, 0.15, 0.15];

// AJUSTES DE SAQUEO DE EDIFICIOS (NUEVO V1.3)
export const PLUNDER_RATES = [0.33, 0.25, 0.15]; // 1er ataque, 2do, 3ro (vs bots)
export const BOT_BUILDINGS_PER_SCORE = 20; // 1 edificio por cada 20 puntos de score (score / 20)
// Solo se pueden robar productores de recursos (edificios de modo cantidad + Rascacielos)
// La Mina de Diamantes se maneja por separado con la logica de Dano.
export const PLUNDERABLE_BUILDINGS = [
    BuildingType.HOUSE,
    BuildingType.FACTORY,
    BuildingType.SKYSCRAPER,
    BuildingType.OIL_RIG,
    BuildingType.GOLD_MINE,
    BuildingType.MUNITIONS_FACTORY
];

// SISTEMA DE ATAQUE (NUEVO V1.4)
export const ATTACK_COOLDOWN_MIN_MS = 1 * 60 * 60 * 1000; // 1 hora
export const ATTACK_COOLDOWN_MAX_MS = 6 * 60 * 60 * 1000; // 6 horas

// SISTEMA DE GUERRA (ACTUALIZADO V1.2.1)
export const WAR_DURATION_MS = 130 * 60 * 1000; // 2 horas 10 minutos base
export const WAR_OVERTIME_MS = 20 * 60 * 1000; // 20 minutos agregados en empate
export const WAR_TOTAL_WAVES = 8; // 8 oleadas base
export const WAR_PLAYER_ATTACKS = 8; // Coincide con las oleadas
export const WAR_WAVE_INTERVAL_MS = GLOBAL_ATTACK_TRAVEL_TIME_MS; // Las oleadas llegan cada 15 min (si se simula offline)
export const WAR_COOLDOWN_MS = 30 * 60 * 1000; // Enfriamiento de 30 minutos entre guerras

// LIMITES DE PROGRESION OFFLINE
export const OFFLINE_PRODUCTION_LIMIT_MS = 6 * 60 * 60 * 1000; // Tope de 6 horas para Recursos/Mantenimiento

// SISTEMA DE BOTIN LOGISTICO
export const DEBRIS_EXPIRY_RAID_MS = 60 * 60 * 1000;        // 1 hora
export const DEBRIS_EXPIRY_WAR_BUFFER_MS = 30 * 60 * 1000;  // 30 min despues de terminar la guerra
export const DEBRIS_EXPIRY_P2P_MS = 120 * 60 * 1000;        // 2 horas
export const DEBRIS_EXPIRY_CAMPAIGN_MS = 30 * 60 * 1000;    // 30 minutos
export const DEBRIS_MAX_ACTIVE = 20;                         // Maximo de campos simultaneos
export const DEBRIS_RATIO_ATTACKER = 0.30; // 30%
export const DEBRIS_RATIO_DEFENDER = 0.30; // 30%
export const DEBRIS_RATIO_ALLY = 0.20;     // 20%
export const DEBRIS_ELIGIBLE_RESOURCES = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO];

export const SALVAGER_CARGO_CAPACITY = 500000; // Capacidad por dron
export const SALVAGE_TRAVEL_TIME_MS = 7.5 * 60 * 1000;  // 7.5 minutos
export const SALVAGE_TRAVEL_TIME_WAR_MS = 5 * 60 * 1000; // 5 minutos

// CAPACIDAD ILIMITADA (usada para Dinero, Petroleo, Municion, Oro)
export const UNLIMITED_CAPACITY = 999_999_999_999_999;

// CONSTANTES DE RVE Y BALANCE (V1.2.2)
export const SCORE_TO_RESOURCE_VALUE = 9000; // 1 punto = $9,000 de valor en recursos (formula de presupuesto de ataque)
export const BOT_BUDGET_RATIO = 1.0; // Los bots invierten el 100% del valor total en ejercito

// RATIOS DE RECURSOS PARA ESPIONAJE - Como se divide el presupuesto militar en recursos al espiar
// Cada personalidad tiene distintas preferencias de asignacion de recursos
export const SPY_RESOURCE_RATIOS: Record<BotPersonality, { money: number; oil: number; gold: number; ammo: number }> = {
    [BotPersonality.WARLORD]: { money: 0.40, oil: 0.35, gold: 0.10, ammo: 0.15 },    // Enfoque en petroleo y municion para la guerra
    [BotPersonality.TURTLE]: { money: 0.35, oil: 0.30, gold: 0.25, ammo: 0.10 },    // Mas oro para defensa/construccion
    [BotPersonality.TYCOON]: { money: 0.50, oil: 0.20, gold: 0.20, ammo: 0.10 },    // Mas dinero para economia
    [BotPersonality.ROGUE]: { money: 0.30, oil: 0.30, gold: 0.15, ammo: 0.25 }      // Mas municion para incursiones
};

export const TIER_THRESHOLDS = {
    TIER_1: 15000,
    TIER_2: 100000,
    TIER_3: 500000
};

// CONFIGURACION DEL BANCO (Capacidades fijas)
export const BANK_RATE_CHANGE_INTERVAL_MS = ONE_DAY_MS; // 24 horas
export const BANK_INTEREST_RATE_MIN = 0.10; // 10%
export const BANK_INTEREST_RATE_MAX = 0.20; // 20%

// El indice 0 no se usa (Nivel 0), el indice 1 es Nivel 1, etc.
export const BANK_LEVEL_CAPACITIES = [
    0, // Nivel 0
    5000000, // Nivel 1: 5M
    10000000, // Nivel 2: 10M
    25000000, // Nivel 3: 25M
    50000000, // Nivel 4: 50M
    75000000, // Nivel 5: 75M
    125000000, // Nivel 6: 125M
    180000000, // Nivel 7: 180M
    250000000, // Nivel 8: 250M
    400000000, // Nivel 9: 400M
    800000000, // Nivel 10: 800M
    1500000000, // Nivel 11: 1.50K Mill
    3500000000, // Nivel 12: 3.50K Mill
    8000000000, // Nivel 13: 8.00K Mill
    20000000000, // Nivel 14: 20.00K Mill
    50000000000 // Nivel 15: 50.00K Mill (50 Bill)
];

// FORMULAS DEL BANCO
export const calculateMaxBankCapacity = (_empirePoints: number, bankLevel: number): number => {
    if (bankLevel <= 0) return 0;
    if (bankLevel < BANK_LEVEL_CAPACITIES.length) {
        return BANK_LEVEL_CAPACITIES[bankLevel];
    }
    return BANK_LEVEL_CAPACITIES[BANK_LEVEL_CAPACITIES.length - 1];
};

export const calculateInterestEarned = (balance: number, rate: number, deltaTimeMs: number): number => {
    if (balance <= 0 || rate <= 0) return 0;
    const timeInDays = deltaTimeMs / ONE_DAY_MS;
    return balance * rate * timeInDays;
};

export const calculateHourlyInterest = (balance: number, rate: number): number => {
    return (balance * rate) / 24;
};

// --- INTERVALOS DE GUARDADO ---
export const CLOUD_SAVE_INTERVAL_MS = 60000; // 60 segundos
export const OFFLINE_SIGNOUT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

export const SAVE_VERSION = 7;

// --- BANDERAS ---
export const AVAILABLE_FLAGS = [
    'US', 'GB', 'DE', 'FR', 'ES', 'BR', 'CN', 'KR', 'JP', 'RU',
    'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO',
    'IT', 'PT', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ',
    'AT', 'CH', 'GR', 'TR', 'UA', 'RO', 'HU', 'IE', 'CA', 'AU',
    'NZ', 'IN', 'PK', 'PH', 'TH', 'VN', 'ID', 'MY', 'SG', 'IL',
    'SA', 'AE', 'EG', 'ZA', 'NG', 'KE', 'MA', 'DO', 'PR', 'CU',
];

// SISTEMA DE REPUTACION
export const REPUTATION_ALLY_THRESHOLD = 75; // Los bots por encima de este valor son aliados (75+)
export const REPUTATION_ENEMY_THRESHOLD = 30; // Los bots por debajo de este valor son enemigos
export const REPUTATION_ATTACK_PENALTY = -20; // Perdida de reputacion cuando el jugador ataca a un bot
export const REPUTATION_DEFEAT_PENALTY = -8; // Perdida de reputacion cuando el jugador derrota a un bot
export const REPUTATION_WIN_BONUS = 8; // Ganancia de reputacion cuando el bot gana contra el jugador (respetan la fuerza)
export const REPUTATION_DEFEND_BONUS = 8; // Ganancia de reputacion cuando el jugador se defiende con exito de un bot
export const REPUTATION_ALLY_DEFEND_CHANCE = 0.4; // 40% de probabilidad de que bots aliados ayuden a defender
export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;

// SISTEMA DE REFUERZOS ALIADOS
export const REINFORCEMENT_RATIO = 0.05; // Los aliados envian el 5% de su presupuesto militar total
export const REINFORCEMENT_CHANCE = 0.15; // 15% de probabilidad de que aliados envien refuerzos cuando atacan al jugador (MODO TEST)

// Limites de score de aliados para refuerzos (evita que ayuden aliados demasiado fuertes)
export const ALLY_REINFORCEMENT_MIN_SCORE = 1000; // Minimo de 1k puntos para enviar refuerzos
export const ALLY_REINFORCEMENT_MAX_RATIO = 1.5; // Maximo 150% del score del jugador

// SISTEMA DE ATAQUE ENEMIGO (NUEVO)
export const ENEMY_ATTACK_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos - revisar si los enemigos atacan
export const ENEMY_ATTACK_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 horas - tiempo minimo entre ataques del mismo bot
export const ENEMY_ATTACK_MAX_PER_BOT = 3; // Maximo de ataques por bot por ciclo de 24h
export const ENEMY_ATTACK_RESET_MS = ONE_DAY_MS; // 24 horas - reinicio del contador de ataques
export const ENEMY_ATTACK_BASE_CHANCE = 0.20; // 20% de probabilidad base de ataque en rep 30
export const ENEMY_ATTACK_CHANCE_MULTIPLIER = 0.015; // +1.5% de probabilidad por punto de rep por debajo de 30
export const ENEMY_ATTACK_POWER_RATIO_MIN = 0.5; // Los bots solo pueden atacar si su poder es >= 50% del jugador
export const ENEMY_ATTACK_POWER_RATIO_LIMIT = 1.5; // Los bots solo pueden atacar si su poder es <= 150% del jugador
export const ENEMY_ATTACK_MAX_SIMULTANEOUS = 6; // Numero maximo de ataques simultaneos que puede recibir el jugador
export const ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS = 5 * 60 * 1000; // 5 minutos entre ataques simultaneos

// Modificadores de probabilidad de ataque por personalidad (para el sistema de ataque enemigo)
export const ENEMY_ATTACK_CHANCE_WARLORD = 1.5; // 50% mas probable que ataque
export const ENEMY_ATTACK_CHANCE_TURTLE = 0.5; // 50% menos probable que ataque
export const ENEMY_ATTACK_CHANCE_TYCOON = 1.0; // Probabilidad normal
export const ENEMY_ATTACK_CHANCE_ROGUE = 1.2; // 20% mas probable (oportunista)

// SISTEMA DE REPRESALIA (ACTUALIZADO)
export const RETALIATION_TIME_MIN_MS = 15 * 60 * 1000; // Minimo 15 minutos
export const RETALIATION_TIME_MAX_MS = 45 * 60 * 1000; // Maximo 45 minutos
export const RETALIATION_GRUDGE_DURATION_MS = ONE_DAY_MS; // 24 horas para mantener rencor

// Multiplicadores de represalia por personalidad (afectan la fuerza del ejercito)
export const RETALIATION_MULTIPLIER_WARLORD = 1.1; // 10% mas fuerte
export const RETALIATION_MULTIPLIER_TURTLE = 1.2; // 20% mas fuerte (deathball)
export const RETALIATION_MULTIPLIER_TYCOON = 1.0; // Fuerza normal
export const RETALIATION_MULTIPLIER_ROGUE = 1.0; // Fuerza normal

// Probabilidad de represalia por personalidad (probabilidad real de que el bot se vengue cuando llegue el momento)
export const RETALIATION_CHANCE_WARLORD = 0.95; // 95% de probabilidad - muy vengativo
export const RETALIATION_CHANCE_TURTLE = 0.85; // 85% de probabilidad - guarda rencor
export const RETALIATION_CHANCE_TYCOON = 0.70; // 70% de probabilidad - ocupado haciendo dinero
export const RETALIATION_CHANCE_ROGUE = 0.90; // 90% de probabilidad - impredecible pero vengativo

// SISTEMA DE DIPLOMACIA
export const REPUTATION_DECAY_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hora
export const REPUTATION_DECAY_AMOUNT = 0.25; // Perdida de reputacion por intervalo de decaimiento
export const REPUTATION_DECAY_MAX_THRESHOLD = 85; // >= 75 no decae
export const REPUTATION_DECAY_BOOST_THRESHOLD = 30; // Por debajo de 30, el decaimiento se acelera
export const REPUTATION_DECAY_MAX_MULTIPLIER = 2.0; // Maximo 2x de decaimiento al estar en 0 rep

export const DIPLOMACY_GIFT_BASE_COST: Partial<Record<string, number>> = {
    MONEY: 50000,
    OIL: 5000,
    AMMO: 200,
    GOLD: 100
};
export const DIPLOMACY_GIFT_COST_SCALE = 50; // Factor de escala base
export const DIPLOMACY_GIFT_COST_MAX_SCALE = 300; // Escala maxima cuando la reputacion <= 40
export const DIPLOMACY_GIFT_COST_REP_THRESHOLD = 40; // Umbral de reputacion para costo aumentado
export const DIPLOMACY_GIFT_REPUTATION_GAIN = 8; // +8 de reputacion por regalo
export const DIPLOMACY_GIFT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora entre regalos al mismo bot
export const DIPLOMACY_ALLIANCE_REP_REQUIREMENT = 50; // Reputacion minima para proponer alianza
export const DIPLOMACY_ALLIANCE_REP_GAIN = 5; // +5 de reputacion por proponer alianza
export const DIPLOMACY_PEACE_PROPOSAL_REP_REQUIREMENT = 10; // Reputacion minima para proponer paz
export const DIPLOMACY_PEACE_REP_GAIN = 10; // +10 de reputacion por propuesta de paz
export const DIPLOMACY_PEACE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // Enfriamiento de 4 horas despues de proponer paz
