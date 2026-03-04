# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React + TypeScript app focused on MACD simulation for crypto candles.
- `src/main.tsx`: app entry point.
- `src/App.tsx`: page-level state, Binance fetch, MACD simulation controls.
- `src/components/CandlestickChart.tsx`: D3 chart rendering and tooltip behavior.
- `src/utils/indicators.ts`: pure MACD/EMA calculation and reverse-MACD math.
- `src/types.ts`: shared interfaces (`KLine`, `MACDResult`, `MACDConfig`).
- `src/index.css`: Tailwind v4 theme tokens and chart styling.
- Root config: `vite.config.ts`, `tsconfig.json`, `.env.example`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server on `http://0.0.0.0:3000`.
- `npm run build`: produce production bundle in `dist/`.
- `npm run preview`: serve the built bundle locally.
- `npm run lint`: run TypeScript type-check (`tsc --noEmit`).
- `npm run clean`: remove `dist/`.

Set `GEMINI_API_KEY` in `.env.local` before running locally.

## Coding Style & Naming Conventions
- Use TypeScript with React function components and hooks.
- Follow existing formatting: semicolons, single quotes, trailing commas where applicable, 2-space indentation.
- Component files use PascalCase (example: `CandlestickChart.tsx`).
- Utility files/functions use lower camelCase (example: `calculateMACD`, `reverseMACD`).
- Keep shared data contracts in `src/types.ts`.
- Use `@/` alias (configured in `vite.config.ts`) for root-based imports when helpful.

## Testing Guidelines
There is currently no dedicated unit test framework configured. Minimum validation for changes:
1. Run `npm run lint` (must pass).
2. Run `npm run build` (must pass).
3. Smoke-test key flows in `npm run dev` (symbol search, MACD parameter edits, simulation slider).

If you add tests, place them near the module they cover (for example `src/utils/indicators.test.ts`) and keep names aligned to the unit under test.

## Commit & Pull Request Guidelines
Git history is not available in this workspace snapshot, so follow a consistent convention:
- Commit format: `type(scope): short imperative summary` (example: `feat(chart): add MACD crosshair tooltip`).
- Keep commits focused and small.
- PRs should include: purpose, changed files/areas, validation steps run, and screenshots/GIFs for UI changes.
- Link related issues/tasks when applicable.
