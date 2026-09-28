# Frontend tests

Two layers:

| Layer | Tools | What it exercises |
|---|---|---|
| Unit / component / page | Vitest, React Testing Library, user-event, MSW, jsdom | Every module in `src/`, against a mocked API |
| End-to-end | Playwright (local Chrome) | Production build + **real backend** + in-memory MongoDB |

```bash
npm test               # unit + component + page tests
npm run test:watch     # watch mode
npm run test:coverage  # coverage report -> test/coverage/index.html
npm run test:typecheck # type-check tests + src
npm run test:e2e       # end-to-end (starts its own servers; report -> test/e2e/report)
```

## Layout
```
test/
├── vitest.config.ts
├── tsconfig.json
├── setup/setup.ts        jest-dom, MSW lifecycle, matchMedia stub, per-test reset
├── mocks/
│   ├── db.ts             in-memory users/todos/tokens mirroring the backend
│   ├── handlers.ts       MSW handlers implementing the REST API
│   └── server.ts
├── helpers/render.tsx    renderApp (real route tree in MemoryRouter), signInAs, waitForPath
├── unit/                 utils, API client, hooks, AuthContext, useTodos
├── components/           TodoItem/List, TodoForm, TodoFilters, StatsBar, Modal, Navbar, ...
├── pages/                routing & guards, Login/Register, Dashboard flows
└── e2e/
    ├── playwright.config.ts
    ├── start-backend.mjs  in-memory MongoDB + real Express API on :5055
    ├── fixtures.ts        account/authedPage fixtures, helpers
    └── *.spec.ts          auth, todos, responsive (desktop + Pixel 7)
```

## Notes
- E2E uses ports **5055** (API) and **5391** (web) and never touches Atlas or your `.env`.
  It builds the app and serves it with `vite preview`, whose proxy points at the test API.
- E2E reuses the MongoDB binary downloaded by the backend tests (`backend/node_modules/.cache`),
  so run `npm test` in `backend/` at least once first.
- Real XHR timeouts can't be simulated under MSW + jsdom; timeout messaging is unit-tested instead.
