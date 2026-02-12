
import { GameState, ResourceType } from '../../../types';
import { ActionResult } from './types';

export const executeSpeedUp = (state: GameState, targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION'): ActionResult => {
    const currentDiamonds = state.resources[ResourceType.DIAMOND] || 0;
    if (currentDiamonds < 1) return { success: false, errorKey: 'missing_diamond' };

    const REDUCTION_MS = 10 * 60 * 1000; // 10 Minutes
    let found = false;
    const newState = { ...state };
    
    if (type === 'BUILD') {
        const index = newState.activeConstructions.findIndex(c => c.id === targetId);
        if (index !== -1) {
            found = true;
            const newConstructions = [...newState.activeConstructions];
            newConstructions[index] = { ...newConstructions[index], endTime: newConstructions[index].endTime - REDUCTION_MS };
            newState.activeConstructions = newConstructions;
        }
    } else if (type === 'RECRUIT') {
        const index = newState.activeRecruitments.findIndex(r => r.id === targetId);
        if (index !== -1) {
            found = true;
            const newRecruitments = [...newState.activeRecruitments];
            newRecruitments[index] = { ...newRecruitments[index], endTime: newRecruitments[index].endTime - REDUCTION_MS };
            newState.activeRecruitments = newRecruitments;
        }
    } else if (type === 'RESEARCH') {
        if (newState.activeResearch && newState.activeResearch.techId === targetId) {
            found = true;
            newState.activeResearch = { ...newState.activeResearch, endTime: newState.activeResearch.endTime - REDUCTION_MS };
        }
    } else if (type === 'MISSION') {
        const index = newState.activeMissions.findIndex(m => m.id === targetId);
        if (index !== -1) {
            found = true;
            const newMissions = [...newState.activeMissions];
            newMissions[index] = { ...newMissions[index], endTime: newMissions[index].endTime - REDUCTION_MS };
            newState.activeMissions = newMissions;
        }
    }

    if (!found) return { success: false };

    newState.resources = { ...newState.resources, [ResourceType.DIAMOND]: currentDiamonds - 1 };
    return { success: true, newState };
};
