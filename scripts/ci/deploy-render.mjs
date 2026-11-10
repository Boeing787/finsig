const {
  RENDER_API_KEY: apiKey,
  RENDER_SERVICE_ID: serviceId,
  RENDER_EXPECTED_SHA: sha,
} = process.env;

if (!apiKey || !serviceId || !/^[a-f0-9]{40}$/.test(sha ?? '')) {
  throw new Error(
    'RENDER_API_KEY, RENDER_SERVICE_ID and a 40-character RENDER_EXPECTED_SHA are required.',
  );
}

const base = `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`;

async function render(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body?.message === 'string' ? body.message.slice(0, 200) : 'No detail returned';
    throw new Error(`Render API HTTP ${response.status}: ${message}`);
  }
  return body;
}

const deploy = await render('/deploys', {
  method: 'POST',
  body: JSON.stringify({ commitId: sha }),
});

if (!deploy?.id) throw new Error('Render did not return a deploy ID.');
console.log(`Render deploy ${deploy.id} created for ${sha}.`);

const deadline = Date.now() + 20 * 60_000;
const failures = new Set([
  'build_failed',
  'update_failed',
  'pre_deploy_failed',
  'canceled',
  'deactivated',
]);
let lastStatus = '';

while (Date.now() < deadline) {
  const current = await render(`/deploys/${encodeURIComponent(deploy.id)}`);
  if (current.commit?.id && current.commit.id !== sha) {
    throw new Error(`Render deploy commit mismatch: expected ${sha}, got ${current.commit.id}.`);
  }
  if (current.status !== lastStatus) {
    console.log(`Render deploy status: ${current.status}.`);
    lastStatus = current.status;
  }
  if (current.status === 'live') {
    const origin = 'https://finsig-demo.onrender.com';
    const smokeDeadline = Date.now() + 3 * 60_000;

    async function expectEventually(
      path,
      expected,
      validate = (response) => response.status === expected,
    ) {
      let lastResult = 'no response';
      let lastLoggedResult = '';

      while (Date.now() < smokeDeadline) {
        try {
          const response = await fetch(`${origin}${path}`, {
            redirect: 'manual',
            signal: AbortSignal.timeout(30_000),
          });
          lastResult = `HTTP ${response.status}`;
          if (validate(response)) return response;
        } catch (error) {
          lastResult = error instanceof Error ? error.message : 'unknown network error';
        }

        if (lastResult !== lastLoggedResult) {
          console.log(`Waiting for production smoke check ${path}: ${lastResult}.`);
          lastLoggedResult = lastResult;
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }

      throw new Error(`Smoke check ${path} did not become ready; last result: ${lastResult}.`);
    }

    const checks = [
      { path: '/', status: 200 },
      { path: '/login', status: 200 },
      { path: '/demo', status: 200 },
      { path: '/app', status: 307 },
      { path: '/api/paypal/sync', status: 401 },
    ];
    await Promise.all(checks.map(({ path, status }) => expectEventually(path, status)));
    await expectEventually(
      '/demo/studio',
      307,
      (response) =>
        response.status === 307 &&
        new URL(response.headers.get('location') ?? '/', origin).pathname === '/app/studio',
    );
    console.log('Production route smoke checks passed.');
    process.exit(0);
  }
  if (failures.has(current.status)) throw new Error(`Render deploy failed: ${current.status}.`);
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

throw new Error(`Render deploy timed out after 20 minutes; last status: ${lastStatus}.`);
