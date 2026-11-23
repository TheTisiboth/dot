# dot — engineering guidelines

How code is designed and written in this repo. Each guideline holds for any code here,
existing or not yet written. Stack-wide rules (Docker, env forwarding, backups) live in the
stack ADRs (`raspberry-pi-config/ADR.md`) and are referenced, not copied.

A guideline does not expire. To change one, replace it explicitly: mark it
**Superseded by DOT-XXX** and add the new one at the bottom, with the reason. A change that
has to break a guideline updates this file in the same change.

Each guideline ends with how it is enforced: lint, test, CI or review. Where a tool can
check it, a tool does.

---

## DOT-001: Module boundaries

**Status:** Accepted

**Context:** without a rule, code lands wherever the last similar file was, and domain rules
leak into shared helpers.

**Decision:** code is grouped by feature. A feature owns its types and its user-facing text.
Features depend on infrastructure and shared helpers, never the other way round. Shared code
knows nothing about the domain. Only the entry point knows every module. Infrastructure is
code that talks to the outside or runs jobs (messaging client, scheduler, model client,
logging) and knows no feature.

**Why:** a feature can be read, changed or removed in one place, and a helper can be reused
without dragging a feature along.

**Consequence:** a helper that needs a domain type belongs to that feature.

**Enforced by:** lint (import restrictions between folders), review.

---

## DOT-002: Pure core, thin I/O shell

**Status:** Accepted

**Context:** logic mixed with network calls, timers or the clock can only be tested by
faking the world.

**Decision:** a decision (what to do, what to say, whether something matches) is a pure
function of its inputs. Time and randomness are inputs. Code that talks to the outside
(network, timers, process) only fetches, calls the pure part, and sends.

**Why:** the pure part is tested directly, with no setup, and its result is reproducible.

**Enforced by:** review (a decision that needs a fake to be tested breaks it).

---

## DOT-003: Explicit dependencies, one composition root

**Status:** Accepted

**Context:** a module that imports a global config or builds its own client hides what it
needs and cannot be tested with a fake.

**Decision:** collaborators and configuration arrive through parameters. Nothing reads
mutable global state or runtime configuration directly, reads the environment, or builds its
own client. Immutable constants are imported freely. The entry point builds everything and
wires it. A class only when it owns mutable state or a lifecycle (connect, start, stop);
holding injected collaborators alone is not a reason: a function taking them as parameters
is.

**Why:** what a unit needs is visible in its signature, and a test swaps any collaborator.

**Consequence:** the environment is read once, by the config module the entry point loads.

**Enforced by:** test (environment access restricted to the config module), review.

---

## DOT-004: Parse at the boundary, trust inside

**Status:** Accepted

**Context:** the same raw string parsed in several places drifts, and unescaped external
text breaks formatted output.

**Decision:** whatever comes from outside (environment, generated text, messages read back,
user input) is validated or escaped once, where it enters, and turned into typed values.
Inside, no string is parsed twice and nothing is re-checked defensively. A time is parsed
once into a value with an explicit time zone; nothing does arithmetic on wall-clock strings.

**Why:** one parser means one behavior and one place to fix it; types carry the guarantee
from there.

**Consequence:** a function receiving raw external text is a boundary and owns its parsing.

**Enforced by:** type check (typed values past the boundary), test (parsers), review.

---

## DOT-005: Failure policy

**Status:** Accepted

**Context:** a hung call stalls a job forever; an error swallowed deep inside looks like
success.

**Decision:** every external call is bounded in time. Inner code throws; only the outermost
boundary of a job (a scheduled tick, a timer, a command) catches, logs once with context,
and reports. A caller is never told "done" for something that failed. One job failing never
stops another. Losing a user-visible action is
also reported to an operator channel set in configuration, not only logged.

**Why:** a failure is seen exactly once, where its context is complete, and never hidden.

**Consequence:** inner code catches only to recover (retry, fallback) or to add context and
rethrow.

**Enforced by:** test (failing dependency → error reported, other jobs run), review.

---

## DOT-006: Nothing to lose on restart

**Status:** Accepted

**Context:** the process is redeployed at any time; state held only in memory disappears
with it.

**Decision:** the process holds no state it cannot rebuild from its source of truth. A
scheduled action is re-armed at startup and checks "already done?" before acting, so a
restart neither drops nor repeats it. The bot recognises its own output by structure or by
a marker set in code, never by generated text.

**Why:** deploys become safe at any moment, and recognition does not break when wording
changes.

**Consequence:** an in-memory cache is an optimisation, never the only copy.

**Enforced by:** test (restart before / after an action), review.

---

## DOT-007: Testing

**Status:** Accepted

**Context:** tests coupled to wording or internals break on every harmless change and stop
being trusted.

**Decision:** the runtime's built-in test runner, no mocking library. Test names are
sentences about behavior. Pure functions are tested directly; I/O through small hand-written
fakes passed as dependencies. Tests assert outcomes and invariants, not exact wording. A bug
fix ships with the test that failed before it.

**Why:** tests survive refactors and copy edits, and fail only when behavior breaks.

**Consequence:** code that needs patching internals to be tested is redesigned (DOT-003).

**Enforced by:** pre-push checks (type check, lint, tests), review.

---

## DOT-008: Simplicity

**Status:** Accepted

**Context:** unused options, wrappers and dependencies cost reading time and upgrades
forever.

**Decision:** the smallest change that fully solves the task. Before writing: does it need
to exist, is it already in the repo, in the standard library, in an installed dependency? No
abstraction without a second caller, no option nobody passes, no dependency for what a few
lines do. Validation, error handling and security are never what gets cut.

**Why:** less code is less to read, test and break.

**Consequence:** removing unused code is always a valid change.

**Enforced by:** knip (unused files, exports, dependencies), review.

---

## DOT-009: Naming, comments and casts

**Status:** Accepted

**Context:** two words for one concept, or one word for two, makes code and logs ambiguous.

**Decision:** names come from the [project glossary](README.md#glossary): one word per concept, one concept per
word. A constant carries its unit. A comment explains a non-obvious why, never what the code
does. No lint rule is disabled inline. A type cast is allowed only at a library boundary,
with the reason. Everything else is the linter's decision, not a discussion.

**Why:** a name means the same thing everywhere, and review time goes to design, not style.

**Consequence:** a new concept adds its word to the glossary first.

**Enforced by:** lint (inline config disabled, style), review (names, comments, casts).

---

## DOT-010: Change discipline

**Status:** Accepted

**Context:** a change that mixes restructuring with new behavior cannot be reviewed or
reverted safely.

**Decision:** a change either alters behavior or restructures code, never both. Changes are
small and independent, and merge only when the checks pass. A configuration variable changes
everywhere it is declared, in the same change (stack ADR-005).

**Why:** each change is reviewable on its own and revertable without collateral.

**Consequence:** a behavior change found during a restructuring becomes its own change.

**Enforced by:** pre-push checks (type check, lint, tests), review.
