# Tipos de unidades disponibles para bots de 10k, 25k y 75k puntos

**Session ID:** ses_36d7c9514ffepAiIkEGl3iJmI9
**Created:** 2/25/2026, 1:56:52 AM
**Updated:** 2/25/2026, 1:58:04 AM

---

## User

que tipos de unidades tiene disponible un bot de 10k de puntos, 25k y 75k?

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

Según el código en `utils/engine/missions.ts:49-78`, las unidades disponibles para bots según su puntuación son:

**10,000 puntos** (score < 10000): 5 unidades
- CYBER_MARINE
- HEAVY_COMMANDO
- SCOUT_TANK
- TITAN_MBT
- WRAITH_GUNSHIP

**25,000 puntos** (score < 25000): 7 unidades
- Las 5 anteriores más:
- ACE_FIGHTER
- AEGIS_DESTROYER

**75,000 puntos** (score >= 25000): 8 unidades (todas)
- Las 7 anteriores más:
- PHANTOM_SUB

La función `getUnitsByScoreRange` determina el acceso a unidades basado en umbrales: 500, 1500, 3000, 6000, 10000, 18000 y 25000 puntos.

---

