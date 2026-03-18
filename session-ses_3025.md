# Continuar checklist de plan server-authoritative

**Session ID:** ses_30257ee3cffeMq5Sbbqx4AE0Fm
**Created:** 3/17/2026, 9:16:16 PM
**Updated:** 3/17/2026, 9:18:33 PM

---

## User

bien continuemos haciendo @CHECKLIST_PLAN_SERVER_AUTORITATIVA.md excedente de accion del plan @PLAN_ARQUITECTURA_SERVER_AUTORITATIVA.md 

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: glob**

**Tool: glob**

**Tool: glob**

---

## Assistant

**Tool: read**

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

---

## Assistant

**Tool: grep**

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

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

**Tool: glob**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

Listo, avancé el **Paso 1** del checklist con implementación real del corte legacy por blob, sin romper compatibilidad por defecto.

- Implementé el feature flag `FF_DISABLE_LEGACY_SAVE_BLOB` en backend y cliente para controlar el apagado del guardado legacy.
- En `server/index.js:759` ahora `POST /api/profile/save` devuelve `410` controlado con `errorCode: LEGACY_SAVE_DISABLED` cuando el flag está activo.
- En `hooks/usePersistence.ts:250` el cliente deja de intentar guardar blob cuando el flag está activo, y en `hooks/usePersistence.ts:590` evita autosave legacy para no generar ruido/conflictos.
- Exposé el flag frontend en `lib/backend.ts:22` como `DISABLE_LEGACY_SAVE_BLOB` (`VITE_FF_DISABLE_LEGACY_SAVE_BLOB`).
- Documenté el flag en `server/.env.example:9`.
- Actualicé el avance del plan en `CHECKLIST_PLAN_SERVER_AUTORITATIVA.md:104` y `CHECKLIST_PLAN_SERVER_AUTORITATIVA.md:106` a estado parcial `[~]` (implementado en código, pendiente activación en entorno).

Validación ejecutada:
- `npm run typecheck` ✅
- `npm test` ⚠️ (1 fallo de integración en `tests/supabase.integration.test.ts`, caso de colas/command; el resto pasa)

Siguiente paso natural:
1. Activar el flag en entorno de staging (`FF_DISABLE_LEGACY_SAVE_BLOB=true` y `VITE_FF_DISABLE_LEGACY_SAVE_BLOB=true`) y correr smoke de `bootstrap + comandos + refresh`.
2. Si staging queda estable, cerrar el ítem “redirigir mutaciones a `/api/command` únicamente” y marcar Paso 1 casi completo.

---

