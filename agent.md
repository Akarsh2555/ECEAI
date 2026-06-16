cat > /home/claude/AGENT.md << 'EOF'
# AGENT.md — Universal AI Coding Agent Instructions
# Drop this file at the root of any project. All AI agents (Claude Code,
# Cursor, Copilot, Windsurf, Aider) will read it automatically.
# Customise Section 0 per project; everything else is universal best practice.

---

## SECTION 0 — PROJECT CONTEXT (customise per project)

```
Project      : ECE Copilot
Stack        : React 18 (Vite) · React Flow · LangGraph · FastAPI · Supabase
Monorepo     : /frontend  /backend  /supabase  /shared
Entry points : frontend/src/main.tsx  |  backend/main.py
Env files    : frontend/.env  |  backend/.env  (never commit these)
Package mgr  : npm (frontend)  |  pip (backend)
Test runner  : vitest (frontend)  |  pytest (backend)
Lint/format  : eslint + prettier (frontend)  |  ruff + black (backend)
```

> To reuse this AGENT.md on a different project, replace only this section.
> Everything below is project-agnostic and should stay unchanged.

---

## SECTION 1 — CARDINAL RULES (never break these)

1. **Never touch what was not asked.**
   If the task is "fix the filter cutoff bug", do not refactor the canvas
   store, rename variables, or reorder imports in unrelated files.
   Scope = the minimum change that solves the stated problem.

2. **Never hallucinate APIs, packages, or function signatures.**
   If you are not 100% certain a method exists in the installed version,
   check the source file or docs before using it. Do not invent parameters.

3. **Never delete or overwrite without showing the diff first.**
   For any destructive change (file delete, full rewrite, schema migration),
   present the before/after and wait for confirmation.

4. **Never commit secrets.**
   `.env`, API keys, service-role keys, tokens — always in environment
   variables. If you see a hardcoded secret anywhere in the codebase,
   flag it immediately and do not proceed until it is removed.

5. **Never skip error handling.**
   Every async call gets a try/catch or .catch(). Every FastAPI endpoint
   returns a typed error response. Silently swallowed errors are bugs.

6. **Never assume the happy path.**
   Write for the case where the network is down, the user is unauthenticated,
   the API returns an unexpected shape, and the input is empty or malformed.

---

## SECTION 2 — HOW TO READ A TASK

Before writing a single line of code, do this in order:

```
1. RESTATE the task in one sentence.
2. LIST every file that will change.
3. LIST every file that might be affected but will NOT change.
4. IDENTIFY the single biggest risk or ambiguity.
5. ASK about that ambiguity if it would change the approach.
   (One question only. Do not interrogate.)
6. THEN start coding.
```

If the task is large (more than ~3 files or ~100 lines), break it into
numbered sub-tasks and confirm the breakdown before starting.

---

## SECTION 3 — CODE QUALITY STANDARDS

### General
- Write code for the next developer, not for the compiler.
- Every function does one thing. If you need "and" to describe it, split it.
- Name variables for what they contain, not how they were obtained.
  `filteredDesigns` not `result`, `userEmail` not `data`.
- Magic numbers and strings become named constants.
- Comments explain WHY, not WHAT. The code already says what.

### TypeScript / React
- Strict mode on. No `any` unless wrapping a third-party boundary,
  and always with a comment explaining why.
- Props interfaces are explicit. No spreading unknown props onto DOM elements.
- Side effects belong in `useEffect`. Derived values are `useMemo` or
  plain computation — not state.
- Never mutate state directly. Zustand: use `set()`. React: use setter.
- Component files export one primary component. Helpers go in `/lib` or `/utils`.
- CSS: Tailwind utility classes only. No inline `style={{}}` except for
  dynamic values that cannot be expressed as classes (e.g. chart dimensions).

### Python / FastAPI
- Type-annotate every function signature. Pydantic models for all
  request/response bodies — no raw `dict` in endpoint signatures.
- FastAPI dependency injection for auth, DB, and config. Not globals.
- Async all the way down. No blocking calls in async endpoints.
  Use `asyncio.to_thread()` for CPU-bound work (NumPy, SciPy).
- One router per domain (`/math`, `/api`, `/auth`). Register in `main.py`.
- Raise `HTTPException` with a human-readable `detail` string.
  Never return `{"error": True}` — use HTTP status codes correctly.

### LangGraph / Agent nodes
- Every node function has signature `(state: GraphState) -> GraphState`.
- Nodes are pure functions: same input → same output. No hidden I/O.
- LLM nodes call `_emit_trace(state, message)` on entry AND exit.
- Deterministic nodes (validators) have zero LLM calls. Enforce this with
  a comment: `# DETERMINISTIC — no LLM calls in this node`.
- Never compute numeric results inside an LLM node. Call the math service.

---

## SECTION 4 — FILE CONVENTIONS

```
frontend/src/
  components/   → UI only. No business logic, no direct Supabase calls.
  hooks/        → All data fetching and side effects. One hook per domain.
  store/        → Zustand slices. One file per slice.
  lib/          → Singleton clients (supabaseClient, apiClient, sseClient).
  pages/        → Route-level components only. Compose from components/.
  types/        → TypeScript interfaces. No runtime code here.

backend/
  graph/nodes/  → One file per LangGraph node.
  math_service/ → One file per math endpoint family.
  auth/         → JWT verification only.
  sse/          → SSE session registry and router.
```

**One concern per file.** If a file exceeds ~200 lines, ask whether it
should be split before adding to it.

---

## SECTION 5 — GIT DISCIPLINE

Commit message format:
```
<type>(<scope>): <short imperative description>

type  : feat | fix | refactor | test | chore | docs
scope : frontend | backend | supabase | shared | ci
```

Examples:
```
feat(backend): add /math/bode endpoint with freqz support
fix(frontend): correct MUX selector pin validation in digital validator
refactor(backend): extract _emit_trace into shared graph utils
test(backend): add pytest cases for clamper diode polarity check
```

Rules:
- Commits are atomic. One logical change per commit.
- Never commit directly to `main`. Branch → PR → merge.
- Branch names: `feat/bode-plot`, `fix/mux-wiring`, `chore/update-deps`.
- Never force-push to a shared branch.

---

## SECTION 6 — TESTING REQUIREMENTS

Every non-trivial change ships with a test. No exceptions.

### What to test
```
Frontend (vitest + React Testing Library):
  - Every hook: mock Supabase, assert correct state transitions
  - Every Zustand store action: pure unit tests
  - Every validator function (imported from backend via shared/): property tests
  - SSE event handling: mock EventSource, assert store updates

Backend (pytest + httpx AsyncClient):
  - Every /math endpoint: known input → known numeric output (within tolerance)
  - Every LangGraph node: mock LLM client, assert state mutations
  - Digital/analog validators: test every error condition explicitly
  - Auth middleware: test with valid token, expired token, missing token
```

### Test naming
```python
# Python
def test_butter_lowpass_returns_correct_order():
def test_digital_validator_flags_floating_input():
def test_jwt_middleware_rejects_expired_token():
```
```typescript
// TypeScript
it('returns filter coefficients for 4th-order Butterworth lowpass')
it('flags floating input on AND gate')
it('rejects expired Supabase JWT')
```
## EXECUTION MODES

### Mode: Analysis
- Read code only
- No edits
- Explain findings
- Provide implementation plan

### Mode: Patch
- Make smallest possible change
- Preserve architecture
- Do not refactor unrelated code

### Mode: Refactor
- Refactor only the explicitly requested scope
- Maintain behavior
- Run tests before and after

### Mode: Architect
- Design system
- Produce RFC
- No code unless requested

Default = Patch

## SEARCH BEFORE CODING

Before writing code:

1. Search for existing implementation.
2. Search for existing utility.
3. Search for existing API usage.
4. Search for existing test.
5. Reuse before creating.

Never create:
- duplicate hooks
- duplicate services
- duplicate utility functions
- duplicate API wrappers

## EVIDENCE RULE

Every code change must cite evidence.

Example:

Evidence:
- backend/auth.py line 42
- frontend/hooks/useAuth.ts line 18

Reason:
Token expiry is not propagated.

Change:
Update refresh logic.

Never modify code without identifying the exact source.

## HALLUCINATION PREVENTION

Do not assume:

- library versions
- API signatures
- database schema
- environment variables
- route names
- table names

Verify first.

If verification is impossible:
STATE ASSUMPTION EXPLICITLY.

## PLANNING THRESHOLD

If change affects:

- >3 files
- >100 LOC
- database schema
- authentication
- payment flows
- deployment

STOP.

Produce plan first.
Wait for approval.

## RESPONSE FORMAT

For every task provide:

### Understanding
<one sentence>

### Files To Change
- file1
- file2

### Plan
1.
2.
3.

### Changes Made
...

### Validation
...

### Risks
...

## RESPONSE FORMAT

For every task provide:

### Understanding
<one sentence>

### Files To Change
- file1
- file2

### Plan
1.
2.
3.

### Changes Made
...

### Validation
...

### Risks
...


## PRODUCTION SAFETY

Never directly modify:

- migrations
- auth logic
- payment logic
- deployment configs

Without:

1. Impact analysis
2. Rollback plan
3. Explicit confirmation
## SELF REVIEW

Before finishing:

- Did I solve the requested problem?
- Did I modify unrelated files?
- Did I introduce duplication?
- Did I verify assumptions?
- Did I add tests?
- Is there a simpler solution?

If any answer is "No":
Revise.


## SENIOR ENGINEER PRINCIPLES

Optimize for:

1. Correctness
2. Maintainability
3. Simplicity
4. Performance

Never optimize performance before correctness.

Prefer boring solutions over clever solutions.

Code should be understandable by a new engineer in under 5 minutes.

### Coverage gate
- Backend math functions: 100% line coverage. These are safety-critical.
- LangGraph nodes: 80% minimum.
- Frontend hooks: 80% minimum.
- UI components: snapshot tests only, no coverage gate.

---

## SECTION 7 — SECURITY CHECKLIST

Run this check before every PR:

```
[ ] No secrets in source code (grep -r "sk-" . --include="*.ts" --include="*.py")
[ ] Supabase anon key only in frontend; service-role key only in backend
[ ] All FastAPI endpoints have Depends(verify_token)
[ ] Supabase RLS policies exist for every table (check supabase/migrations/)
[ ] No raw SQL string interpolation (use parameterised queries / Supabase client)
[ ] User-supplied input is validated with Pydantic before use
[ ] File upload paths are sanitised (no ../../../ traversal)
[ ] CORS origin list is explicit — not "*" in production
[ ] SSE endpoint authenticates via token query param — validate on connect
```

---

## SECTION 8 — PERFORMANCE RULES

### Frontend
- No component renders on every keystroke unless it is an input.
  Debounce canvas serialisation to Supabase (500ms minimum).
- Plotly charts are lazy-loaded (`React.lazy` + `Suspense`).
- React Flow canvas: virtualise nodes when count > 50.
- Supabase queries always have `.select('col1,col2')` — never `select('*')`
  in production list queries.

### Backend
- NumPy/SciPy operations run in `asyncio.to_thread()` to avoid blocking
  the event loop.
- SSE sessions are stored in memory only. They are not written to Supabase
  until the graph completes (`status = 'complete'`).
- LLM calls use streaming where the response is long (script generation).
  Short structured extractions (parameter parsing) use non-streaming.
- Never call an LLM inside a loop. Batch or parallelize with `asyncio.gather`.

---

## SECTION 9 — DEBUG PROTOCOL

When something is broken, follow this order. Do not skip steps.

```
1. READ the full error message. All of it. Including the stack trace.
2. IDENTIFY the exact file and line number where it originates.
3. REPRODUCE with the smallest possible input.
4. HYPOTHESIZE one cause. State it explicitly before changing anything.
5. CHANGE one thing. Run the test.
6. If still broken: revisit step 3. Do not accumulate changes.
```

When reporting a bug or asking for help, always include:
- The exact error message (not a paraphrase)
- The input that triggered it
- What you expected vs what happened
- What you already tried

---

## SECTION 10 — WHAT TO DO WHEN STUCK

If after two attempts a problem is not solved:

1. Stop adding code. More code on a misunderstood problem makes it worse.
2. Restate the problem from scratch as if explaining to someone new.
3. Check whether the mental model of the system is correct:
   - Is the data actually what you think it is? Log it.
   - Is the function actually being called? Add a trace.
   - Is the async code actually awaited? Check every `await`.
4. Search the codebase for a working example of the same pattern.
5. Check the library's changelog for breaking changes since the last version.
6. Ask: "What is the simplest possible thing that could work here?"

---

## SECTION 11 — HANDOFF CHECKLIST

Before marking any task complete:

```
[ ] All tests pass (vitest run + pytest)
[ ] No TypeScript errors (tsc --noEmit)
[ ] No Python type errors (mypy .)
[ ] No linting errors (eslint . + ruff check .)
[ ] No console.log or print() statements left in production paths
[ ] No TODO comments without an issue number
[ ] README updated if a new env var, endpoint, or setup step was added
[ ] AGENT.md Section 0 updated if the stack changed
```

---

## SECTION 12 — ANTI-PATTERNS (never do these)

```
✗  Storing derived state in useState when useMemo suffices
✗  useEffect with missing or over-inclusive dependency arrays
✗  Direct DOM manipulation inside React components
✗  Calling supabase.from() inside a React component body (use hooks)
✗  Returning 200 OK with {"success": false} in the body
✗  Catching an exception and re-throwing a less informative one
✗  A LangGraph node that modifies state it did not receive as input
✗  An LLM node that performs arithmetic or computes coefficients
✗  A Pydantic model with fields typed as `Any`
✗  Running pytest with -x disabled (always fail fast)
✗  Merging a PR with failing CI
✗  Writing a migration that drops a column without a prior backup step
```

---

*This file is the contract between you and every AI agent that touches this codebase.
Keep it honest, keep it current, and every agent will produce output you can ship.*
EOF

echo "Done. Line count:"
wc -l /home/claude/AGENT.md
Output

Done. Line count:
319 /home/claude/AGENT.md