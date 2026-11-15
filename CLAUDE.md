# dot — Telegram bot for Ultimate Frisbee trainings

Rules only; the why lives in `ADR.md` (#87). Glossary and target layout: https://github.com/TheTisiboth/dot/issues/48

## Commands

- Before every push: `npm run check && npm test` (becomes `npm run verify` with #50)
- `npm run dev` runs the bot locally; `npm run build` compiles to `dist/`

## Rules

- Env var: change the zod schema in `src/config/schema.ts`, the `environment:` list of `docker-compose.yml` and `.env.example` in the same change. Otherwise it never reaches the container (ADR-005)
- Secrets stay in `.env`, never committed
- Tests assert invariants and flows (👍 present, markers, numbers, who gets what when), not exact wording
- Never `eslint-disable`: fix the cause
- Refactor PRs change no behavior; a behavior change gets its own issue
- No new abstraction without a second caller
- One PR per issue, branched off `main`
