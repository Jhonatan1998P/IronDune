
import { BotPersonality, UnitType } from '../../types/enums';
import { GameState, Grudge, IncomingAttack, LogEntry } from '../../types';
import { PVP_TRAVEL_TIME_MS, NEWBIE_PROTECTION_THRESHOLD, REPUTATION_ALLY_THRESHOLD, REPUTATION_ENEMY_THRESHOLD } from '../../constants';
import { generateBotArmy } from './missions';

const RETALIATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Hours to hold a grudge
const NOTIFICATION_LEAD_TIME_MS = 10 * 60 * 1000; // 10 Minutes warning before attack launch if planned

// --- HELPER: CALCULATE RETALIATION TIME ---
// Determina cuándo atacará el bot basándose en su personalidad.
export const calculateRetaliationTime = (personality: BotPersonality, now: number): number => {
    // Random buffer to avoid all attacking instantly
    const shortBuffer = (5 + Math.random() * 25) * 60 * 1000; // 5-30 mins
    const mediumBuffer = (1 + Math.random() * 3) * 60 * 60 * 1000; // 1-4 hours
    const longBuffer = (4 + Math.random() * 12) * 60 * 60 * 1000; // 4-16 hours

    switch (personality) {
        case BotPersonality.WARLORD:
            // Aggressive: Strikes back quickly while the "iron is hot"
            return now + shortBuffer;
        
        case BotPersonality.TURTLE:
            // Defensive: Takes time to rebuild army, then strikes (reduced from 4-16h to 2-6h)
            const turtleBuffer = (2 + Math.random() * 4) * 60 * 60 * 1000; // 2-6 hours
            return now + turtleBuffer;
        
        case BotPersonality.TYCOON:
            // Economic: Hires mercenaries (simulated by standard attack) but delayed
            return now + mediumBuffer;
        
        case BotPersonality.ROGUE:
            // Unpredictable: Can be instant or very late
            return Math.random() > 0.5 ? now + shortBuffer : now + longBuffer;
            
        default:
            return now + mediumBuffer;
    }
};

// --- HELPER: CREATE INCOMING ATTACK ---
const launchRetaliation = (grudge: Grudge, now: number): IncomingAttack => {
    const arrivalTime = now + PVP_TRAVEL_TIME_MS;
    
    // Personality affects fleet composition via generateBotArmy multiplier
    let multiplier = 1.0;
    if (grudge.botPersonality === BotPersonality.WARLORD) multiplier = 1.3;
    if (grudge.botPersonality === BotPersonality.TURTLE) multiplier = 1.5; // Turtles send massive "Deathballs"

    const units = generateBotArmy(grudge.botScore, multiplier, grudge.botPersonality);

    return {
        id: `retal-${grudge.id}-${now}`,
        attackerName: grudge.botName,
        attackerScore: grudge.botScore,
        units,
        startTime: now,
        endTime: arrivalTime,
        isWarWave: false,
        delayCount: 0
    };
};

// --- MAIN LOOP: PROCESS GRUDGES ---
export const processNemesisTick = (state: GameState, now: number): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    if (!state.grudges || state.grudges.length === 0) return { stateUpdates: {}, logs: [] };

    const logs: LogEntry[] = [];
    const remainingGrudges: Grudge[] = [];
    const newIncomingAttacks: IncomingAttack[] = [...state.incomingAttacks];
    
    // Check if player is protected
    const isNewbie = state.empirePoints < NEWBIE_PROTECTION_THRESHOLD;
    const isCoolingDown = state.nextAttackTime > now;
    const isProtected = isNewbie || isCoolingDown;

    state.grudges.forEach(grudge => {
        // 1. Expire old grudges (Extended to 48h to ensure vengeance happens)
        if (now > grudge.createdAt + (RETALIATION_WINDOW_MS * 2)) {
            // Grudge forgotten
            return; 
        }

        // Bots with "Vengeance" in mind will ignore protection if enough time has passed
        const forceAttack = now > grudge.retaliationTime + (12 * 60 * 60 * 1000);

        // 2. Logic: Wake-Up Call (Protection Active)
        if (isProtected && !forceAttack) {
            // If retaliation time has passed BUT player is protected,
            // we reschedule the attack for EXACTLY when protection ends (plus a small random jitter).
            // This creates the "Wake-Up Call" effect where attacks land right after shield drop.
            
            const protectionEnd = Math.max(state.nextAttackTime, now); // If newbie, undefined end, but logic handles it
            
            if (grudge.retaliationTime <= now) {
                // Reschedule to future
                const jitter = Math.random() * 5 * 60 * 1000; // 0-5 mins jitter
                // If it's cooldown protection, target end time. If newbie, just push back 1 hour.
                const newTarget = isCoolingDown ? (state.nextAttackTime + jitter) : (now + 3600000);
                
                grudge.retaliationTime = newTarget;
                
                // NOTIFICATION LOGIC
                if (!grudge.notified) {
                    logs.push({
                        id: `intel-warn-${grudge.id}`,
                        messageKey: 'log_grudge_planning',
                        type: 'intel',
                        timestamp: now,
                        params: { attacker: grudge.botName }
                    });
                    grudge.notified = true;
                }
            }
            remainingGrudges.push(grudge);
            return;
        }

        // 3. Logic: Active Retaliation (No Protection)
        if (now >= grudge.retaliationTime) {
            // Check bot's reputation to determine attack probability
            const bot = state.rankingData.bots.find(b => b.id === grudge.botId);
            const reputation = bot?.reputation ?? 50;
            
            let attackChance = 0.8; // Default 80% for neutral bots
            if (reputation >= REPUTATION_ALLY_THRESHOLD) {
                attackChance = 0.3; // Allies only 30% likely to follow through
            } else if (reputation < REPUTATION_ENEMY_THRESHOLD) {
                attackChance = 1.0; // Enemies always follow through
            }
            
            if (Math.random() > attackChance) {
                // Bot forgives - reputation improves slightly
                logs.push({
                    id: `grudge-forgive-${grudge.id}`,
                    messageKey: 'log_grudge_forgiven',
                    type: 'info',
                    timestamp: now,
                    params: { attacker: grudge.botName }
                });
                return; // Grudge removed, bot decides not to attack
            }
            
            // ATTACK LAUNCH
            const attack = launchRetaliation(grudge, now);
            newIncomingAttacks.push(attack);
            
            logs.push({
                id: `retal-launch-${grudge.id}`,
                messageKey: 'alert_incoming',
                type: 'combat',
                timestamp: now,
                params: { attacker: grudge.botName }
            });
            
            // Grudge is satisfied and removed
            return; 
        }

        // 4. Pre-Attack Notification (10 mins before)
        if (!grudge.notified && (grudge.retaliationTime - now <= NOTIFICATION_LEAD_TIME_MS)) {
             logs.push({
                id: `intel-imm-${grudge.id}`,
                messageKey: 'log_grudge_imminent',
                type: 'intel',
                timestamp: now,
                params: { attacker: grudge.botName }
            });
            grudge.notified = true;
        }

        remainingGrudges.push(grudge);
    });

    // Only return updates if changes occurred
    if (remainingGrudges.length !== state.grudges.length || newIncomingAttacks.length !== state.incomingAttacks.length || logs.length > 0) {
        return {
            stateUpdates: {
                grudges: remainingGrudges,
                incomingAttacks: newIncomingAttacks
            },
            logs
        };
    }

    return { stateUpdates: {}, logs: [] };
};
