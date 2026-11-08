import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const token = process.env.RENDER_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const plan = process.env.RENDER_PLAN ?? 'starter';
if (!token || !anthropicKey) {
  throw new Error('RENDER_API_KEY and ANTHROPIC_API_KEY must be set in .env.local.');
}
if (!['starter', 'free'].includes(plan)) throw new Error('RENDER_PLAN must be starter or free.');

async function render(path, init = {}) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof body?.code === 'string' ? body.code : 'unknown';
    const detail = typeof body?.message === 'string' ? body.message.slice(0, 240) : '';
    throw new Error(`Render API returned HTTP ${response.status} (${code}). ${detail}`);
  }
  return body;
}

const owners = await render('/owners?limit=100');
const ownerIds = owners.map((item) => item.owner?.id).filter(Boolean);
const ownerId = process.env.RENDER_OWNER_ID ?? (ownerIds.length === 1 ? ownerIds[0] : null);
if (!ownerId || !ownerIds.includes(ownerId)) {
  throw new Error(`Set RENDER_OWNER_ID to one of: ${ownerIds.join(', ')}`);
}

const existing = await render(`/services?ownerId=${encodeURIComponent(ownerId)}&name=finsig-demo`);
const service = existing.find((item) => item.service?.name === 'finsig-demo')?.service;
if (service) {
  console.log(`Existing service: ${service.id} ${service.serviceDetails?.url ?? ''}`);
  process.exit(0);
}

const result = await render('/services', {
  method: 'POST',
  body: JSON.stringify({
    type: 'web_service',
    name: 'finsig-demo',
    ownerId,
    repo: 'https://github.com/dmrvcodes/finsig',
    branch: 'main',
    autoDeployTrigger: 'off',
    envVars: [
      { key: 'NODE_VERSION', value: '22.22.2' },
      { key: 'ANTHROPIC_MODEL', value: 'claude-sonnet-4-6' },
      { key: 'ANTHROPIC_API_KEY', value: anthropicKey },
    ],
    serviceDetails: {
      runtime: 'node',
      plan,
      region: 'frankfurt',
      healthCheckPath: '/',
      envSpecificDetails: {
        buildCommand:
          'corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @finsig/web build',
        startCommand: 'corepack pnpm --filter @finsig/web exec next start -H 0.0.0.0 -p $PORT',
      },
    },
  }),
});

console.log(`Created service: ${result.service?.id} ${result.service?.serviceDetails?.url ?? ''}`);
console.log(`Initial deploy: ${result.deployId ?? 'pending'}`);
