# Logs para crash en tutorial y cálculo de imperio

**Session ID:** ses_2f8374da3ffe4QueeFcOOUzmOg
**Created:** 3/19/2026, 8:28:06 PM
**Updated:** 3/19/2026, 8:32:04 PM

---

## User

puedes agregar logs al abrir el tutorial, recojer recompensas de tutorial darle al boton de continua en el tutorial para porque crasea la UI al querer reclamar la recompensas o darle a continua en una mision de tutorial. adema quisiera que el calculo dr imperio se como el calculo anterior de puntos de imperio del frontend en la version v5.5 hay commit con este nombre

---

## Assistant

**Tool: todowrite**

---

## Assistant

**Tool: bash**

**Tool: bash**

**Tool: bash**

---

## Assistant

**Tool: grep**

**Tool: grep**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: read**

**Tool: grep**

---

## Assistant

**Tool: read**

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: bash**

**Tool: bash**

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

**Tool: grep**

---

## Assistant

**Tool: grep**

**Tool: grep**

**Tool: grep**

---

## Assistant

**Tool: todowrite**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: bash**

**Tool: bash**

---

## Assistant

**Tool: todowrite**

---

## Assistant

**Tool: bash**

**Tool: bash**

---

## Assistant

**Tool: todowrite**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

Listo, ya te dejé ambos cambios aplicados: logs para depurar el tutorial y cálculo de puntos de imperio estilo v5.5.

- Agregué trazas de UI para el tutorial en `components/ObjectiveTracker.tsx:40`, `components/ObjectiveTracker.tsx:73` y `components/ObjectiveTracker.tsx:90`:
  - cuando se abre un paso de tutorial (`[TutorialUI] Tutorial step opened`)
  - cuando la recompensa queda reclamable (`[TutorialUI] Tutorial reward is claimable`)
  - cuando se presiona continuar (`[TutorialUI] Continue tutorial clicked`)
  - cuando se presiona reclamar (`[TutorialUI] Claim tutorial reward clicked`)
  - y `console.error` si algo rompe en esos clicks.
- Agregué trazas en la lógica de acciones del tutorial en `hooks/useGameActions.ts:646`, `hooks/useGameActions.ts:682` y `hooks/useGameActions.ts:741`:
  - request y dispatch de `ACCEPT_STEP`
  - request, preview local, abort por preview inválido, dispatch de `CLAIM_REWARD`
  - error capturado si falla la aplicación local de recompensa.
- Además metí una protección para evitar crasheo por defs faltantes al renderizar recompensas (building/unit) en `components/ObjectiveTracker.tsx:187` y `components/ObjectiveTracker.tsx:197` (fallback al id si falta definición).
- Restauré el cálculo frontend de puntos de imperio al estilo legado v5.5 en `utils/engine/systems.ts:66`:
  - unidades (incluyendo unidades en misiones activas) con `UNIT_DEFS.score`
  - edificios con separación economía/militar usando `BUILDING_DEFS.score`
  - tecnologías investigadas con `TECH_DEFS.score`
  - banco como `Math.floor(bankBalance / 100000)`
  - `rankingStats.CAMPAIGN` vuelve a ser `state.campaignProgress`.

Validación que corrí:
- `npm run typecheck` ✅
- `npm run test -- tests/tutorial-authoritative.test.ts tests/empire-points.test.ts` ✅

Si quieres, siguiente paso natural es que pruebes en runtime el flujo exacto que te crashea y me pegues los logs `[TutorialUI]` / `[TutorialAction]` para ubicar el punto exacto del fallo.

---

