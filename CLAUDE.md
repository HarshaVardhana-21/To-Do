# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Full-stack to-do app ("TaskFlow") with two independent npm projects (no root package.json / workspaces):

- `backend/` — Express 5 + TypeScript (ESM, `module: NodeNext`), Mongoose 9, Zod 4, JWT auth. DB is MongoDB Atlas.
- `frontend/` — Vite 8 + React 19 + TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite`, no tailwind.config), React Router 7.

Run every command from inside `backend/` or `frontend/`.

## Commands

Backend (`cd backend`):
```bash
npm run dev            # tsx watch src/server.ts  (needs backend/.env, see .env.example)
npm run build          # tsc -> dist/ (tests are excluded; rootDir is src)
npm run typecheck
npm test               # Vitest; uses an in-memory MongoDB, never Atlas, needs no .env
npm run test:coverage  # thresholds enforced in test/vitest.config.ts
npm run test:typecheck
npx vitest run --config test/vitest.config.ts test/integration/auth.test.ts   # single file
npx vitest run --config test/vitest.config.ts -t "rejects a duplicate"        # by test name
```

Frontend (`cd frontend`):
```bash
npm run dev            # Vite on :5173, proxies /api -> http://localhost:5000
npm run build          # tsc -b && vite build
npm run lint           # oxlint
npm test               # Vitest + React Testing Library + MSW (mocked API, jsdom)
npm run test:coverage
npm run test:typecheck
npm run test:e2e       # Playwright: builds the app, starts its own servers on :5055 (API) and :5391 (web)
npx vitest run --config test/vitest.config.ts test/pages/dashboard.test.tsx -t "filters"
npx playwright test --config test/e2e/playwright.config.ts auth.spec.ts
```

The Vitest config lives in `test/vitest.config.ts` in both projects (not at the project root), so always pass `--config`.
E2E reuses the MongoDB binary the backend tests download to `backend/node_modules/.cache`, so run backend `npm test` once first. E2E uses the locally installed Chrome (`channel: 'chrome'`).

## Backend architecture

Request flow: `server.ts` (connect DB, listen) → `app.ts` (helmet, cors allow-list, json 100kb limit, morgan) → `routes/*` → `validate()` middleware (Zod) → controller → Mongoose model → central `errorHandler`.

- **Env is validated at import time** (`src/config/env.ts`) and calls `process.exit(1)` on invalid config. Any module importing env (most of them) needs valid `process.env` first. The test setup sets env vars before importing `src/`. `PORT` must be a positive number.
- **Errors**: Express 5 forwards async rejections natively. There is no asyncHandler, so controllers just `throw ApiError.*`. `middleware/errorHandler.ts` maps ApiError, ZodError, Mongoose Validation/Cast errors, duplicate key (11000 → 409), and body-parser errors (400/413) into `{ success: false, message, details? }`. Success responses are `{ success: true, data }`, and the frontend unwraps `data`.
- **Validation**: `middleware/validate.ts` replaces `req.body`/`req.params`/`req.query` with parsed Zod output. In Express 5 `req.query` is a getter, so it is redefined with `Object.defineProperty`. Controllers cast `req.body`/`req.query` to the `z.infer` types exported from `validators/*`. Zod objects strip unknown keys, which is what prevents mass assignment (e.g. `user`, `completedAt`).
- **Auth**: `requireAuth` verifies `Authorization: Bearer <jwt>` (payload `sub` = user id, must be a 24-hex ObjectId) and sets `req.userId` (typed via `declare global` in `middleware/auth.ts`). Use `authUserId(req)` in controllers. Auth routes have a rate limiter (50 req / 15 min per IP). `trust proxy` is 1, so `X-Forwarded-For` determines the IP, and tests rely on this to get fresh limiter buckets.
- **Ownership**: every todo query filters by `{ user: authUserId(req) }`. Another user's todo returns 404, not 403.
- **Todo model**: `priorityRank` (1–3) is a hidden numeric mirror of `priority`, set in a `pre('save')` hook, and is used for `sort=priority`. Updates therefore go through `findOne` → `doc.set()` → `save()` (not `findOneAndUpdate`) so the hook runs. `completedAt` is managed in controllers when `completed` flips. `toJSON` transforms rename `_id`→`id` and hide `__v`/`password`/`priorityRank`.
- **Listing** (`GET /api/todos`): filters `status`, `priority`, `tag`, `search` (escaped regex over title/description/tags), and `sort` + `order`. Title sort uses a case-insensitive collation. Due-date sort keeps undated todos last.
- Route order matters: `/stats` and `DELETE /completed` are registered before `/:id`.
- Known Zod gotcha, already handled: `z.union([z.null(), z.coerce.date()])`. Putting `z.null()` first matters because `coerce.date(null)` gives 1970. Also, email is normalized with `z.string().trim().toLowerCase().pipe(z.email())`.

## Frontend architecture

- `api/client.ts`: an axios instance with `baseURL = VITE_API_URL || '/api'`. It attaches the token from `localStorage['token']`. On a 401 from any non-login/register call it invokes a handler that `AuthProvider` registers (`setUnauthorizedHandler`), which logs the user out. `getErrorMessage()` turns API errors into display strings (first `details[].message`, then `message`, then network/timeout text).
- Auth state: `context/auth-context.ts` (the context object) + `context/AuthContext.tsx` (the provider; restores the session via `/auth/me` on load) + `hooks/useAuth.ts`. These are split so fast-refresh lint passes. `ProtectedRoute`/`PublicOnlyRoute` in `components/ProtectedRoute.tsx` guard routes, showing a spinner while the session is restoring.
- `hooks/useTodos.ts` owns all todo data for the dashboard. It refetches when filter fields change (with AbortController for stale requests) and does optimistic update/delete with rollback. Items that no longer match the active filters are dropped locally. Create and clear-completed refetch instead of patching locally. Toasts come from `react-hot-toast`.
- `pages/DashboardPage.tsx` persists filters (not search) to `localStorage['todoFilters']`, validating each value on load. Search is debounced (`useDebounce`, 300ms).
- `components/TodoForm.tsx` serves both quick-add (`compact`) and the edit modal (`initial`). Field ids come from `useId()` because both forms can be mounted at once. In add mode the form clears immediately on submit and restores the text on failure.
- Dates: due dates are stored as ISO strings at the **end of the local day** (`fromDateInput`/`toDateInput` in `lib/utils.ts`). `isOverdue` means the due day has fully passed.
- Theming: dark mode is the `dark` class on `<html>` (`@custom-variant dark` in `index.css`). An inline script in `index.html` applies the saved `localStorage['theme']` before paint. Shared styles are Tailwind v4 `@utility` classes (`btn-primary`, `card`, `input`, …) in `src/index.css`.
- `vite.config.ts` proxy target can be overridden with `VITE_API_PROXY_TARGET` (E2E uses this). `vite preview` inherits the same proxy.

## Testing architecture

- Backend (`backend/test/`): `setup/global-setup.ts` starts one `MongoMemoryServer` and passes the URI via Vitest `provide/inject`. `setup/setup.ts` sets env, connects Mongoose to a per-worker DB (`todo-test-<VITEST_POOL_ID>`), builds indexes, and wipes collections after each test. `helpers/factories.ts` creates users and todos directly through the models (bypassing the rate limiter) and signs tokens. `rate-limit.test.ts` is isolated in its own file so limiter counters start fresh. `env.test.ts` spawns child processes from an empty cwd so a real `.env` can't leak in.
- Frontend (`frontend/test/`): MSW handlers (`mocks/handlers.ts`) implement the REST API over an in-memory store (`mocks/db.ts`). Unhandled requests fail the test. `helpers/render.tsx` provides `renderApp(path)` (the real route tree inside a `MemoryRouter`), `signInAs()` (seeds a user and stores a token), and `waitForPath()`. Override endpoints per test with `server.use(...)`. The setup stubs `window.matchMedia`, which react-hot-toast needs. Real XHR timeouts can't be simulated under MSW + jsdom.
- E2E (`frontend/test/e2e/`): `start-backend.mjs` boots an in-memory MongoDB plus the real backend on :5055. Playwright builds the frontend and serves it with `vite preview` on :5391. The `account`/`authedPage` fixtures register users via the API with unique `X-Forwarded-For` values. Registration can be slow under parallel load (bcrypt cost 12).

## Environment notes

- Windows dev machine. Ports 5173/5174 may be occupied by other local apps (Vite then picks the next free port, which is fine because the dev proxy keeps it same-origin). The backend must own port 5000 for `npm run dev` in the frontend to work.
- Required backend env (`backend/.env`): `MONGODB_URI` (Atlas SRV string), `JWT_SECRET` (≥32 chars). Optional: `PORT` (5000), `JWT_EXPIRES_IN` (7d), `CLIENT_URL` (comma-separated CORS origins), `NODE_ENV`.
- For production builds, set `VITE_API_URL` (e.g. `https://api.example.com/api`).
