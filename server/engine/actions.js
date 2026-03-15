
import { supabase } from '../db/lib/supabase.js';
import { BUILDING_DEFS } from './buildings.js';
import { TECH_DEFS } from './techs.js';
import { UNIT_DEFS } from './units.js';
import { ResourceType } from './enums.js';

export async function handleBuild(userId, buildingType, amount = 1) {
    // 1. Fetch current state
    const [economyRes, buildingsRes, queueRes] = await Promise.all([
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_buildings').select('*').eq('player_id', userId).eq('building_type', buildingType).single(),
        supabase.from('construction_queue').select('*').eq('player_id', userId)
    ]);

    if (economyRes.error) throw new Error('Player economy not found');
    if (queueRes.data.length >= 3) throw new Error('Construction queue full (max 3)');

    const economy = economyRes.data;
    const currentBuilding = buildingsRes.data || { level: 0, quantity: 0 };
    const def = BUILDING_DEFS[buildingType];

    if (!def) throw new Error('Invalid building type');

    // 2. Calculate next level and cost
    const isQuantity = def.buildMode === 'QUANTITY';
    const currentVal = isQuantity ? currentBuilding.quantity : currentBuilding.level;
    
    // Si es modo QUANTITY, el amount puede ser > 1. Si es LEVEL, siempre es 1 nivel.
    const actualAmount = isQuantity ? amount : 1;
    const targetVal = currentVal + actualAmount;

    if (targetVal > def.maxLevel) throw new Error('Max level reached');

    // Cost calculation
    // En modo QUANTITY, el coste escala por cada unidad comprada.
    let totalCost = { money: 0, oil: 0, ammo: 0 };
    
    for (let i = 0; i < actualAmount; i++) {
        const stepVal = currentVal + i;
        const costMult = Math.pow(def.costMultiplier || 1.1, stepVal);
        totalCost.money += Math.floor((def.baseCost.money || 0) * costMult);
        totalCost.oil += Math.floor((def.baseCost.oil || 0) * costMult);
        totalCost.ammo += Math.floor((def.baseCost.ammo || 0) * costMult);
    }

    // 3. Validate resources
    if (economy.money < totalCost.money || economy.oil < totalCost.oil || economy.ammo < totalCost.ammo) {
        throw new Error('Not enough resources');
    }

    // 4. Atomic deduction and queue insertion
    const { error: subError } = await supabase.rpc('subtract_resources', {
        p_id: userId,
        m: totalCost.money,
        o: totalCost.oil,
        a: totalCost.ammo
    });

    if (subError) throw subError;

    // Time scaling: base build time * amount (o logarítmico si prefieres, aquí lineal)
    const buildTime = isQuantity ? (def.buildTime * actualAmount) : def.buildTime;
    const endTime = Date.now() + buildTime;
    
    const { error: insError } = await supabase.from('construction_queue').insert({
        player_id: userId,
        building_type: buildingType,
        target_level: targetVal, // Para QUANTITY es la nueva cantidad total
        end_time: endTime
    });

    if (insError) {
        await supabase.rpc('add_resources', {
            p_id: userId, m: totalCost.money, o: totalCost.oil, a: totalCost.ammo
        });
        throw insError;
    }

    return { success: true, endTime, targetVal };
}

export async function handleRecruit(userId, unitType, amount) {
    const [economyRes, unitRes, queueRes, techRes] = await Promise.all([
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_units').select('*').eq('player_id', userId).eq('unit_type', unitType).single(),
        supabase.from('unit_queue').select('*').eq('player_id', userId),
        supabase.from('player_research').select('*').eq('player_id', userId)
    ]);

    if (queueRes.data.length >= 5) throw new Error('Unit queue full (max 5)');
    
    const def = UNIT_DEFS[unitType];
    if (!def) throw new Error('Invalid unit type');

    // Check tech requirements
    if (def.reqTech) {
        const tech = techRes.data?.find(r => r.tech_type === def.reqTech);
        if (!tech || tech.level <= 0) throw new Error('Missing required technology');
    }

    const cost = {
        money: (def.cost.money || 0) * amount,
        oil: (def.cost.oil || 0) * amount,
        ammo: (def.cost.ammo || 0) * amount
    };

    const economy = economyRes.data;
    if (economy.money < cost.money || economy.oil < cost.oil || economy.ammo < cost.ammo) {
        throw new Error('Not enough resources');
    }

    const { error: subError } = await supabase.rpc('subtract_resources', {
        p_id: userId, m: cost.money, o: cost.oil, a: cost.ammo
    });

    if (subError) throw subError;

    const endTime = Date.now() + (def.recruitTime * amount);
    const { error: insError } = await supabase.from('unit_queue').insert({
        player_id: userId,
        unit_type: unitType,
        amount: amount,
        end_time: endTime
    });

    if (insError) {
        await supabase.rpc('add_resources', {
            p_id: userId, m: cost.money, o: cost.oil, a: cost.ammo
        });
        throw insError;
    }

    return { success: true, endTime, amount };
}

export async function handleResearch(userId, techType) {
    const [economyRes, techRes, queueRes, univRes] = await Promise.all([
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_research').select('*').eq('player_id', userId).eq('tech_type', techType).single(),
        supabase.from('research_queue').select('*').eq('player_id', userId),
        supabase.from('player_buildings').select('*').eq('player_id', userId).eq('building_type', 'UNIVERSITY').single()
    ]);

    if (queueRes.data.length >= 3) throw new Error('Research queue full (max 3)');

    const def = TECH_DEFS[techType];
    if (!def) throw new Error('Invalid tech type');

    // Check university level
    const univLevel = univRes.data?.level || 0;
    if (univLevel < def.reqUniversityLevel) throw new Error('University level too low');

    const currentTech = techRes.data || { level: 0 };
    const targetLevel = currentTech.level + 1;
    if (targetLevel > (def.maxLevel || 1)) throw new Error('Max level reached');

    const costMult = Math.pow(def.costMultiplier || 2.0, currentTech.level);
    const cost = {
        money: Math.floor((def.cost.money || 0) * costMult),
        oil: Math.floor((def.cost.oil || 0) * costMult),
        ammo: Math.floor((def.cost.ammo || 0) * costMult),
        gold: Math.floor((def.cost.gold || 0) * costMult)
    };

    const economy = economyRes.data;
    if (economy.money < cost.money || economy.oil < cost.oil || economy.ammo < cost.ammo || economy.gold < cost.gold) {
        throw new Error('Not enough resources');
    }

    const { error: subError } = await supabase.rpc('subtract_resources', {
        p_id: userId, m: cost.money, o: cost.oil, a: cost.ammo
    });
    // Gold is handled via direct update if no gold RPC exists
    if (cost.gold > 0) {
        await supabase.from('player_economy').update({ gold: economy.gold - cost.gold }).eq('player_id', userId);
    }

    if (subError) throw subError;

    const endTime = Date.now() + (def.researchTime);
    const { error: insError } = await supabase.from('research_queue').insert({
        player_id: userId,
        tech_type: techType,
        target_level: targetLevel,
        end_time: endTime
    });

    if (insError) {
        await supabase.rpc('add_resources', {
            p_id: userId, m: cost.money, o: cost.oil, a: cost.ammo
        });
        if (cost.gold > 0) {
            await supabase.from('player_economy').update({ gold: economy.gold }).eq('player_id', userId);
        }
        throw insError;
    }

    return { success: true, endTime, targetLevel };
}

export async function handleBankTransaction(userId, amount, type) {
    const { data: economy, error } = await supabase.from('player_economy').select('*').eq('player_id', userId).single();
    if (error) throw error;

    let newMoney = Number(economy.money);
    let newBalance = Number(economy.bank_balance);

    if (type === 'deposit') {
        if (newMoney < amount) throw new Error('Not enough money');
        newMoney -= amount;
        newBalance += amount;
    } else {
        if (newBalance < amount) throw new Error('Not enough in bank');
        newMoney += amount;
        newBalance -= amount;
    }

    const { error: updError } = await supabase.from('player_economy').update({
        money: newMoney,
        bank_balance: newBalance
    }).eq('player_id', userId);

    if (updError) throw updError;
    return { success: true, newMoney, newBalance };
}

export async function handleRepair(userId, buildingType) {
    const { data: building, error } = await supabase.from('player_buildings').select('*').eq('player_id', userId).eq('building_type', buildingType).single();
    if (error) throw error;
    if (!building.is_damaged && !building.isDamaged) return { success: true }; // Already repaired

    // Cost to repair could be fixed or based on level
    const cost = 5000; 

    const { error: subError } = await supabase.rpc('subtract_resources', {
        p_id: userId, m: cost, o: 0, a: 0
    });
    if (subError) throw subError;

    await supabase.from('player_buildings').update({ is_damaged: false }).eq('player_id', userId).eq('building_type', buildingType);
    
    return { success: true };
}

export async function handleDiamondExchange(userId, targetResource, amount) {
    const { data: economy, error } = await supabase.from('player_economy').select('*').eq('player_id', userId).single();
    if (error) throw error;

    const DIAMOND_COST = 1; // 1 Diamond for X resources
    const EXCHANGE_RATES = {
        MONEY: 1000000,
        OIL: 50000,
        AMMO: 100000,
        GOLD: 5000
    };

    if (economy.diamond < amount) throw new Error('Not enough diamonds');

    const gain = (EXCHANGE_RATES[targetResource] || 0) * amount;
    if (gain <= 0) throw new Error('Invalid target resource');

    const updateData = {
        diamond: economy.diamond - amount,
        [targetResource.toLowerCase()]: Number(economy[targetResource.toLowerCase()] || 0) + gain
    };

    const { error: updError } = await supabase.from('player_economy').update(updateData).eq('player_id', userId);
    if (updError) throw updError;

    return { success: true, newDiamonds: updateData.diamond };
}
