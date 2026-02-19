# Iron Dune: Operations - Especificación Técnica de Mecánicas

**Versión del Motor:** 1.2.0
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
15 tipos de unidades divididos en 5 categorías (Tierra, Artillería, Tanques, Naval, Aire).
*   **Piedra-Papel-Tijera:** Cada unidad tiene bonificadores de daño específicos (ej. *Helicóptero* hace +50% daño a *Tanques*, pero recibe +50% daño de *Cazas*).

### Motor de Simulación de Combate
El combate se resuelve en hasta 12 rondas simuladas:
1.  **Fase de Fuego:** Cada unidad elige un objetivo aleatorio vivo del ejército enemigo.
2.  **Cálculo de Daño:** `Daño = (Ataque * Multiplicador Tech * Bonus Contra Tipo) - Defensa Enemiga`. Mínimo 1 daño.
3.  **Resolución de Bajas:** Si el HP de una unidad llega a 0, se elimina permanentemente.
4.  **Botín (Loot):** Si el jugador gana, obtiene recursos basados en el valor monetario del ejército enemigo destruido (~7.5%) y bonificaciones tecnológicas (Saqueo).

### Amenaza Global (Threat System)
Sistema de equilibrio que castiga el crecimiento descontrolado.
*   **Generación Pasiva:** Si un recurso supera el 70% de capacidad, genera amenaza por minuto (Acaparamiento).
*   **Generación Activa:** Acciones como Construir, Reclutar o Investigar generan amenaza instantánea. Los ataques generan amenaza masiva.
*   **Decaimiento:** La amenaza baja lentamente con el tiempo (1% / min).
*   **Consecuencia (100%):** Se genera un ataque inmediato de un Bot del Ranking contra el jugador.

---

## 5. Operaciones y Meta-Juego

### Misiones de Patrulla
Misiones temporizadas con resolución probabilística al finalizar:
*   **50% Nada:** Retorno seguro.
*   **30% Contrabando:** Obtención de recursos sin combate.
*   **15% Batalla:** Combate contra fuerza generada procedimentalmente (80-120% de la fuerza enviada).
*   **5% Emboscada:** Pérdida total de la flota enviada (Wipeout).

### Ataques PvP (Asíncronos)
*   **Objetivos:** Bots del ranking simulados.
*   **Rango de Ataque:** Solo se puede atacar objetivos que tengan entre el 50% y 200% de los Puntos de Imperio del jugador.
*   **Logística:** Tiempo de viaje real (15 min ida + 15 min vuelta). Las unidades no están disponibles durante el viaje.

### Campaña PvE
*   25 Niveles de dificultad progresiva.
*   **Enemigos Estáticos:** Composiciones diseñadas manualmente para requerir "counters" específicos.
*   **Cooldown:** Tiempo de reabastecimiento (15 min) entre misiones exitosas o fallidas para evitar granjeo excesivo.

---

## 6. Sistema de Ranking Evolutivo

*   **Entorno Vivo:** 199 Bots simulados con nombres, países y avatares generados.
*   **Evolución:** Cada 6 horas, el motor simula el crecimiento de los bots basándose en un factor de "Ambición" oculto. Sus puntuaciones (Dominio, Militar, Economía) crecen exponencialmente, obligando al jugador a mantenerse activo para no perder rango.
*   **Sistema de Tiers:** Clasificación visual (S, A, B, C, D) basada en el percentil del ranking.

---

## 7. Tecnología (Tech Tree)

Árbol de dependencias multinivel:
*   **Requisitos:** Nivel de Universidad + Edificios Específicos + Tecnologías Previas.
*   **Efectos:**
    *   **Desbloqueo:** Permite reclutar nuevas unidades.
    *   **Pasivos:** Multiplicadores globales de producción (ej. +5% Dinero/Nivel).
    *   **Capacidad:** Aumenta límites de almacenamiento y eficiencia de saqueo.
