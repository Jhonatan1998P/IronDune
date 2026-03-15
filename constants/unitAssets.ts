import { UnitType } from '../types';

export const UNIT_ASSETS: Record<UnitType, string> = {
    [UnitType.CYBER_MARINE]: '/Cyber_Marine.webp',
    [UnitType.HEAVY_COMMANDO]: '/Comando_Pesado.webp',
    [UnitType.SCOUT_TANK]: '/Tanque_ligero.webp',
    [UnitType.TITAN_MBT]: '/Tanque_Titán.webp',
    [UnitType.WRAITH_GUNSHIP]: '/Cañonero_Espectro.webp',
    [UnitType.ACE_FIGHTER]: '/Caza_As.webp',
    [UnitType.AEGIS_DESTROYER]: '/Destructur_Aegis.webp',
    [UnitType.PHANTOM_SUB]: '/Submarino_Fantasma.webp',
    [UnitType.SALVAGER_DRONE]: '/Dron.webp',
};
