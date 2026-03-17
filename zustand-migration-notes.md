# Zustand migration notes

## What was migrated
- Game state to Zustand through `stores/gameStore.ts` and bootstrap in `stores/gameBootstrap.tsx`.
- Auth state to Zustand in `stores/authStore.ts`.
- Language state to Zustand in `stores/languageStore.ts`.
- Critical consumers moved to selectors:
  - `components/layout/GameLayout.tsx`
  - `components/layout/ViewRouter.tsx`
  - `components/GameHeader.tsx`
  - `components/GameSidebar.tsx`

## Provider cleanup
- Removed `LanguageProvider` and `AuthProvider` usage from `App.tsx`.
- Kept `GameProvider` as bootstrap bridge because `useGameEngine` remains hook-driven.

## Decision on Multiplayer
- Multiplayer was migrated to Zustand snapshot store in `stores/multiplayerStore.ts` with bootstrap sync in `hooks/useMultiplayerInternal.tsx`.

## Final status
- Legacy Context wrappers were removed:
  - `context/GameContext.tsx`
  - `context/AuthContext.tsx`
  - `context/LanguageContext.tsx`
- Runtime state access is now fully Zustand-based through hooks and selectors.

## Selector patterns
- Prefer narrow selectors:
  - `useGameStoreSelector(selectStatus)`
  - `useGameStoreSelector(state => state.gameState.empirePoints)`
- Avoid selecting full snapshot unless needed.

## Anti-patterns to avoid
- Avoid returning new objects from selectors unless shallow compare is used.
- Avoid using full `gameState` in components that only need one field.

## Post-migration checklist
- Validate login/logout flow.
- Validate game lifecycle (load, play, save, reset).
- Validate P2P attack flow and chat indicators.
- Run `npm run build`.
- Run `npm run test` and review existing baseline failures.
- Run `npm run typecheck` and review existing baseline TS issues.
