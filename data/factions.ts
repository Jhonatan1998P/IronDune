
import { FactionIdeology } from '../types/faction';
import type { Faction } from '../types/faction';

/**
 * Plantillas de facciones iniciales
 * Se poblarán con bots al iniciar el juego
 */
export const FACTION_TEMPLATES: Partial<Faction>[] = [
  {
    name: "Iron Legion",
    tag: "IRON",
    motto: "Strength Through Unity",
    color: "#8B0000",
    iconId: 1,
    ideology: FactionIdeology.MILITARIST
  },
  {
    name: "Golden Alliance",
    tag: "GOLD",
    motto: "Prosperity For All",
    color: "#FFD700",
    iconId: 2,
    ideology: FactionIdeology.MERCANTILE
  },
  {
    name: "Shadow Covenant",
    tag: "SHDW",
    motto: "From Darkness, Power",
    color: "#4B0082",
    iconId: 3,
    ideology: FactionIdeology.OPPORTUNIST
  },
  {
    name: "Steel Fortress",
    tag: "STFL",
    motto: "None Shall Pass",
    color: "#708090",
    iconId: 4,
    ideology: FactionIdeology.ISOLATIONIST
  },
  {
    name: "Rising Tide",
    tag: "TIDE",
    motto: "Ever Expanding",
    color: "#006994",
    iconId: 5,
    ideology: FactionIdeology.EXPANSIONIST
  }
];

/**
 * Nombres adicionales para facciones que se formen dinámicamente
 */
export const DYNAMIC_FACTION_NAMES = [
  "Northern Coalition",
  "Desert Hawks",
  "Crimson Guard",
  "Phantom Order",
  "Thunder Corps",
  "Vanguard Initiative",
  "Black Sun Syndicate",
  "Azure Command"
];

/**
 * Mottos para facciones dinámicas
 */
export const DYNAMIC_FACTION_MOTTOS = [
  "Together We Conquer",
  "Rise Above All",
  "Forged In Battle",
  "No Mercy, No Surrender",
  "Profit Is Power",
  "The Silent Force",
  "Domination Through Strategy",
  "Shadows Strike Swift"
];

/**
 * Colores disponibles para facciones dinámicas
 */
export const DYNAMIC_FACTION_COLORS = [
  "#DC143C", "#228B22", "#FF8C00", "#1E90FF",
  "#9400D3", "#FF1493", "#00CED1", "#DAA520"
];
