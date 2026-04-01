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