
import { UNIT_DEFS } from '../../data/units';
import { MarketEvent, MarketOffer, ResourceType, UnitType } from '../../types';

// --- CONFIGURACIÓN DEL MERCADO ---

// Cantidades base por oferta (Aumentadas +50% para mayor liquidez)
const BASE_OFFER_AMOUNTS: Partial<Record<ResourceType, number>> = {
    [ResourceType.OIL]: 3750,  // Base 2500 -> 3750
    [ResourceType.AMMO]: 7500, // Base 5000 -> 7500
    [ResourceType.GOLD]: 1500  // Base 1000 -> 1500
};
const DEFAULT_OFFER_AMOUNT = 1000;

// Configuración de Precios Base
export const BASE_PRICES: Record<ResourceType, number> = {
    [ResourceType.MONEY]: 1,
    [ResourceType.GOLD]: 40,
    [ResourceType.OIL]: 10,
    [ResourceType.AMMO]: 5,
    [ResourceType.DIAMOND]: 10000 // Very high nominal price
};

// Definición de Eventos Aleatorios
const MARKET_EVENTS: Omit<MarketEvent, 'duration'>[] = [
    {
        id: 'evt_stable',
        nameKey: 'evt_stable',
        descriptionKey: 'evt_stable_desc',
        priceModifiers: {}
    },
    {
        id: 'evt_war',
        nameKey: 'evt_war',
        descriptionKey: 'evt_war_desc',
        priceModifiers: { [ResourceType.OIL]: 1.5, [ResourceType.AMMO]: 1.8, [ResourceType.GOLD]: 1.2 }
    },
    {
        id: 'evt_peace',
        nameKey: 'evt_peace',
        descriptionKey: 'evt_peace_desc',
        priceModifiers: { [ResourceType.AMMO]: 0.5, [ResourceType.OIL]: 0.8 }
    },
    {
        id: 'evt_crash',
        nameKey: 'evt_crash',
        descriptionKey: 'evt_crash_desc',
        priceModifiers: { [ResourceType.GOLD]: 0.6, [ResourceType.OIL]: 0.5, [ResourceType.AMMO]: 0.6 }
    },
    {
        id: 'evt_boom',
        nameKey: 'evt_boom',
        descriptionKey: 'evt_boom_desc',
        priceModifiers: { [ResourceType.GOLD]: 1.5, [ResourceType.OIL]: 1.3, [ResourceType.AMMO]: 1.3 }
    },
    {
        id: 'evt_drought',
        nameKey: 'evt_drought',
        descriptionKey: 'evt_drought_desc',
        priceModifiers: { [ResourceType.OIL]: 1.8 }
    }
];

/**
 * Calculates the amount of a target resource obtained for 1 Diamond.
 * Centralized logic used by both UI (View) and Engine (Action).
 */
export const calculateDiamondExchangeRate = (
    targetResource: ResourceType, 
    empirePoints: number, 
    activeEvent: MarketEvent | null
): number => {
    // Base Value Calculation: Empire Points * 100 (Minimum 1 point safety)
    const safePoints = Math.max(1, empirePoints || 0);
    const moneyPerDiamond = safePoints * 100;

    if (targetResource === ResourceType.MONEY) {
        return Math.floor(moneyPerDiamond);
    }

    // Calculate dynamic price based on Base + Event Modifiers
    const basePrice = BASE_PRICES[targetResource] || 10; 
    let modifier = 1.0;
    
    if (activeEvent && activeEvent.priceModifiers[targetResource]) {
        modifier = activeEvent.priceModifiers[targetResource] || 1.0;
    }
    
    const currentPrice = basePrice * modifier;
    
    // Safety check to prevent division by zero
    if (currentPrice <= 0) return 0;

    return Math.floor(moneyPerDiamond / currentPrice);
};

export const generateMarketState = (empirePoints: number, marketLevel: number): { offers: MarketOffer[], event: MarketEvent, nextRefresh: number } => {
    // 1. Seleccionar Evento
    // Peso mayor para 'stable' (40% probabilidad)
    const eventPool = [...MARKET_EVENTS, ...MARKET_EVENTS, MARKET_EVENTS[0], MARKET_EVENTS[0]];
    const template = eventPool[Math.floor(Math.random() * eventPool.length)];
    
    // Duración aleatoria entre 30 y 120 minutos
    const durationMinutes = 30 + Math.floor(Math.random() * 91);
    const event: MarketEvent = { ...template, duration: durationMinutes * 60 * 1000 };
    
    // 2. Generar Configuración de Ofertas 
    // Regla: Base 3 ofertas + 1 por cada nivel del edificio Mercado
    const offers: MarketOffer[] = [];
    const resources = [ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD];
    
    // Scaling Factor: Aumenta la cantidad de recursos por oferta según el tamaño del imperio
    // Fórmula: 1 + (Puntos / 50)
    const scalingFactor = 1 + (empirePoints / 50); 

    // Determinar cantidad total de "slots" de ofertas basada en nivel del mercado
    const numOffers = 3 + Math.max(1, marketLevel);

    // Definir tipos con distribución 70/30 FAVORABLE A VENTA DEL JUGADOR
    // TYPE 'SELL' = El Jugador Vende (El Mercado Compra) -> Favorecer esto (70%)
    // TYPE 'BUY' = El Jugador Compra (El Mercado Vende) -> Resto (30%)
    const offerTypes: ('BUY' | 'SELL')[] = [];
    
    let countPlayerSell = Math.round(numOffers * 0.7);
    let countPlayerBuy = numOffers - countPlayerSell;

    // CONSTRAINT: Asegurar al menos 1 oferta de COMPRA (Jugador compra del mercado)
    if (countPlayerBuy < 1) {
        countPlayerBuy = 1;
        countPlayerSell = numOffers - 1;
    }
    // Safety check: Asegurar al menos 1 oferta de VENTA
    if (countPlayerSell < 1) {
        countPlayerSell = 1;
        countPlayerBuy = numOffers - 1;
    }

    // Llenar el array de tipos
    for (let i = 0; i < countPlayerBuy; i++) offerTypes.push('BUY');
    for (let i = 0; i < countPlayerSell; i++) offerTypes.push('SELL');

    // Barajar para que BUY/SELL no estén siempre agrupados
    for (let i = offerTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [offerTypes[i], offerTypes[j]] = [offerTypes[j], offerTypes[i]];
    }

    // 3. Generar las ofertas
    offerTypes.forEach((type, index) => {
        const res = resources[Math.floor(Math.random() * resources.length)];
        
        // Calcular precio con modificadores del evento y fluctuación random (+- 10%)
        const basePrice = BASE_PRICES[res];
        const eventMod = event.priceModifiers[res] || 1.0;
        const randomFluctuation = 0.9 + (Math.random() * 0.2);
        
        // Spread: Si el jugador compra (Mercado Vende), precio un poco más alto. Viceversa para venta.
        const spread = type === 'BUY' ? 1.05 : 0.95;

        let finalPrice = Math.floor(basePrice * eventMod * randomFluctuation * spread);
        finalPrice = Math.max(1, finalPrice);

        // Calcular Cantidad usando configuración constante
        // Fórmula Final: Base * EscalaImperio * Variación(0.8-1.2)
        const baseAmount = BASE_OFFER_AMOUNTS[res] || DEFAULT_OFFER_AMOUNT;
        const amount = Math.floor(baseAmount * scalingFactor * (0.8 + Math.random() * 0.4));

        offers.push({
            id: `mkt-${Date.now()}-${index}`,
            type,
            resource: res,
            pricePerUnit: finalPrice,
            totalAmount: amount,
            amountSold: 0
        });
    });

    return {
        offers,
        event,
        nextRefresh: Date.now() + event.duration
    };
};

export const calculateTotalUnitCost = (units: Partial<Record<UnitType, number>>): number => {
    let totalValue = 0;
    Object.entries(units).forEach(([uType, count]) => {
        const def = UNIT_DEFS[uType as UnitType];
        if (def && count) {
            const unitCost = 
                (def.cost.money * BASE_PRICES[ResourceType.MONEY]) + 
                (def.cost.oil * BASE_PRICES[ResourceType.OIL]) + 
                (def.cost.ammo * BASE_PRICES[ResourceType.AMMO]);
            totalValue += unitCost * (count as number);
        }
    });
    return totalValue;
};
