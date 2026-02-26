# Iron Dune: Operations - Especificación Técnica de Mecánicas

**Versión del Motor:** 1.4.0
**Arquitectura:** React + Vite (SPA), Estado Inmutable, Event-Driven UI.

---

## 1. Núcleo del Motor (Core Engine)

### Loop de Juego (Game Loop)
*   **Tick Rate:** 1000ms (1 segundo).
*   **Gestión de Delta Time:** El motor calcula la producción y consumo basándose en la diferencia de tiempo real (`Date.now()`) entre ticks, garantizando precisión independientemente del framerate o lag del navegador.
*   **Persistencia:** Guardado automático en `localStorage`.
    *   **Seguridad:** Los archivos de guardado (`.ids`) incluyen una firma hash generada con una "Salt" secreta. Al importar, el motor recalcula el hash del contenido JSON; si no coincide con la firma, el archivo se rechaza como corrupto o manipulado.

### Simulación Offline (Time Warp)
Al cargar la partida, el motor calcula el tiempo transcurrido (`deltaTime`) desde el último guardado y ejecuta una simulación acelerada:
1.  **Proyección de Recursos:** Aplica producción neta y consumo por mantenimiento sobre el tiempo total.
2.  **Resolución de Colas:** Finaliza construcciones, reclutamientos e investigaciones basándose en sus marcas de tiempo (`endTime`).
3.  **Resolución de Misiones:** Calcula el resultado de patrullas y ataques que debían terminar durante la ausencia.
4.  **Interés Bancario:** Calcula el interés compuesto si hay fondos en el banco.
5.  **Deserción por Déficit:** Si un recurso se agota, calcula cuántas unidades habrían desertado minuto a minuto.
6.  **Amenaza Offline:** Si la amenaza llega al 100% durante el tiempo offline, genera un ataque enemigo programado para 1 minuto después del inicio de sesión (Grace Period).

---

## 2. Economía Dinámica y Recursos

### Sistema de Almacenamiento Escalar
La capacidad máxima de recursos no es estática; escala con el poder del jugador.
*   **Fórmula:** `Capacidad Base * (Puntos de Imperio / 100) * Multiplicador de Banco * Multiplicador de Tecnología`.
*   **Efecto:** A medida que el jugador crece, su capacidad de "billetera" aumenta orgánicamente sin necesidad de construir depósitos infinitos.

### Sistema Bancario
*   **Bóveda:** Almacena Dinero excedente fuera del límite de recursos estándar.
*   **Interés Variable:** La tasa de interés fluctúa (1% - 6%) cada 30 minutos.
*   **Yield Cap:** El interés deja de generarse si el saldo supera la capacidad máxima de la bóveda (determinada por el nivel del edificio Banco y Puntos de Imperio).

### Mercado Global (Procedural)
*   **Ofertas:** Se generan aleatoriamente cada ciclo de refresco.
    *   **Volumen:** La cantidad de recursos en venta escala con los Puntos de Imperio del jugador (`1 + Puntos/50`).
    *   **Tipos:** 70% probabilidad de que el mercado quiera COMPRAR (Jugador vende), 30% de que venda.
*   **Eventos de Mercado:** Estados globales que afectan los precios (ej. "Guerra" sube precio de Petróleo y Munición; "Paz" baja precio de Munición).
*   **Spread:** Existe un margen de ganancia/pérdida entre compra y venta para evitar explotación infinita.

---

## 3. Infraestructura y Construcción

### Modos de Construcción
1.  **Modo Cantidad (Quantity):**
    *   Permite múltiples edificios del mismo tipo (ej. Casas, Fábricas).
    *   **Escalado de Costo:** Lineal (`Base * (1 + 0.15 * Nivel)`). Fomenta expansión horizontal.
2.  **Modo Nivel (Level):**
    *   Edificio único que sube de nivel (ej. Banco, Universidad).
    *   **Escalado de Costo:** Exponencial (`Base * 1.5 ^ Nivel`). Frena el avance tecnológico rápido.

### Colas de Producción
*   Límite estricto de 3 colas simultáneas para Construcción y 3 para Reclutamiento.
*   La investigación es de hilo único (Single-threaded).

---

## 4. Sistema Militar y Combate

### Roster de Unidades
8 tipos de unidades divididos en 5 categorías (Tierra, Artillería, Tanques, Naval, Aire):
- **Cyber Marine**: Infantería básica
- **Heavy Commando**: Especialista anti-tanque
- **Scout Tank**: Tanque ligero rápido
- **Titan MBT**: Tanque de batalla principal
- **Wraith Gunship**: Helicóptero de ataque
- **Ace Fighter**: Caza de superioridad aérea
- **Aegis Destroyer**: Destructor naval
- **Phantom Sub**: Submarino sigiloso

### Sistema de Combate
El combate se resuelve en hasta 6 rondas simuladas:
1.  **Fase de Fuego:** Cada unidad elige un objetivo aleatorio vivo del ejército enemigo.
2.  **Cálculo de Daño:** `Daño = (Ataque * Multiplicador Tech * Bonus Contra Tipo) - Defensa Enemiga`. Mínimo 1 daño.
3.  **Resolución de Bajas:** Si el HP de una unidad llega a 0, se elimina permanentemente.
4.  **Críticos (70% HP):** Si el daño recibido supera el 70% del HP actual, hay probabilidad de muerte crítica instantánea.
5.  **Fuego Rápido:** Algunas unidades tienen probabilidad de atacar múltiples veces por ronda.

### Botín (Loot)
Si el jugador gana, obtiene recursos basados en:
- **Valor del ejército enemigo destruido** (~15%)
- **Bonificaciones tecnológicas** (Saqueo +1%/nivel)
- **Edificios saqueables**: Casas, Fábricas, Rascacielos, Pozos Petrolíferos, Minas de Oro, Fábricas de Municiones

---

## 5. Sistema de Reputación y Diplomacia

### Rangos de Reputación
| Rango | Reputación | Efecto |
|-------|------------|--------|
| Aliado | 70-100 | 40% chance de defender, menos probable de atacar |
| Neutral | 31-69 | Sin efectos especiales |
| Enemigo | 0-30 | Puede atacar periódicamente, más probable de retaliar |

### Modificadores de Reputación
- **Atacar bot**: -15 reputación
- **Derrotar bot**: -10 reputación
- **Bot te derrota**: +5 reputación (respetan la fuerza)
- **Defender con éxito**: +8 reputación
- **Enviar regalo**: +8 reputación
- **Proponer alianza**: +5 reputación
- **Proponer paz**: +10 reputación

### Decaimiento de Reputación
- **Intervalo:** Cada 4 horas
- **Base:** -2 reputación por ciclo
- **Acelerado:** Debajo de 40 reputación, el decaimiento aumenta hasta 2x
- **Estable:** Reputación ≥75 no decae

---

## 6. Sistema de Ataques Enemigos

### Mecánica de Ataque Periódico
Los bots con baja reputación pueden atacar al jugador automáticamente.

**Configuración:**
- **Intervalo de verificación:** Cada 30 minutos
- **Umbral de reputación:** ≤30 (solo enemigos pueden atacar)
- **Máximo de ataques:** 3 ataques por bot cada 24 horas
- **Cooldown entre ataques:** 2 horas mínimo del mismo bot
- **Reset de contadores:** Cada 24 horas

### Cálculo de Probabilidad de Ataque
```
Chance Base = 20% (en reputación 30)
Chance por punto debajo de 30 = +2.5%
Chance Máxima = 100%

Chance Final = min(100%, Chance Base * Multiplicador Personalidad)
```

**Ejemplo:** Bot con 10 de reputación:
- Diferencia: 30 - 10 = 20 puntos
- Chance base: 20% + (20 * 2.5%) = 70%
- Si es Warlord: 70% * 1.5 = 105% → 100%

### Modificadores por Personalidad
| Personalidad | Multiplicador | Descripción |
|--------------|---------------|-------------|
| Warlord | 1.5x | 50% más probable de atacar |
| Turtle | 0.5x | 50% menos probable de atacar |
| Tycoon | 1.0x | Probabilidad normal |
| Rogue | 1.2x | 20% más probable (oportunista) |

### Múltiples Atacantes
Varios bots pueden atacar simultáneamente. Cada bot realiza su propia tirada independiente.

---

## 7. Sistema de Retaliación (Venganza)

### Activación de Retaliación
Cuando el jugador ataca a un bot, se realiza una tirada **inmediata** para determinar si buscará venganza.

**Probabilidad por Personalidad:**
| Personalidad | Chance de Retaliación | Descripción |
|--------------|----------------------|-------------|
| Warlord | 95% | Muy vengativo |
| Turtle | 85% | Guarda rencores |
| Rogue | 90% | Impredecible pero vengativo |
| Tycoon | 70% | Ocupado haciendo dinero |

### Tiempo de Retaliación
- **Rango:** 15-45 minutos aleatorios (todas las personalidades)
- **Duración del rencor:** 48 horas máximo
- **Notificación:** 10 minutos antes del ataque inminente

### Fuerza del Ejército de Retaliación
| Personalidad | Multiplicador de Ejército |
|--------------|--------------------------|
| Warlord | 1.3x (30% más fuerte) |
| Turtle | 1.5x (50% más fuerte - "Deathball") |
| Tycoon | 1.0x (fuerza normal) |
| Rogue | 1.0x (fuerza normal) |

### Protección para Principiantes
- Los ataques de retaliación se retrasan si el jugador está bajo protección
- La protección dura hasta alcanzar 1000 Puntos de Imperio
- Después de esta protección, no hay más protección permanente

---

## 8. Operaciones y Meta-Juego

### Misiones de Patrulla
Misiones temporizadas con resolución probabilística al finalizar:
*   **45% Sin incidente:** Retorno seguro sin recompensa
*   **30% Contrabando:** Obtención de recursos sin combate
*   **15% Batalla:** Combate contra fuerza generada procedimentalmente
*   **5% Emboscada:** Combate desfavorable (enemigo más fuerte)
*   **5% Aniquilación:** Pérdida total de la flota enviada

### Ataques PvP (Asíncronos)
*   **Objetivos:** Bots del ranking simulados.
*   **Rango de Ataque:** Solo se puede atacar objetivos que tengan entre el 50% y 200% de los Puntos de Imperio del jugador.
*   **Límite de ataques:** Máximo 3 ataques al mismo objetivo por día
*   **Logística:** Tiempo de viaje real (15 min ida + 15 min vuelta). Las unidades no están disponibles durante el viaje.
*   **Aceleración:** Se puede usar 1 Diamante para reducir el tiempo de viaje en 80%

### Campaña PvE
*   25 Niveles de dificultad progresiva.
*   **Enemigos Estáticos:** Composiciones diseñadas manualmente para requerir "counters" específicos.
*   **Slots de misión:** 1 slot base + 1 por nivel de Strategic Command (máximo 6)
*   **Cooldown:** Tiempo de reabastecimiento (15 min) entre misiones exitosas o fallidas.

### Sistema de Guerra
*   **Declaración:** Costo de 1000 Puntos de Imperio o mediante acción diplomática
*   **Duración:** 2 horas 10 minutos base + 20 minutos si hay empate
*   **Olas:** 8 olas enemigas (puede aumentar en tiempo extra)
*   **Ataques del jugador:** 8 ataques disponibles
*   **Botín:** 50% de los recursos perdidos por ambos bandos van a un pool común
*   **Victoria:** El ganador se lleva el pool de recursos

---

## 9. Sistema de Ranking Evolutivo

*   **Entorno Vivo:** 199 Bots simulados con nombres, países y avatares generados.
*   **Evolución:** Cada 6 horas, el motor simula el crecimiento de los bots basándose en su personalidad:
    *   **Warlord:** +8% Militar por ciclo
    *   **Turtle:** +3% Economía por ciclo
    *   **Tycoon:** +6% Economía por ciclo
    *   **Rogue:** +5% Dominio por ciclo
*   **Eventos Aleatorios:** Los bots pueden sufrir eventos que modifican su crecimiento (ataques, crisis, bonanzas)
*   **Sistema de Tiers:** Clasificación visual (S, A, B, C, D) basada en el percentil del ranking.

---

## 10. Tecnología (Tech Tree)

Árbol de dependencias multinivel:
*   **Requisitos:** Nivel de Universidad + Edificios Específicos + Tecnologías Previas.
*   **Efectos:**
    *   **Desbloqueo:** Permite reclutar nuevas unidades.
    *   **Pasivos:** Multiplicadores globales de producción (ej. +5% Dinero/Nivel).
    *   **Capacidad:** Aumenta límites de almacenamiento y eficiencia de saqueo.
    *   **Slots:** Aumenta slots de misión de campaña (+1 por nivel de Strategic Command).

### Categorías de Tecnología
1.  **Productivo:** Mejora producción de recursos (+5%/nivel)
2.  **Logística:** Mejora capacidad de almacenamiento y saqueo
3.  **Militar - Tierra:** Desbloquea y mejora infantería
4.  **Militar - Tanques:** Desbloquea y mejora vehículos blindados
5.  **Militar - Naval:** Desbloquea y mejora barcos
6.  **Militar - Aire:** Desbloquea y mejora aeronaves

---

## 11. Sistema de Espionaje

### Adquirir Inteligencia
- **Costo:** `(EnemyScore * 64) / 5` de Oro
- **Duración:** 10 minutos antes de expirar
- **Información revelada:** Composición del ejército enemigo, recursos, edificios

### Uso de Inteligencia
- Permite ver la composición de ataques entrantes
- Facilita la preparación de defensas adecuadas
- Los aliados pueden compartir inteligencia automáticamente

---

## 12. Configuración y Constantes

### Constantes Principales
```typescript
// Protección principiante
NEWBIE_PROTECTION_THRESHOLD = 1000  // Puntos de Imperio

// Sistema de ataques enemigos
ENEMY_ATTACK_CHECK_INTERVAL_MS = 30 * 60 * 1000  // 30 minutos
ENEMY_ATTACK_COOLDOWN_MS = 2 * 60 * 60 * 1000    // 2 horas
ENEMY_ATTACK_MAX_PER_BOT = 3                      // Máximo ataques
ENEMY_ATTACK_RESET_MS = 24 * 60 * 60 * 1000      // 24 horas reset
ENEMY_ATTACK_BASE_CHANCE = 0.20                   // 20% base
ENEMY_ATTACK_CHANCE_MULTIPLIER = 0.025            // +2.5% por punto

// Retaliación
RETALIATION_TIME_MIN_MS = 15 * 60 * 1000         // 15 minutos
RETALIATION_TIME_MAX_MS = 45 * 60 * 1000         // 45 minutos
RETALIATION_GRUDGE_DURATION_MS = 48 * 60 * 60 * 1000  // 48 horas

// Umbrales de reputación
REPUTATION_ALLY_THRESHOLD = 70    // Aliado ≥ 70
REPUTATION_ENEMY_THRESHOLD = 30   // Enemigo ≤ 30
REPUTATION_MIN = 0
REPUTATION_MAX = 100
```
