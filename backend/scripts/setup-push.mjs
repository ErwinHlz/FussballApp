// Sets up web push for the LOCAL stack (run from backend/: npm run setup:push).
//
// 1. Creates VAPID keys once (kept in supabase/functions/.env, git-ignored).
// 2. Puts the public key into frontend/.env.local (VITE_VAPID_PUBLIC_KEY).
// 3. Tells the database cron job where the Edge Function is (private.push_config).
//
// Production: create keys the same way, set VAPID_* as Edge Function secrets
// (`supabase secrets set ...`), VITE_VAPID_PUBLIC_KEY in the hosting environment, and insert
// the project's function URL + service key into private.push_config once.
import { execSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const FUNCTIONS_ENV = new URL('../supabase/functions/.env', import.meta.url)
const FRONTEND_ENV = new URL('../../frontend/.env.local', import.meta.url)

function readEnv(url) {
  if (!existsSync(url)) return {}
  return Object.fromEntries(
    readFileSync(url, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  )
}

function writeEnv(url, values, header) {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`)
  writeFileSync(url, `${header ? `# ${header}\n` : ''}${lines.join('\n')}\n`)
}

// 1. VAPID keys (P-256): public key = uncompressed point, private key = raw scalar (base64url).
const functionsEnv = readEnv(FUNCTIONS_ENV)
if (!functionsEnv.VAPID_PUBLIC_KEY || !functionsEnv.VAPID_PRIVATE_KEY) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  const priv = privateKey.export({ format: 'jwk' })
  const raw = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(pub.x, 'base64url'),
    Buffer.from(pub.y, 'base64url'),
  ])
  functionsEnv.VAPID_PUBLIC_KEY = raw.toString('base64url')
  functionsEnv.VAPID_PRIVATE_KEY = priv.d
  functionsEnv.VAPID_SUBJECT ??= 'mailto:admin@example.test'
  writeEnv(FUNCTIONS_ENV, functionsEnv, 'Local Edge Function secrets (git-ignored). Created by scripts/setup-push.mjs')
  console.log('created VAPID keys in supabase/functions/.env')
} else {
  console.log('VAPID keys already present')
}

// 2. Public key for the app.
const frontendEnv = readEnv(FRONTEND_ENV)
frontendEnv.VITE_VAPID_PUBLIC_KEY = functionsEnv.VAPID_PUBLIC_KEY
writeEnv(FRONTEND_ENV, frontendEnv)
console.log('wrote VITE_VAPID_PUBLIC_KEY to frontend/.env.local')

// 3. Where the cron job finds the function (inside the docker network).
const status = JSON.parse(
  execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/^[^{]*/, ''),
)
const project = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8').match(
  /^project_id = "([^"]+)"/m,
)[1]
const url = `http://supabase_kong_${project}:8000/functions/v1/push-dispatch`
const sql = `insert into private.push_config (id, dispatch_url, service_key) values (1, '${url}', '${status.SERVICE_ROLE_KEY}') on conflict (id) do update set dispatch_url = excluded.dispatch_url, service_key = excluded.service_key;`
execSync(`docker exec -i supabase_db_${project} psql -U postgres -v ON_ERROR_STOP=1`, { input: sql, stdio: ['pipe', 'ignore', 'inherit'] })
console.log(`cron job will call ${url}`)
console.log('Restart the stack once so the Edge Function picks up the keys: npm run stop && npm start')
