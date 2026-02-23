
import { BuildingType, ResourceType, TechType, TutorialStep, UnitType } from "../types";

// Helper to calculate progress percentage (0-100)
const calculateProgress = (startTime: number, endTime: number): number => {
    const now = Date.now();
    const duration = endTime - startTime;
    if (duration <= 0) return 100;
    const elapsed = now - startTime;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
};

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'tut_welcome',
        titleKey: 'welcome_title',
        descKey: 'welcome_desc',
        targetTab: 'buildings',
        reward: { [ResourceType.MONEY]: 2000 },
        condition: () => true, 
        targetElementId: undefined
    },
    {
        id: 'tut_build_house',
        titleKey: 'build_house',
        descKey: 'build_house_desc',
        targetTab: 'buildings',
        targetElementId: `btn-build-${BuildingType.HOUSE}`,
        reward: { [ResourceType.MONEY]: 12000 }, // Funds Oil Rig
        buildingReward: { [BuildingType.HOUSE]: 2 }, // Grant 2 extra houses
        progressCondition: (state) => {
            const task = state.activeConstructions.find(c => c.buildingType === BuildingType.HOUSE);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.buildings[BuildingType.HOUSE].level >= 1
    },
    {
        id: 'tut_build_oil',
        titleKey: 'build_oil',
        descKey: 'build_oil_desc',
        targetTab: 'buildings',
        targetElementId: `btn-build-${BuildingType.OIL_RIG}`,
        reward: { [ResourceType.MONEY]: 12000, [ResourceType.OIL]: 500 }, // Funds Munitions
        buildingReward: { [BuildingType.OIL_RIG]: 1 }, // Grant 1 extra rig
        progressCondition: (state) => {
            const task = state.activeConstructions.find(c => c.buildingType === BuildingType.OIL_RIG);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.buildings[BuildingType.OIL_RIG].level >= 1
    },
    {
        id: 'tut_build_ammo',
        titleKey: 'build_ammo', // Needs localization key
        descKey: 'build_ammo_desc', // Needs localization key
        targetTab: 'buildings',
        targetElementId: `btn-build-${BuildingType.MUNITIONS_FACTORY}`,
        reward: { [ResourceType.MONEY]: 20000, [ResourceType.AMMO]: 1000 }, // Funds Gold
        buildingReward: { [BuildingType.MUNITIONS_FACTORY]: 1 },
        progressCondition: (state) => {
            const task = state.activeConstructions.find(c => c.buildingType === BuildingType.MUNITIONS_FACTORY);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.buildings[BuildingType.MUNITIONS_FACTORY].level >= 1
    },
    {
        id: 'tut_build_gold',
        titleKey: 'build_gold', // Needs localization key
        descKey: 'build_gold_desc', // Needs localization key
        targetTab: 'buildings',
        targetElementId: `btn-build-${BuildingType.GOLD_MINE}`,
        reward: { [ResourceType.MONEY]: 50000, [ResourceType.OIL]: 5000 }, // Funds University
        buildingReward: { [BuildingType.GOLD_MINE]: 1 },
        progressCondition: (state) => {
            const task = state.activeConstructions.find(c => c.buildingType === BuildingType.GOLD_MINE);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.buildings[BuildingType.GOLD_MINE].level >= 1
    },
    {
        id: 'tut_build_university',
        titleKey: 'build_university',
        descKey: 'build_university_desc',
        targetTab: 'buildings',
        targetElementId: `btn-build-${BuildingType.UNIVERSITY}`,
        reward: { [ResourceType.AMMO]: 2000, [ResourceType.OIL]: 2000 },
        progressCondition: (state) => {
            const task = state.activeConstructions.find(c => c.buildingType === BuildingType.UNIVERSITY);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.buildings[BuildingType.UNIVERSITY].level >= 1
    },
    {
        id: 'tut_research_basic',
        titleKey: 'research_basic',
        descKey: 'research_basic_desc',
        targetTab: 'research',
        targetElementId: `btn-research-${TechType.BASIC_TRAINING}`,
        reward: { [ResourceType.MONEY]: 30000, [ResourceType.AMMO]: 1000 }, // Funds Barracks
        progressCondition: (state) => {
            const task = state.activeResearch?.techId === TechType.BASIC_TRAINING ? state.activeResearch : null;
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.researchedTechs.includes(TechType.BASIC_TRAINING)
    },
    {
        id: 'tut_build_barracks',
        titleKey: 'build_barracks',
        descKey: 'build_barracks_desc',
        targetTab: 'buildings',
        targetElementId: `btn-build-${BuildingType.BARRACKS}`,
        reward: { [ResourceType.AMMO]: 500, [ResourceType.OIL]: 500 },
        buildingReward: { [BuildingType.BARRACKS]: 1 }, // Upgrade boost
        progressCondition: (state) => {
            const task = state.activeConstructions.find(c => c.buildingType === BuildingType.BARRACKS);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.buildings[BuildingType.BARRACKS].level >= 1
    },
    {
        id: 'tut_unlock_soldier',
        titleKey: 'unlock_soldier',
        descKey: 'unlock_soldier_desc',
        targetTab: 'research',
        targetElementId: `btn-research-${TechType.UNLOCK_CYBER_MARINE}`,
        reward: { [ResourceType.MONEY]: 50000, [ResourceType.AMMO]: 2000 }, // Funds Recruitment
        progressCondition: (state) => {
            const task = state.activeResearch?.techId === TechType.UNLOCK_CYBER_MARINE ? state.activeResearch : null;
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.researchedTechs.includes(TechType.UNLOCK_CYBER_MARINE)
    },
    {
        id: 'tut_recruit_soldier',
        titleKey: 'recruit_soldier',
        descKey: 'recruit_soldier_desc',
        targetTab: 'units',
        targetElementId: `btn-recruit-${UnitType.CYBER_MARINE}`,
        reward: { [ResourceType.OIL]: 1000 },
        unitReward: { [UnitType.CYBER_MARINE]: 5 }, // Grant a squad
        progressCondition: (state) => {
            const task = state.activeRecruitments.find(r => r.unitType === UnitType.CYBER_MARINE);
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.units[UnitType.CYBER_MARINE] >= 1
    },
    {
        id: 'tut_patrol',
        titleKey: 'patrol_mission',
        descKey: 'patrol_mission_desc',
        targetTab: 'missions',
        targetElementId: `btn-start-patrol`,
        reward: { [ResourceType.GOLD]: 100, [ResourceType.DIAMOND]: 1 },
        progressCondition: (state) => {
            const task = state.activeMissions.find(m => m.type === 'PATROL');
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.activeMissions.length > 0 
    },
    {
        id: 'tut_campaign',
        titleKey: 'campaign_mission',
        descKey: 'campaign_mission_desc',
        targetTab: 'campaign',
        targetElementId: 'btn-campaign-level-1',
        reward: { [ResourceType.MONEY]: 100000, [ResourceType.GOLD]: 50 },
        progressCondition: (state) => {
            const task = state.activeMissions.find(m => m.type === 'CAMPAIGN_ATTACK');
            return task ? calculateProgress(task.startTime, task.endTime) : false;
        },
        condition: (state) => state.campaignProgress > 1,
        getTargetElementId: (state) => {
            const hasUnits = Object.values(state.units).some(count => count > 0);
            if (hasUnits) {
                return 'btn-campaign-attack';
            }
            return undefined;
        }
    }
];
