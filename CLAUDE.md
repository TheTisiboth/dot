# dot — Telegram bot for Ultimate Frisbee trainings

Rules only; the why lives in [`ADR.md`](ADR.md). Glossary and target layout: https://github.com/TheTisiboth/dot/issues/48

## Commands

- Before every push: `npm run verify` (type-check, lint + format, knip, tests); CI also runs build, ESM smoke and `docker build`
- `npm run dev` runs the bot locally; `npm run build` compiles to `dist/`

## Guidelines ([`ADR.md`](ADR.md))

- DOT-001 Group by feature; shared code knows no domain; only the entry point knows every module; infra knows no feature
- DOT-002 Decisions are pure functions; time and randomness are inputs; I/O only fetches, calls, sends
- DOT-003 Dependencies and config come through parameters; no mutable globals, no env reads, no self-built clients; constants OK; class only for state/lifecycle
- DOT-004 Validate/escape external input once at the boundary into typed values; times parsed once with explicit zone; trust inside
- DOT-005 External calls time-bounded; inner code throws, job boundary catches, logs once, reports; lost user-visible action → operator channel
- DOT-006 No state that a restart loses; re-arm at startup, check "already done?"; recognise own output by marker
- DOT-007 Built-in test runner, hand-written fakes, behavior-sentence names, no exact wording; bug fix ships its test
- DOT-008 Smallest complete change; no abstraction without a second caller, no unused option, no dependency for a few lines
- DOT-009 Glossary names; constants carry units; why-comments only; never `eslint-disable`; casts only at library boundaries
- DOT-010 Behavior change or restructure, never both; small changes, merged when checks pass

Breaking a guideline means changing `ADR.md` in the same PR, with the reason.

## Rules

- Env var: change the zod schema in `src/config/schema.ts`, the `environment:` list of `docker-compose.yml` and `.env.example` in the same change. Otherwise it never reaches the container (ADR-005)
- Secrets stay in `.env`, never committed
- Tests assert invariants and flows (👍 present, markers, numbers, who gets what when), not exact wording
- One PR per issue, branched off `main`
