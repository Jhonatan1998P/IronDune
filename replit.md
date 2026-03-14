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

### Auth & Save System Overhaul (Latest Session)
✅ Fixed Supabase authentication and hybrid save system:
- **AuthView**: Added username field for registration; creates `profiles` + `player_economy` rows on signup
- **usePersistence**: Full rewrite with Supabase-first load, localStorage fallback, and 2-min server sync
- **DATABASE_INSTALL.md**: Added PARCHE CRÍTICO with correct RLS policies (profiles INSERT was missing)
- **RLS Policies**: Fixed all tables — `profiles` (insert/update/delete own), `player_economy`, `player_buildings`, `player_research`, `player_units`, `reports`, `inbox`
- **Offline progress**: Re-enabled `calculateOfflineProgress` for localStorage-loaded saves
- **Export/Import**: Functional save export (`.idb` file) and import with signature validation

### Post-Merge (Socket.io Migration - Task #1)
✅ Migrated P2P from Trystero (WebRTC) to Express + Socket.io
- Created `server/index.js` with Express.js + Socket.io
- Rewrote `hooks/useMultiplayerInternal.tsx` to use socket.io-client
- All dependent hooks work without changes (same interface contract)
- Environment variable: `VITE_SOCKET_SERVER_URL` (default: localhost:3001)
- Added post-merge setup script at `.local/post-merge/setup.sh`

### Game Loop Fixes
✅ Fixed critical game loop performance issues:
- Added proper ref for status to prevent closure staleness
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

## Authentication & Persistence (Supabase)

### Auth System
- `context/AuthContext.tsx` — Session/user/role state via Supabase Auth
- `components/auth/AuthView.tsx` — Login + Register form with username field
- Roles: `user | moderator | admin | dev` from `profiles.role`

### Hybrid Save System (`hooks/usePersistence.ts`)
| Layer | Frequency | Security |
|-------|-----------|----------|
| **localStorage** | Every 30s + on game actions | Base64-encoded + DJB2 signature |
| **Supabase** | Every 2 minutes + manual save | Row-Level Security per user |

**Load order on startup**: Supabase → localStorage → new game

### Supabase Tables
- `profiles` — user record, `empire_points`, `game_state` (JSON misc fields)
- `player_economy` — money, oil, ammo, gold, diamond, bank
- `player_buildings` — building levels/quantities per user
- `player_research` — tech levels per user
- `player_units` — unit counts per user
- `reports` — game log events

**Critical**: Run the **PARCHE CRÍTICO** SQL block in `DATABASE_INSTALL.md` if tables exist but data isn't saving (missing RLS write policies on `profiles`).

### Environment Variables
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_SOCKET_SERVER_URL=https://irondune.onrender.com
```

## Key Constants
- `TICK_RATE_MS`: 1000 (game tick frequency)
- `SAVE_VERSION`: 6 (schema version)
- `AUTO_SAVE_LOCAL_MS`: 30000 (30 seconds, localStorage)
- `AUTO_SAVE_SERVER_MS`: 120000 (2 minutes, Supabase)
- `MAX_LOGS`: 100 (in-memory log limit)

## Language Support
- Spanish (es) - Default
- English (en)
- Toggle in Settings view

## Important Notes
1. **Hybrid Persistence**: localStorage (fast) + Supabase (cloud, 2min interval)
2. **Migration System**: Auto-runs on load to handle schema changes
3. **Offline Mode**: Time warp calculation on localStorage loads
4. **P2P Relay**: Socket.io server relays messages, doesn't store game state
5. **Security**: localStorage saves are Base64+signed; Supabase enforces RLS per user
