# Reporte de Bugs y Correcciones: Sistema de Batallas P2P Asíncronas

Este documento resume los bugs críticos encontrados y resueltos durante la implementación del sistema de batallas Jugador contra Jugador (P2P) asíncronas vía Trystero.

## 1. El atacante no veía el indicador de ataque saliente
*   **Problema:** Al enviar un ataque P2P mediante `P2PAttackModal.tsx`, las tropas se descontaban correctamente del estado local, pero el ataque se enviaba al vacío sin registrarse como una misión activa en el radar del atacante. El componente `ActiveAttacksIndicator` monitorea las `activeMissions` buscando el tipo `PVP_ATTACK`, por lo que el indicador nunca aparecía.
*   **Solución:** Se creó una nueva acción `addP2PMission` en `useGameActions.ts`. Se actualizó `P2PAttackModal.tsx` para que, al momento de lanzar el ataque, invoque esta acción inyectando una `ActiveMission` de tipo `PVP_ATTACK` con los datos del ataque saliente en el estado del juego del atacante.

## 2. Las batallas nunca se resolvían para el atacante (y victorias falsas)
*   **Problema:** El hook encargado de calcular el combate (`useP2PBattleResolver.ts`) tenía dos defectos críticos:
    1.  Buscaba ataques expirados dentro de `gameState.incomingAttacks` (donde el `attackerId` fuera él mismo). Esta lista solo la posee el defensor, no el atacante. Por tanto, el efecto nunca se disparaba.
    2.  Al simular el combate (`simulateCombat`), se pasaba un objeto vacío `{}` como ejército defensor. Esto provocaba que el atacante siempre ganara automáticamente sin sufrir ni una sola baja, violando la regla del motor de combate.
*   **Solución:** Se reescribió `useP2PBattleResolver.ts` para que monitoree `gameState.activeMissions` de tipo `PVP_ATTACK` (el lugar correcto donde el atacante guarda sus salidas).

## 3. Lógica de Victoria/Derrota P2P invertida
*   **Problema:** En `applyP2PBattleResult` (dentro de `useGameActions.ts`), la lógica de robo de loot y edificios estaba invertida respecto a lo que retorna `simulateCombat`. Se estaba evaluando `if (result.winner === 'ENEMY' && isAttacker)` para otorgarle el botín al atacante. Sin embargo, `'ENEMY'` significa que el defensor ganó (desde la perspectiva de la simulación).
*   **Solución:** Se corrigió toda la cadena de condicionales para usar `result.winner === 'PLAYER'` como detonante de éxito para el atacante. Ahora el atacante roba recursos/edificios *solo* cuando realmente gana el combate.

## 4. Falta de notificaciones de Informes de Combate
*   **Problema:** Tras un combate P2P, la función `applyP2PBattleResult` escribía el reporte de batalla inyectándolo directamente en el array `gameState.logs` del `setGameState`. Al no pasar por la acción oficial `addLog`, el estado `hasNewReports` nunca cambiaba a `true`, por lo que el jugador no recibía el punto rojo de notificación de nuevo reporte.
*   **Solución:** Se modificó la función para que, en lugar de mutar el array, dispare un evento `gameEventBus.emit(GameEventType.ADD_LOG, ...)`. El `useGameEngine.ts` atrapa este evento, lo inscribe oficialmente en los logs y activa la notificación global de nuevos reportes.

## 5. (CRÍTICO) La batalla no usaba las tropas reales del defensor
*   **Problema:** En juegos asíncronos en tiempo real, el ejército del defensor puede cambiar durante los minutos que dura el viaje del ataque (puede reclutar más tropas, perderlas contra otro jugador, etc). El código original usaba una simple estimación basada en el `score` para simular al ejército defensor, lo cual rompía el realismo y justicia del P2P.
*   **Solución:** Se implementó un Handshake (apretón de manos) de red justo en el segundo exacto del impacto (`endTime`):
    1.  Al llegar a 0, el Atacante envía un evento `P2P_BATTLE_REQUEST_TROOPS` al Defensor.
    2.  El Defensor (en `useP2PGameSync.ts`) toma una "fotografía" de sus tropas vivas actuales y las devuelve vía `P2P_BATTLE_DEFENDER_TROOPS`.
    3.  El Atacante recibe el payload con las tropas 100% reales, introduce ambas fuerzas en `simulateCombat`, y envía el resultado final. Si el defensor no responde en 8 segundos (desconexión o fuga), se usa un ejército estimado de penalización (W.O. virtual).

## 6. Limpieza de memoria post-batalla y Broadcasts erróneos
*   **Problema:** El resultado de la batalla (`P2P_BATTLE_RESULT`) se transmitía por broadcast a *todos* los jugadores conectados a la sala de Trystero usando un `defenderId` hardcodeado a `'DEFENDER'`. Además, la misión activa del atacante se quedaba congelada en el radar en 00:00 eternamente.
*   **Solución:** Se actualizó `P2PAttackModal` y `P2PAttackRequest` para incluir el ID de red real del defensor (`targetId`). Ahora el atacante usa `sendToPeer` específicamente hacia el ID del defensor. También se agregó lógica a `applyP2PBattleResult` para eliminar la misión de `activeMissions` del atacante inmediatamente después de aplicar el reporte de combate.
