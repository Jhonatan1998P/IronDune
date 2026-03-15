import { describe, it, expect } from 'vitest';
import { calculateConstructionCost, calculateMaxAffordableBuildings } from '../utils/formulas';
import { BUILDING_DEFS } from '../data/buildings';
import { BuildingType, ResourceType } from '../types';

describe('Building Cost Calculations', () => {
    describe('QUANTITY Mode Buildings (House, Factory, Oil Rig, etc.)', () => {
        it('should calculate exponentially increasing cost per unit in batch', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];
            // Base cost: 1000 money, multiplier: 1.015
            // Formula: cada edificio cuesta baseCost × (multiplier ^ (startLevel + i))

            // Building 1 house at level 0: 1000 × 1.015^1 = 1015 (floor de 1015.0)
            const cost1 = calculateConstructionCost(houseDef, 0, 1);

            // Building 2 houses at level 0: 1000 × 1.015^1 + 1000 × 1.015^2
            const cost2 = calculateConstructionCost(houseDef, 0, 2);

            // Building 5 houses at level 0
            const cost5 = calculateConstructionCost(houseDef, 0, 5);

            expect(cost1.money).toBe(Math.floor(1000 * Math.pow(1.015, 1)));
            expect(cost2.money).toBe(Math.floor(1000 * Math.pow(1.015, 1)) + Math.floor(1000 * Math.pow(1.015, 2)));
            expect(cost5.money).toBe(
                Math.floor(1000 * Math.pow(1.015, 1)) + // 1st
                Math.floor(1000 * Math.pow(1.015, 2)) + // 2nd
                Math.floor(1000 * Math.pow(1.015, 3)) + // 3rd
                Math.floor(1000 * Math.pow(1.015, 4)) + // 4th
                Math.floor(1000 * Math.pow(1.015, 5))   // 5th
            );
        });

        it('should apply multiplier based on owned quantity and batch position', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];

            // Building 1 house when you already own 100 (level 100)
            // Cost: 1000 × 1.015^(100+1) = 1000 × 1.015^101
            const costAt100 = calculateConstructionCost(houseDef, 100, 1);

            // Building 10 houses when you already own 100 (level 100)
            // Costs: 1000 × 1.015^101 + 1000 × 1.015^102 + ... + 1000 × 1.015^110
            const cost10At100 = calculateConstructionCost(houseDef, 100, 10);

            const expectedUnitCost = Math.floor(1000 * Math.pow(1.015, 101));
            let expectedTotalCost = 0;
            for (let i = 1; i <= 10; i++) {
                expectedTotalCost += Math.floor(1000 * Math.pow(1.015, 100 + i));
            }

            expect(costAt100.money).toBe(expectedUnitCost);
            expect(cost10At100.money).toBe(expectedTotalCost);
        });

        it('should calculate costs correctly for 100 houses at level 0', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];

            // Building 100 houses at level 0: sum of 1000 × 1.015^i for i from 1 to 100
            const cost100 = calculateConstructionCost(houseDef, 0, 100);

            let expectedCost = 0;
            for (let i = 1; i <= 100; i++) {
                expectedCost += Math.floor(1000 * Math.pow(1.015, i));
            }

            expect(cost100.money).toBe(expectedCost);
        });

        it('should calculate costs correctly for Oil Rig', () => {
            const oilRigDef = BUILDING_DEFS[BuildingType.OIL_RIG];
            // Base cost: 8000 money, 2000 ammo, multiplier: 1.015

            const cost1 = calculateConstructionCost(oilRigDef, 0, 1);
            const cost10 = calculateConstructionCost(oilRigDef, 0, 10);

            // 1st Oil Rig: costs based on 1.015^1
            expect(cost1.money).toBe(Math.floor(8000 * Math.pow(1.015, 1)));
            expect(cost1.ammo).toBe(Math.floor(2000 * Math.pow(1.015, 1)));

            // 10 Oil Rigs: sum of costs for each
            let expectedMoney = 0;
            let expectedAmmo = 0;
            for (let i = 1; i <= 10; i++) {
                expectedMoney += Math.floor(8000 * Math.pow(1.015, i));
                expectedAmmo += Math.floor(2000 * Math.pow(1.015, i));
            }
            expect(cost10.money).toBe(expectedMoney);
            expect(cost10.ammo).toBe(expectedAmmo);
        });

        it('should calculate costs correctly for Factory', () => {
            const factoryDef = BUILDING_DEFS[BuildingType.FACTORY];
            // Base cost: 20000 money, 1000 oil, multiplier: 1.015

            const cost1 = calculateConstructionCost(factoryDef, 0, 1);
            const cost5 = calculateConstructionCost(factoryDef, 0, 5);

            // 1st Factory: costs based on 1.015^1
            expect(cost1.money).toBe(Math.floor(20000 * Math.pow(1.015, 1)));
            expect(cost1.oil).toBe(Math.floor(1000 * Math.pow(1.015, 1)));

            // 5 Factories: sum of costs for each
            let expectedMoney = 0;
            let expectedOil = 0;
            for (let i = 1; i <= 5; i++) {
                expectedMoney += Math.floor(20000 * Math.pow(1.015, i));
                expectedOil += Math.floor(1000 * Math.pow(1.015, i));
            }
            expect(cost5.money).toBe(expectedMoney);
            expect(cost5.oil).toBe(expectedOil);
        });
    });

    describe('LEVEL Mode Buildings (Bank, Market, University, etc.)', () => {
        it('should calculate exponentially increasing costs for Market upgrades', () => {
            const marketDef = BUILDING_DEFS[BuildingType.MARKET];
            // Base cost: 25000 money, multiplier: 1.50
            
            // Level 0 -> 1
            const cost1 = calculateConstructionCost(marketDef, 0, 1);
            
            // Level 1 -> 2 (should cost more)
            const cost2 = calculateConstructionCost(marketDef, 1, 1);
            
            // Level 2 -> 3 (should cost even more)
            const cost3 = calculateConstructionCost(marketDef, 2, 1);
            
            expect(cost1.money).toBe(25000); // 25000 × 1.50^0
            expect(cost2.money).toBe(37500); // 25000 × 1.50^1
            expect(cost3.money).toBe(56250); // 25000 × 1.50^2
        });

        it('should calculate Bank costs based on capacity table', () => {
            const bankDef = BUILDING_DEFS[BuildingType.BANK];
            
            // Level 0 -> 1 (10% of 5,000,000 capacity)
            const cost1 = calculateConstructionCost(bankDef, 0, 1);
            
            // Level 1 -> 2 (10% of 10,000,000 capacity)
            const cost2 = calculateConstructionCost(bankDef, 1, 1);
            
            expect(cost1.money).toBe(500000); // 10% of 5M
            expect(cost2.money).toBe(1000000); // 10% of 10M
        });
    });

    describe('calculateMaxAffordableBuildings', () => {
        it('should calculate max affordable houses correctly', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];
            const resources = {
                [ResourceType.MONEY]: 50000,
                [ResourceType.OIL]: 0,
                [ResourceType.AMMO]: 0,
                [ResourceType.GOLD]: 0,
                [ResourceType.DIAMOND]: 0
            };

            // At level 0, each house costs exponentially: 1000 × 1.015^1, 1000 × 1.015^2, etc.
            // We need to find how many houses can be afforded with 50000
            const maxAffordable = calculateMaxAffordableBuildings(houseDef, 0, resources);

            // Calculate expected max by summing costs until we exceed budget
            let totalCost = 0;
            let expectedMax = 0;
            for (let i = 1; i <= 100; i++) {
                const cost = Math.floor(1000 * Math.pow(1.015, i));
                if (totalCost + cost <= 50000) {
                    totalCost += cost;
                    expectedMax++;
                } else {
                    break;
                }
            }

            expect(maxAffordable).toBe(expectedMax);
        });

        it('should calculate max affordable houses at higher level', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];
            const resources = {
                [ResourceType.MONEY]: 100000,
                [ResourceType.OIL]: 0,
                [ResourceType.AMMO]: 0,
                [ResourceType.GOLD]: 0,
                [ResourceType.DIAMOND]: 0
            };

            // At level 100, each house costs: 1000 × 1.015^(100+i) for i=1,2,3...
            const maxAffordable = calculateMaxAffordableBuildings(houseDef, 100, resources);

            // Calculate expected max by summing costs until we exceed budget
            let totalCost = 0;
            let expectedMax = 0;
            for (let i = 1; i <= 100; i++) {
                const cost = Math.floor(1000 * Math.pow(1.015, 100 + i));
                if (totalCost + cost <= 100000) {
                    totalCost += cost;
                    expectedMax++;
                } else {
                    break;
                }
            }

            expect(maxAffordable).toBe(expectedMax);
        });

        it('should respect all resource types for Factory', () => {
            const factoryDef = BUILDING_DEFS[BuildingType.FACTORY];
            const resources = {
                [ResourceType.MONEY]: 100000,
                [ResourceType.OIL]: 4000, // Limits factories
                [ResourceType.AMMO]: 0,
                [ResourceType.GOLD]: 0,
                [ResourceType.DIAMOND]: 0
            };

            // Each factory costs exponentially: 20000 × 1.015^i for money, 1000 × 1.015^i for oil
            // Find max affordable limited by both resources
            const maxAffordable = calculateMaxAffordableBuildings(factoryDef, 0, resources);

            // Calculate expected max by summing costs until we exceed budget for either resource
            let totalMoney = 0;
            let totalOil = 0;
            let expectedMax = 0;
            for (let i = 1; i <= 100; i++) {
                const moneyCost = Math.floor(20000 * Math.pow(1.015, i));
                const oilCost = Math.floor(1000 * Math.pow(1.015, i));
                if (totalMoney + moneyCost <= 100000 && totalOil + oilCost <= 4000) {
                    totalMoney += moneyCost;
                    totalOil += oilCost;
                    expectedMax++;
                } else {
                    break;
                }
            }

            expect(maxAffordable).toBe(expectedMax);
        });
    });

    describe('Edge Cases', () => {
        it('should handle building 0 amount', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];
            const cost = calculateConstructionCost(houseDef, 0, 0);
            
            expect(cost.money).toBe(0);
            expect(cost.oil).toBe(0);
            expect(cost.ammo).toBe(0);
        });

        it('should handle very large quantities', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];
            const cost100 = calculateConstructionCost(houseDef, 0, 100);

            // Calculate expected cost as sum of 1000 × 1.015^i for i from 1 to 100
            let expectedCost = 0;
            for (let i = 1; i <= 100; i++) {
                expectedCost += Math.floor(1000 * Math.pow(1.015, i));
            }

            expect(cost100.money).toBe(expectedCost);
        });

        it('should calculate Gold Mine costs correctly', () => {
            const goldMineDef = BUILDING_DEFS[BuildingType.GOLD_MINE];
            // Base: 15000 money, 500 oil, 1500 ammo, multiplier: 1.015

            const cost1 = calculateConstructionCost(goldMineDef, 0, 1);
            const cost10 = calculateConstructionCost(goldMineDef, 0, 10);

            // 1st Gold Mine: costs based on 1.015^1
            expect(cost1.money).toBe(Math.floor(15000 * Math.pow(1.015, 1)));
            expect(cost1.oil).toBe(Math.floor(500 * Math.pow(1.015, 1)));
            expect(cost1.ammo).toBe(Math.floor(1500 * Math.pow(1.015, 1)));

            // 10 Gold Mines: sum of costs for each
            let expectedMoney = 0;
            let expectedOil = 0;
            let expectedAmmo = 0;
            for (let i = 1; i <= 10; i++) {
                expectedMoney += Math.floor(15000 * Math.pow(1.015, i));
                expectedOil += Math.floor(500 * Math.pow(1.015, i));
                expectedAmmo += Math.floor(1500 * Math.pow(1.015, i));
            }
            expect(cost10.money).toBe(expectedMoney);
            expect(cost10.oil).toBe(expectedOil);
            expect(cost10.ammo).toBe(expectedAmmo);
        });

        it('should match exponential cost formula: baseCost × (1.015 ^ position) for each building', () => {
            const houseDef = BUILDING_DEFS[BuildingType.HOUSE];

            // Building 100 houses at level 0
            // Each house costs: 1000 × 1.015^i for i from 1 to 100
            let expectedCost100at0 = 0;
            for (let i = 1; i <= 100; i++) {
                expectedCost100at0 += Math.floor(1000 * Math.pow(1.015, i));
            }
            const cost100at0 = calculateConstructionCost(houseDef, 0, 100);
            expect(cost100at0.money).toBe(expectedCost100at0);

            // Building 1 house at level 100
            // Cost: 1000 × 1.015^(100+1) = 1000 × 1.015^101
            const cost1at100 = calculateConstructionCost(houseDef, 100, 1);
            expect(cost1at100.money).toBe(Math.floor(1000 * Math.pow(1.015, 101)));

            // Building 10 houses at level 100
            // Costs: 1000 × 1.015^101 + 1000 × 1.015^102 + ... + 1000 × 1.015^110
            let expectedCost10at100 = 0;
            for (let i = 1; i <= 10; i++) {
                expectedCost10at100 += Math.floor(1000 * Math.pow(1.015, 100 + i));
            }
            const cost10at100 = calculateConstructionCost(houseDef, 100, 10);
            expect(cost10at100.money).toBe(expectedCost10at100);
        });
    });
});
