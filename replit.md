# Iron Dune: Operations

## Overview

Iron Dune: Operations is a browser-based military strategy game built as a single-page application. Players build bases, manage resources (Money, Oil, Ammo, Gold, Diamonds), recruit military units, research technologies, and engage in PvP/PvE combat. The game features offline progression, a banking system with variable interest rates, a procedural market, a campaign mode, a war system, and a tutorial/objective tracker. It runs entirely client-side with state persisted to localStorage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React 18 + TypeScript** with Vite as the build tool. No backend server — everything runs in the browser.
- Tailwind CSS loaded via CDN (`<script src="https://cdn.tailwindcss.com">`) with custom theme configuration inline in `index.html`. No PostCSS or build-time Tailwind setup.
- Glassmorphism UI design pattern with dark theme, custom animations, and responsive mobile/desktop layouts.

### State Management
- **React Context + useState** pattern. No Redux or external state library.
- `GameContext` wraps the entire app and exposes the game engine hook (`useGameEngine`).
- `LanguageContext` provides i18n (English/Spanish) with dictionary objects.
- Game state is a single large `GameState` object updated immutably via `setGameState`.

### Game Engine Architecture
- **Custom game loop** running at 1-second tick rate (`TICK_RATE_MS = 1000`). Implemented in `hooks/useGameLoop.ts` using `setInterval`.
- Delta-time based calculations ensure accuracy regardless of timing drift.
- Engine logic is split into modular files under `utils/engine/`:
  - `loop.ts` — tick calculation
  - `actions.ts` — player actions (build, recruit, research, trade, etc.)
  - `combat.ts` — battle simulation with rapid-fire mechanics
  - `finance.ts` — bank transactions
  - `offline.ts` — offline progress simulation (Time Warp)
  - `migration.ts` — save version migration
  - `security.ts` — save file encoding/hashing
  - `rankings.ts` — bot-based ranking system
  - `selectors.ts` — derived state calculations (income stats, etc.)

### Data Layer
- All game definitions are static data objects in `data/`:
  - `buildings.ts` — building definitions with cost scaling formulas
  - `units.ts` — unit stats, costs, rapid-fire tables
  - `techs.ts` — technology tree with prerequisites
  - `campaigns.ts` — PvE campaign levels
  - `tutorial.ts` — tutorial step definitions with conditions
  - `initialState.ts` — starting game state
- Cost formulas live in `utils/formulas.ts` supporting both linear and exponential scaling.

### Component Architecture
- **Barrel file pattern** used extensively (`UIComponents.tsx`, `GameViews.tsx`, `types.ts`).
- Views organized under `components/views/` — one per game tab (Buildings, Units, Research, Finance, Market, Campaign, Missions, Reports, Rankings, War, Simulator).
- Layout components in `components/layout/` — `GameLayout.tsx` (main shell) and `ViewRouter.tsx` (tab routing).
- Reusable UI primitives in `components/ui/` — GlassButton, Card, SmartTooltip, ResourceDisplay, CostDisplay, QuantitySelector, SpeedUpButton, TerminalLogs.
- Modal components for combat reports, PvP attacks, tactical intercepts, commander profiles.

### Event System
- Custom `EventBus` singleton (`utils/eventBus.ts`) for decoupled communication.
- Typed events via `GameEventType` enum and `GameEventPayloads` interface.
- `useEventSubscription` hook for React component subscriptions with automatic cleanup.

### Persistence
- **localStorage** for save data. Single key `ironDuneSave`.
- Save files include version field for migration support (`sanitizeAndMigrateSave`).
- Import/Export as `.ids` files with hash-based integrity verification.
- Language preference stored separately in localStorage.

### Offline Progression
- On load, calculates elapsed time since last save and simulates: resource production, queue completion, bank interest, unit desertion, and threat escalation.
- Shows an `OfflineWelcome` modal with a summary report.

### Combat System
- Round-based simulation with rapid-fire mechanics (units get bonus attacks against specific targets).
- Unit priority system for target selection.
- Supports PvP attacks, defensive battles, campaign missions, patrols, and war waves.

### Type System
- Types split across `types/enums.ts`, `types/defs.ts`, `types/state.ts`, `types/events.ts`.
- Barrel exported from `types.ts` for backward compatibility.
- Enums used for all game entity identifiers (BuildingType, UnitType, TechType, ResourceType, etc.).

### i18n
- Two languages: English (`i18n/en/`) and Spanish (`i18n/es/`).
- Dictionary-based translation with nested keys accessed via `t.category.key` pattern.
- Default language is Spanish (`es`).

## External Dependencies

### Runtime Dependencies
- **React 18.3** — UI framework
- **React DOM 18.3** — DOM rendering
- **@google/genai ^0.2.0** — Google Gemini AI SDK (referenced in package.json; likely used for AI strategic advisor feature, requires `GEMINI_API_KEY` environment variable)

### Dev Dependencies
- **Vite 5.4** — Build tool and dev server (configured on port 5000, host 0.0.0.0)
- **TypeScript 5.5** — Type checking
- **@vitejs/plugin-react** — React fast refresh for Vite

### External Services
- **Tailwind CSS CDN** — Loaded at runtime via script tag (not a build dependency)
- **Google Gemini API** — AI integration requiring `GEMINI_API_KEY` in `.env.local`
- **localStorage** — Browser storage for game saves and preferences
- No database, no backend server, no authentication system