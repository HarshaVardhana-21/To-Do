// Starts an in-memory MongoDB and the real backend against it, for Playwright's webServer.
// Nothing here touches Atlas or a developer's backend/.env.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const backendDir = fileURLToPath(new URL('../../../backend/', import.meta.url))
// Reuse the MongoDB binary the backend test suite already downloaded (the cache dir is
// otherwise resolved from cwd, which would trigger a second ~260 MB download).
process.env.MONGOMS_DOWNLOAD_DIR ??= join(backendDir, 'node_modules/.cache/mongodb-memory-server')
const require = createRequire(join(backendDir, 'package.json'))
const { MongoMemoryServer } = require('mongodb-memory-server')

const port = process.env.E2E_API_PORT ?? '5055'
const mongod = await MongoMemoryServer.create()
console.log(`[e2e] MongoDB at ${mongod.getUri()}`)

const api = spawn(process.execPath, [join(backendDir, 'node_modules/tsx/dist/cli.mjs'), 'src/server.ts'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: port,
    MONGODB_URI: `${mongod.getUri()}todo-e2e`,
    JWT_SECRET: 'e2e-jwt-secret-that-is-definitely-32-chars-plus',
    JWT_EXPIRES_IN: '1h',
    CLIENT_URL: 'http://localhost:5391',
    DOTENV_CONFIG_PATH: join(backendDir, '.env.e2e-nonexistent'), // never load a real .env
  },
})

const shutdown = async () => {
  api.kill()
  await mongod.stop().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
api.on('exit', async (code) => {
  await mongod.stop().catch(() => {})
  process.exit(code ?? 1)
})
