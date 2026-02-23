import { useGame } from '../context/GameContext';

export const useGameState = () => {
    const { gameState, setGameState } = useGame();
    
    // We mock a dispatch function that applies actions directly to the state
    const dispatch = (action: any) => {
        setGameState(prev => {
            let newState = { ...prev };
            
            try {
                switch (action.type) {
                    case 'PLAYER_RESPOND_PROPOSAL': {
                        const { playerRespond } = require('../utils/engine/diplomacy');
                        const newDiplomacy = playerRespond(
                            newState.diplomacy || { proposals: {}, treaties: {}, worldEvents: [] },
                            action.payload.proposalId,
                            action.payload.response,
                            action.payload.counterTerms
                        );
                        newState.diplomacy = newDiplomacy;
                        return newState;
                    }
                    case 'PLAYER_SEND_PROPOSAL': {
                        const { playerPropose } = require('../utils/engine/diplomacy');
                        const newDiplomacy = playerPropose(
                            newState.diplomacy || { proposals: {}, treaties: {}, worldEvents: [] },
                            action.payload.targetId,
                            'bot',
                            action.payload.action,
                            action.payload.terms
                        );
                        newState.diplomacy = newDiplomacy;
                        return newState;
                    }
                    case 'PLAYER_JOIN_FACTION': {
                        const { addMemberToFaction } = require('../utils/engine/factions');
                        const faction = newState.factions?.[action.payload.factionId];
                        if (faction) {
                            newState.factions = {
                                ...newState.factions,
                                [action.payload.factionId]: addMemberToFaction(faction, 'player')
                            };
                            newState.playerFactionId = action.payload.factionId;
                        }
                        return newState;
                    }
                    case 'PLAYER_LEAVE_FACTION': {
                        const { removeMemberFromFaction } = require('../utils/engine/factions');
                        const faction = newState.factions?.[action.payload.factionId];
                        if (faction) {
                            newState.factions = {
                                ...newState.factions,
                                [action.payload.factionId]: removeMemberFromFaction(faction, 'player', 'left')
                            };
                            newState.playerFactionId = undefined;
                        }
                        return newState;
                    }
                    case 'PLAYER_CREATE_FACTION': {
                        const id = `faction_${Date.now()}`;
                        newState.factions = {
                            ...(newState.factions || {}),
                            [id]: {
                                id,
                                name: action.payload.name,
                                tag: action.payload.tag,
                                leaderId: 'player',
                                memberIds: [],
                                officerIds: [],
                                color: '#00ffff',
                                ideology: action.payload.ideology,
                                founded: Date.now(),
                                reputation: {},
                                power: 1000,
                                stability: 100,
                                activeWars: [],
                                treasury: { MONEY: 0, OIL: 0, AMMO: 0, GOLD: 0, DIAMOND: 0 },
                                taxRate: 0.1
                            }
                        };
                        newState.playerFactionId = id;
                        return newState;
                    }
                }
            } catch (e) {
                console.error("Error processing AI Action", e);
            }
            return newState;
        });
    };
    
    return { state: gameState, dispatch };
};
