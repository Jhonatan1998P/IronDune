# Zustand profiling results (step 2)

## Scope
Critical views profiled using React `Profiler` with controlled state updates:
- `GameLayout`
- `ViewRouter`
- `GameHeader`
- `GameSidebar`

## Methodology
- Test file: `tests/zustand-render-profile.test.tsx`
- Iterations: `120` unrelated updates.
- Update pattern: toggle `hasSave` only (selected fields for profiled views remain stable).
- Baseline model (`legacy`): component subscribes via `useGame()` (whole snapshot).
- Zustand model (`selector`): component subscribes with fine-grained selectors (`useGameStoreSelector`).
- Measurement outputs:
  - `commits`: number of React commits captured by `Profiler`.
  - `durationMs`: accumulated `actualDuration` from `Profiler` callback.

## Command used
```bash
npx vitest run tests/zustand-render-profile.test.tsx
```

## Results
| View | Legacy commits | Selector commits | Legacy duration (ms) | Selector duration (ms) |
|---|---:|---:|---:|---:|
| GameLayout | 121 | 1 | 23.0887 | 1.1470 |
| ViewRouter | 121 | 1 | 7.8868 | 1.0666 |
| GameHeader | 121 | 1 | 7.8185 | 0.3305 |
| GameSidebar | 121 | 1 | 6.4476 | 0.3359 |

## Interpretation
- Selector-based subscriptions eliminate unnecessary rerenders under unrelated snapshot updates.
- In this controlled scenario, each critical view drops from `121` commits to `1` commit.
- Commit duration also drops significantly across all measured views.

## Notes
- This is an automated synthetic benchmark focused on subscription behavior and rerender isolation.
- It complements (not replaces) manual React DevTools profiling in real gameplay sessions.
