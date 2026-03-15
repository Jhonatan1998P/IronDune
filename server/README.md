# Iron Dune Multiplayer Server

Servidor Express + Socket.io para el sistema multijugador de Iron Dune Operations.

## Desarrollo local

```bash
cd server
npm install
node index.js
```

O desde la raíz del proyecto:

```bash
npm run server
```

El servidor corre en el puerto 10000 por defecto (configurable con la variable de entorno `PORT`).

## Deploy en Render

1. Crear un nuevo **Web Service** en [Render](https://render.com).
2. Conectar el repositorio de GitHub.
3. Configurar:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Environment Variables**:
     - `PORT`: `10000` (Render asigna automáticamente, pero lo fijamos por consistencia)
     - `NODE_ENV`: `production`

Alternativamente, Render detectará automáticamente la configuración desde `render.yaml` en la raíz del repositorio.

## Variables de entorno del cliente

El cliente Vite necesita la URL del servidor en la siguiente variable:

```
VITE_SOCKET_SERVER_URL=http://localhost:10000
```
(En producción usa la URL de tu servicio en Render, ej: `https://iron-dune-server.onrender.com`).

Esta variable se utiliza tanto para la API de batallas como para la conexión en tiempo real vía Socket.io.

## Endpoints

- `GET /health` — Estado del servidor (jugadores conectados, salas activas).

## Eventos Socket.io

### Cliente → Servidor

| Evento | Payload | Descripción |
|---|---|---|
| `join_room` | `{ roomId, peerId }` | Unirse a una sala |
| `leave_room` | — | Salir de la sala actual |
| `broadcast_action` | `{ action }` | Enviar acción a todos en la sala |
| `send_to_peer` | `{ targetPeerId, action }` | Enviar acción a un peer específico |
| `presence_update` | `{ playerData }` | Actualizar datos de presencia |

### Servidor → Cliente

| Evento | Payload | Descripción |
|---|---|---|
| `room_joined` | `{ roomId, peers[] }` | Confirmación de unión a sala con peers existentes |
| `peer_join` | `{ peerId }` | Un nuevo peer se unió a tu sala |
| `peer_leave` | `{ peerId }` | Un peer salió de tu sala |
| `remote_action` | `{ action, fromPeerId }` | Acción recibida de otro peer |
