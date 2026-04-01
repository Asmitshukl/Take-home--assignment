# Day 1 — Read and fixed

## What I Did

Read through the full codebase in `src/` to understand the structure before writing any tests:

- `src/app.js` — Express app setup, error handler middleware
- `src/routes/tasks.js` — All route handlers
- `src/services/taskService.js` — In-memory store with all business logic
- `src/utils/validators.js` — Input validation for create and update

Then wrote two test files in `tests/`:

| File | Type | Tests |
|------|------|-------|
| `taskService.unit.test.js` | Unit | Calls `taskService.js` functions directly |
| `taskService.test.js` | Integration | HTTP requests via Supertest against the full Express app |

---

## Test Coverage

![Coverage Output](./screenshots/Screenshot%20from%202026-04-01%2012-17-26.png)

**53 tests, 2 test suites, all passing.**

### Uncovered lines — explained

| File | Lines | Reason |
|------|-------|--------|
| `app.js` | 10-11, 17-18 | `app.listen()` and global error handler — only run in production, not in test |
| `tasks.js` | 21 | Minor branch in `GET /stats` |
| `taskService.js` | 22 | `getStats` short-circuit when task has no `dueDate` at all |
| `validators.js` | 28, 31 | `dueDate` validation branch in `validateUpdateTask` |

None of these are meaningful gaps — all core logic and every route are fully covered.

---

## Bugs Found

### Bug 1 — `GET /tasks/:id` route missing

The route simply did not exist in `tasks.js`. Any request to `/tasks/:id` fell through to a 404. Discovered by writing the integration test for it — the test immediately failed with 404 even for a task that had just been created.

**Fix:** Added the missing route handler:

```js
router.get('/:id', (req, res) => {
  const task = taskService.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});
```

> **Note:** This route must be declared **after** `router.get('/stats', ...)` — otherwise Express matches `/stats` as an `:id` param and the stats endpoint breaks.

---

### Bug 2 — Pagination off-by-one (1-indexed route, 0-indexed service)

The route defaulted `page` to `1`:

```js
const pageNum = parseInt(page) || 1;
```

But `getPaginated` in the service is 0-indexed:

```js
const offset = page * limit; // page=1, limit=10 → skips first 10 items
```

So `GET /tasks?page=1&limit=10` skipped the first page entirely. Page 0 returned nothing because `parseInt('0') || 1` evaluates to `1` due to `0` being falsy.

**Fix:**

```js
const pageNum = parseInt(page) ?? 0;  // or: page !== undefined ? parseInt(page) : 0
```

---

## How to Run

```bash
npm test         # run all tests
npm run coverage # run tests + coverage report
```

State is in-memory — resets on every test run automatically via `taskService._reset()` called in `beforeEach`.


# Day 2 — Find & Build

## What I Did

Reviewed test results from Day 1 to identify bugs, fixed one, and added a new endpoint.

---

## Part A: Bug Report

### Bug 1 — `GET /tasks/:id` route missing

**Expected behavior:** `GET /tasks/:id` should return the task matching the given id with a `200` response.

**What actually happens:** Every request to `/tasks/:id` returns `404` regardless of whether the task exists.

**How I discovered it:** Wrote an integration test that created a task via `POST /tasks` then immediately fetched it by id. The test failed with `404` even though the task had just been created successfully.

**Fix:**

```js
router.get('/:id', (req, res) => {
  const task = taskService.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});
```

> **Note:** This route must be declared **after** `router.get('/stats', ...)` — otherwise Express matches `/stats` as an `:id` param and the stats endpoint breaks.

---

### Bug 2 — Pagination off-by-one (1-indexed route, 0-indexed service)

**Expected behavior:** `GET /tasks?page=0&limit=10` returns the first 10 tasks. `GET /tasks?page=1&limit=10` returns the next 10.

**What actually happens:** `page=0` skips the first page entirely because `parseInt('0') || 1` evaluates to `1` since `0` is falsy in JavaScript. The first page is unreachable via the API.

**How I discovered it:** Wrote a pagination test seeding 5 tasks and requesting `page=0&limit=2`. The response returned items 3–4 instead of items 1–2.

**Fix:**

```js
const pageNum = parseInt(page) ?? 0;
```

---

## Part B: Fix Applied

Fixed both bugs above. Bug 1 was the higher priority since it made an entire endpoint completely unreachable. Bug 2 made pagination unusable from page 0.

Both fixes have corresponding passing tests in `taskService.test.js`.

---

## Part C: New Feature — `PATCH /tasks/:id/assign`

### What was added

**`validators.js`** — new `validateAssignTask` function that rejects missing, empty, whitespace-only, and non-string assignee values.

**`taskService.js`** — new `assignTask(id, assignee)` method that trims the assignee name and merges it onto the task. Reassignment is allowed — overwriting an existing assignee does not require any special flag.

**`routes/tasks.js`** — new `PATCH /:id/assign` route wired to the validator and service.

### Tests added (9 new tests)

| Case | Expected |
|------|----------|
| Valid assignee | `200` with `assignee` field set |
| Whitespace trimmed | `200`, value trimmed |
| Reassign already-assigned task | `200`, value overwritten |
| Unknown task id | `404` |
| Missing assignee field | `400` |
| Empty string | `400` |
| Whitespace-only string | `400` |
| Non-string value (e.g. `123`) | `400` |
| Persistence check via `GET /:id` | `200`, assignee persisted |

---

## Test Coverage

![Coverage Output](./screenshots/Screenshot%20from%202026-04-01%2012-57-39.png)

**62 tests, 2 test suites, all passing.**

---

## Submission Notes

### What surprised me in the codebase

The validation in `validators.js` was written manually — hand-rolling `typeof` checks, `trim()`, and `includes()` comparisons for every field. It works for the current scope, but it doesn't scale well. As the task object grows the manual approach becomes hard to maintain and easy to get wrong.

A library like **Zod** would be a better fit here. It co-locates the schema with the types, gives precise error messages for free, and handles edge cases like coercion and optional fields more reliably than manual checks. I would have converted the validators to Zod as a separate exercise to show what that migration would look like.

---

### Questions I'd ask before shipping to production

**1. In-memory store** — data is lost on every restart. Is this intentional for the scope of this project, or should a real database be wired up before this goes live?

**2. No authentication** — any caller can create, update, delete, or complete any task. Is there a plan for auth, or is this intentionally an internal-only tool?

**3. Error handling middleware** — the global error handler in `app.js` catches unhandled errors but is not independently tested. I'd want to confirm the error shape matches what the frontend or consumers expect before shipping.

**4. Process model** — the app runs as a single Node.js process. Before production I'd use the `cluster` module or a process manager like PM2 to fork worker processes across available CPU cores so the app can handle load without a single process becoming a bottleneck or taking everything down on crash.

---

## How to Run

```bash
npm test         # run all tests
npm run coverage # run tests + coverage report
```

State is in-memory — resets on every test run automatically via `taskService._reset()` called in `beforeEach`.