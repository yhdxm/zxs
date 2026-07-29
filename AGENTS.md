# AGENTS.md

## Project overview
- This repository is a Vue 3 + Vite + TypeScript demo app.
- Main entry points are [src/main.ts](src/main.ts), [src/App.vue](src/App.vue), and [src/router/index.ts](src/router/index.ts).
- UI components use Element Plus and Vant; keep style and behavior consistent with the existing patterns.

## Working conventions
- Prefer small, focused changes. Keep components simple and reuse existing patterns from the current project.
- When editing Vue files, preserve the existing template/script/style structure unless a clear refactor is needed.
- Use TypeScript types where practical; avoid introducing unnecessary runtime complexity.
- Keep Chinese comments and UI text consistent with the current project style unless the task explicitly requires English.

## Commands
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build for production: `npm run build`
- Type-check: `npm run type-check`

## Important notes
- The project uses Vite and the dev server is the primary way to verify UI changes locally.
- If adding new routes, register them in [src/router/index.ts](src/router/index.ts) and keep navigation consistent in [src/App.vue](src/App.vue).
- If adding new shared logic, prefer placing it under [src/services](src/services) or [src/lib](src/lib) rather than scattering utility code across components.
- If a change affects the AI integration flow, keep the provider abstraction in [src/services/aiService.ts](src/services/aiService.ts) and avoid hard-coding provider-specific logic inside UI components.

## Preferred workflow
1. Inspect the relevant Vue component, router, and service files before editing.
2. Make the smallest change that solves the task.
3. Verify with the relevant command (`npm run build` or `npm run type-check`) when possible.
4. Summarize the result clearly, including any follow-up steps if the change requires a running local service such as Ollama.
