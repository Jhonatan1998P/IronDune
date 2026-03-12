# Iron Dune: Operations

A browser-based military strategy game built with React 18, TypeScript, and Vite. Features base building, resource management, military operations, diplomacy, and P2P multiplayer.

## Architecture

### Frontend Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS (via CDN) + Glassmorphism design
- **State Management**: React Context (GameContext, LanguageContext)
- **Persistence**: localStorage with encoding/migration system
- **Multiplayer**: Socket.io client (connects to Express relay server)

### Backend Architecture (Post-Merge: Socket.io)
- **Server**: Express.js + Socket.io (server/index.js)
- **Port**: 3001 (configurable via PORT env var)
- **Features**:
  - Real-time room management
  - Player presence tracking
  - Message relay (broadcast & unicast)
  - Automatic cleanup on disconnect
  - Health endpoint: GET /health

### Game Loop
- **Tick Rate**: 1000ms (1 second)
- **FPS Target**: 30 (mobile: 20)
- **Mechanism**: requestAnimationFrame + throttling
- **Status States**: MENU, PLAYING, PAUSED

### Core Game Systems
1. **Economy**: 5 resources (Money, Oil, Ammo, Gold, Diamond), Banking, Market trading
2. **Buildings**: Construction system with timers and upgrades
3. **Units**: 8 unit types with combat roles and training queues
4. **Research**: Tech tree with 40+ technologies
5. **Combat**: Round-based simulation with "Rock-Paper-Scissors" balance
6. **Diplomacy**: Reputation system with 4 bot personalities
7. **Multiplayer (P2P)**: WebRTC via Socket.io relay for attacks, chat, gifts
8. **Campaigns**: Story missions with progressive difficulty
9. **War System**: Wave-based enemy raids with escalating difficulty

### File Structure
```
src/
├── components/          # UI Layer
│   ├── layout/         # GameLayout, ViewRouter
│   ├── views/          # Game screens (Buildings, Units, Research, etc.)
│   └── ui/             # Reusable components
├── context/            # Global state (GameContext, LanguageContext)
├── hooks/              # Custom hooks
│   ├── useGameEngine.ts      # Core game engine orchestration
│   ├── useGameLoop.ts        # Game tick loop (1000ms)
│   ├── usePersistence.ts     # Save/load management
│   ├── useGameActions.ts     # Action handlers (build, recruit, etc.)
│   └── useMultiplayer*.ts    # P2P multiplayer hooks
├── utils/engine/       # Game logic
│   ├── loop.ts         # calculateNextTick() - main game tick
│   ├── combat.ts       # Battle system
│   ├── economy.ts      # Resource production/consumption
│   └── offline.ts      # Offline progression
├── data/               # Game definitions & initial state
├── types/              # TypeScript definitions
└── i18n/               # Translations (English/Spanish)

server/                 # Express + Socket.io relay
├── index.js           # Server implementation
├── package.json       # Dependencies
└── README.md          # Deployment guide
```

## Recent Changes

### Post-Merge (Socket.io Migration - Task #1)
✅ Migrated P2P from Trystero (WebRTC) to Express + Socket.io
- Created `server/index.js` with Express.js + Socket.io
- Rewrote `hooks/useMultiplayerInternal.tsx` to use socket.io-client
- All dependent hooks work without changes (same interface contract)
- Environment variable: `VITE_SOCKET_SERVER_URL` (default: localhost:3001)
- Added post-merge setup script at `.local/post-merge/setup.sh`

### Game Loop Fixes (This Session)
✅ Fixed critical game loop performance issues:
- Added proper ref for status to prevent closure staleness
- Implemented debug logging for tick counting
- Verified loop runs independently of page navigation
- Added setGameStateRef to maintain current updater function
- Loop now properly initializes when status changes to PLAYING

## How to Run

### Development
```bash
npm install
npm run dev
# Opens on http://localhost:5000
```

### With Multiplayer Server (Local)
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Socket.io relay
cd server && npm run dev
# Server runs on http://localhost:3001
```

### Production Build
```bash
npm run build
# Output: dist/

# Deploy server
cd server && npm start
```

## Key Constants
- `TICK_RATE_MS`: 1000 (game tick frequency)
- `SAVE_VERSION`: 6 (schema version)
- `AUTO_SAVE_INTERVAL_MS`: 30000 (30 seconds)
- `MAX_LOGS`: 100 (in-memory log limit)

## Language Support
- Spanish (es) - Default
- English (en)
- Toggle in Settings view

## Important Notes
1. **No Backend DB**: All data stored in localStorage
2. **Migration System**: Auto-runs on load to handle schema changes
3. **Offline Mode**: Time warp calculation when player returns
4. **P2P Relay**: Socket.io server relays messages, doesn't store game state
5. **Persistence**: Encoded save string prevents casual tampering
