# Backend tests

Vitest + Supertest against a real (in-memory) MongoDB, so tests never touch Atlas and need no `.env`.

```bash
npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage  # coverage report -> test/coverage/index.html
npm run test:typecheck # type-check tests + src
```

## Layout
```
test/
├── vitest.config.ts      config (root = backend/)
├── tsconfig.json         type-checking for tests
├── setup/
│   ├── global-setup.ts   starts one MongoMemoryServer per run
│   ├── setup.ts          per-worker env + DB connection, wipes collections after each test
│   └── test-env.ts       test env values (JWT secret, CORS origins, ...)
├── helpers/
│   ├── factories.ts      createUser / createTodo / signRaw token helpers
│   └── http.ts           supertest agent + unique-IP helper for rate-limited routes
├── unit/                 ApiError, JWT, validators, models, middleware, env config
└── integration/          HTTP tests: app/security, auth, todos CRUD/query/stats,
                          authorization & isolation, rate limiting
```

## Notes
- Each Vitest worker uses its own database (`todo-test-<poolId>`), so files run in parallel safely.
- `rate-limit.test.ts` is kept in its own file so the limiter's in-memory counters start fresh.
- `env.test.ts` imports `src/config/env.ts` in child processes (from an empty cwd, so a developer's `.env` is ignored).
- The first run downloads a MongoDB binary (~100 MB), which is cached afterwards.
