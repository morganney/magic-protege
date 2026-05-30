import { spawnSync } from 'node:child_process'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'

type CurrentConnectionInfo = {
  currentDatabase: string
  currentUser: string
  serverAddress: string
  serverPort: number | null
}

loadEnvFile('.env')

function fail(message: string) {
  console.error(`db:migrate failed: ${message}`)
  process.exit(1)
}

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    fail(`Missing required environment variable ${name}.`)
  }

  return value
}

async function checkConnection(label: string) {
  const host = getEnv('POSTGRES_HOST')
  const port = Number(getEnv('POSTGRES_PORT'))
  const user = getEnv('POSTGRES_USER')
  const password = getEnv('POSTGRES_PASSWORD')
  const database = getEnv('POSTGRES_DB')

  if (!Number.isInteger(port) || port <= 0) {
    fail('POSTGRES_PORT must be a positive integer.')
  }

  const sql = postgres({
    host,
    port,
    user,
    password,
    database,
    ssl: false,
    max: 1,
    connect_timeout: 5,
  })

  try {
    const [{ currentDatabase, currentUser, serverAddress, serverPort }] = await sql<
      CurrentConnectionInfo[]
    >`
      select
        current_database() as "currentDatabase",
        current_user as "currentUser",
        coalesce(inet_server_addr()::text, 'local') as "serverAddress",
        inet_server_port() as "serverPort"
    `

    if (currentDatabase !== database) {
      fail(
        `Connected to database ${currentDatabase} instead of expected ${database}. Check .env.`,
      )
    }

    console.log(
      `[db:migrate] ${label}: connected to ${currentDatabase} as ${currentUser} at ${serverAddress}:${serverPort}`,
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    fail(`Unable to connect to database: ${reason}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function runDrizzleMigrate() {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(
    command,
    ['drizzle-kit', 'migrate', '--config=drizzle.config.ts'],
    {
      stdio: 'inherit',
    },
  )

  if (result.error) {
    fail(`Unable to start drizzle-kit: ${result.error.message}`)
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }

  if (result.signal) {
    fail(`drizzle-kit terminated by signal ${result.signal}`)
  }
}

async function main() {
  await checkConnection('pre-check')
  runDrizzleMigrate()
  await checkConnection('post-check')
}

await main()
