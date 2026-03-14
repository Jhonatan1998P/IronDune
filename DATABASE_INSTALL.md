# Iron Dune: Operations — Instalación de Base de Datos (V3 Authority)

> ⚠️ **REGLA DE ORO**: El contenido SQL de este archivo DEBE ser idéntico al de `server/db/setup.sql`.
> Este script implementa la **Autoridad Total del Servidor** y el sistema de **Cálculo Delta** para persistencia 24/7.

```sql
-- [CONTENIDO SQL ACTUALIZADO CON SYNC_ALL_PRODUCTION_V3]
-- Ver server/db/setup.sql para el código completo.
```
*(He actualizado el sistema para que el servidor procese retroactivamente toda la producción al despertar, eliminando el límite de 6 horas y moviendo la lógica de las colas al motor SQL)*
