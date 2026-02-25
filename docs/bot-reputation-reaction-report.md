# Informe de Comportamiento del Bot: Reacción a Ataques y Reputación Baja

## Resumen Ejecutivo

Este informe documenta el comportamiento de los bots con diferentes personalidades cuando:
1. El jugador ataca a un bot (sistema de represalias)
2. La reputación del jugador con el bot es baja

Los tests unitarios verifican los tiempos de reacción, probabilidades de ataque, y comportamiento específico por personalidad.

---

## 1. Sistema de Represalias (Retaliation System)

### 1.1 Tiempos de Reacción por Personalidad

| Personalidad | Tiempo de Reacción | Rango |
|--------------|-------------------|-------|
| **WARLORD** | ~17-21 minutos | 5-30 minutos |
| **TYCOON** | ~2.2 horas | 1-4 horas |
| **ROGUE** | ~3.8 horas (variable) | 0.1-16 horas |
| **TURTLE** | ~3.3 horas | 2-6 horas |

**Análisis:**
- **WARLORD**: El más rápido en vengar ataques. Su estrategia es golpear mientras "el hierro está caliente".
- **TURTLE**: El más lento. Necesita tiempo para reconstruir su ejército defensivo antes de contraatacar con fuerzas masivas.
- **TYCOON**: Tiempo medio. Contrata mercenarios (simulado como ataque estándar) pero con retraso.
- **ROGUE**: Impredecible. Puede atacar casi instantáneamente o esperar hasta 16 horas (50% de probabilidad cada uno).

### 1.2 Multiplicador de Fuerza de Retaliación

| Personalidad | Multiplicador | Efecto |
|--------------|---------------|--------|
| **TURTLE** | 1.5x | "Deathball" - fuerza masiva |
| **WARLORD** | 1.3x | Ataque mejorado |
| **TYCOON** | 1.0x | Fuerza estándar |
| **ROGUE** | 1.0x | Fuerza estándar |

**Análisis:**
- Los bots TURTLE envían fuerzas 50% más grandes de lo normal cuando se vengan.
- Esto compensa su lentitud inicial con una oleada devastadora.

### 1.3 Expiración de las Venganzas

- Las grudges (venganzas) expiran después de **48 horas**
- Si el jugador está protegido, los ataques se reprograman para cuando termine la protección
- Existe un límite de "force attack" después de 12 horas esperando

---

## 2. Sistema de Reputación

### 2.1 Umbrales de Reputación

| Estado | Rango de Reputación | Probabilidad de Ataque |
|--------|--------------------|----------------------|
| **ALIADO** | ≥ 70 | 30% |
| **NEUTRAL** | 30-69 | 80% |
| **ENEMIGO** | < 30 | 100% |

### 2.2 Decaimiento de Reputación

| Reputación | Multiplicador de Decaimiento |
|------------|------------------------------|
| ≥ 75 | 0x (estable, no decae) |
| 40-74 | 1x (normal) |
| < 40 | 1x - 2x (acelerado) |
| 0 | 2x (máximo) |

**Parámetros:**
- Decaimiento: 2 puntos cada 4 horas
- Punto de estabilidad: 75 puntos (no decae más)
- Punto de aceleración: 40 puntos (decaimiento se duplica gradualmente)

### 2.3 Peso en Selección de Ataques Aleatorios

| Tipo de Bot | Peso en Selección |
|-------------|------------------|
| **ENEMIGO** (rep < 30) | 2.0x |
| **NEUTRAL** | 1.0x |
| **ALIADO** (rep ≥ 70) | 0.3x |

**Análisis:**
- Los enemigos tienen el doble de probabilidad de ser seleccionados para ataques aleatorios
- Los aliados tienen solo 30% de probabilidad de ser atacados

---

## 3. Probabilidad de Ataque Basada en Reputación

### 3.1 Durante una Venganza

| Reputación del Bot | Probabilidad de Ataque |
|--------------------|----------------------|
| ≥ 70 (aliado) | 30% |
| 30-69 (neutral) | 80% |
| < 30 (enemigo) | 100% |

**Nota:** Un bot con vengaza puede "perdonar" y no atacar. Esto mejora ligeramente la reputación.

### 3.2 Defensa de Aliados

- Los aliados (rep ≥ 70) tienen **40% de probabilidad** de ayudar a defender al jugador
- Las fuerzas de refuerzo son del 50% del score del aliado

---

## 4. Perfiles de Personalidad Completos

### 4.1 WARLORD (Señor de la Guerra)

```
=== WARLORD PROFILE ===
- Retaliation: ~17-21 min (5-30 min range)
- Attack ratio: 70% offense, 30% defense
- Unit tiers: 3-8 (high tier focus)
- Retaliation multiplier: 1.3x
- Strategy: DAMAGE_DEALER, aggressive offense
```

**Comportamiento:**
- Ataca rápidamente después de ser agraviado
- Usa unidades de alto nivel (tiers 3-8)
- Prioriza daño sobre supervivencia
- Puede perdonar si tiene reputación de aliado

### 4.2 TURTLE (La Tortuga)

```
=== TURTLE PROFILE ===
- Retaliation: ~3.3 hours (2-6 hours range)
- Attack ratio: 30% offense, 70% defense
- Unit tiers: 1-4 (defensive focus)
- Retaliation multiplier: 1.5x (deathball)
- Strategy: FORTIFY, defensive superiority
```

**Comportamiento:**
- Retrasa la venganza para reconstruir fuerzas
- Envía fuerzas 50% más grandes ("deathball")
- Usa unidades defensivas de bajo-medio tier
- Prioriza supervivencia sobre ataque

### 4.3 TYCOON (Magnate)

```
=== TYCOON PROFILE ===
- Retaliation: ~2.2 hours (1-4 hours range)
- Attack ratio: 50% offense, 50% defense
- Unit tiers: 2-6 (balanced focus)
- Retaliation multiplier: 1.0x
- Strategy: EFFICIENCY, cost-effective armies
```

**Comportamiento:**
- Tiempo de reacción intermedio
- Balance entre ataque y defensa
- Usa unidades eficientes en costo
- Enfocado en economía

### 4.4 ROGUE (Oportunista)

```
=== ROGUE PROFILE ===
- Retaliation: unpredictable (short OR long)
- Short attacks (<1h): ~50% of cases
- Long attacks (>4h): ~50% of cases
- Attack ratio: 60% offense, 40% defense
- Unit tiers: 2-7 (versatile focus)
- Retaliation multiplier: 1.0x
- Strategy: SURPRISE, hit-and-run tactics
```

**Comportamiento:**
- Completamente impredecible
- Puede atacar casi instantáneamente o esperar hasta 16 horas
- Usa tácticas de golpe y huida
- Unidades versátiles de múltiples tiers

---

## 5. Interacción con Protección del Jugador

### 5.1 Protección de Nuevos Jugadores

- Se activa con menos de **1000 puntos de imperio**
- Los bots no pueden atacar mientras está activa

### 5.2 Enfriamiento de Ataques

- Los ataques aleatorios ocurren cada **1-6 horas**
- Si el jugador está en enfriamiento, los ataques de represalia se reprograman

### 5.3 Reprogramación de Venganzas

Cuando un bot tiene una vengeance pero el jugador está protegido:
1. El ataque se reprograma para cuando termine la protección
2. Se añade un "jitter" aleatorio de 0-5 minutos
3. Se envía una notificación de intel cuando el bot está planeando
4. Después de 12 horas de esperar, el bot fuerza el ataque sin importar la protección

---

## 6. Impacto de Ataques del Jugador

### 6.1 Penalizaciones de Reputación

| Acción | Cambio de Reputación |
|--------|---------------------|
| Atacar a un bot | -15 |
| Derrotar a un bot | -10 |
| Perder contra un bot | +5 |
| Defender exitosamente | +8 |

### 6.2 Regalos Diplomáticos

- Costo base: $100,000 + 500 oil + 200 ammo + 100 gold
- El costo escala con el score del bot (50-300x)
- La reputación baja aumenta el costo del regalo
- Ganancia de reputación: +8 por regalo
- Cooldown: 1 hora entre regalos al mismo bot

---

## 7. Conclusiones y Recomendaciones

### 7.1 Estrategias Óptimas para el Jugador

1. **Para evitar ataques de WARLORD**: Mantener reputación ≥ 70 o mantener score bajo para que no sea objetivo atractivo
2. **Para evitar ataques de TURTLE**: Atacar primero antes de que reconstruya su "deathball"
3. **Para evitar ataques de ROGUE**: Impredecible, difícil de prevenir
4. **Para mantener aliados**: Enviar regalos diplomáticos regularmente (+8 rep)

### 7.2 Riesgos por Personalidad

| Personalidad | Riesgo Principal | Tiempo de Precaución |
|--------------|------------------|---------------------|
| WARLORD | Ataque rápido e inesperado | 30 min post-ataque |
| TURTLE | Contraataque masivo tardío | 6 horas post-ataque |
| TYCOON | Contraataque moderado | 4 horas post-ataque |
| ROGUE | Impredecible, cualquier momento | 16 horas post-ataque |

---

## 8. Tests Unitarios

Los siguientes tests unitarios fueron implementados en `tests/bot-reputation-reaction.test.ts`:

- Tests de tiempo de reacción por personalidad
- Tests de multiplicador de fuerza de represalia
- Tests de decaimiento de reputación
- Tests de probabilidad de ataque basada en reputación
- Tests de pesos de selección de ataques
- Tests de defensa de aliados
- Tests de perfiles de personalidad
- Tests de interacción con protección

Todos los tests pasan exitosamente, verificando el comportamiento esperado del sistema.

---

*Documento generado automáticamente a partir de pruebas unitarias*
*Fecha: 2026-02-25*
