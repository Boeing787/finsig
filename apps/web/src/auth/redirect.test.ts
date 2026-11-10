import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../../proxy';
import { proxyRedirect, publicOrigin, redirectTo } from './redirect';

function renderRequest(path: string): NextRequest {
  return new NextRequest(`http://0.0.0.0:10000${path}`, {
    headers: { host: 'finsig-demo.onrender.com', 'x-forwarded-proto': 'https' },
  });
}

async function withoutBaseUrl<T>(run: () => T | Promise<T>): Promise<T> {
  const previous = process.env.APP_BASE_URL;
  delete process.env.APP_BASE_URL;
  try {
    return await run();
  } finally {
    if (previous !== undefined) process.env.APP_BASE_URL = previous;
  }
}

test('signed-out proxy redirect is an absolute public URL', async () => {
  // Next parses a proxy Location with `new URL(location)` and no base; a relative one is a 500.
  const response = await withoutBaseUrl(() => proxy(renderRequest('/app/transactions')));
  assert.equal(response.status, 307);
  const location = response.headers.get('location') ?? '';
  assert.doesNotThrow(() => new URL(location));
  assert.equal(location, 'https://finsig-demo.onrender.com/login?next=%2Fapp%2Ftransactions');
  assert.throws(() => proxyRedirect(renderRequest('/app'), 'https://evil.example/'));
  assert.throws(() => proxyRedirect(renderRequest('/app'), '//evil.example/'));
});

test('route-handler redirects stay relative so a proxied internal host never leaks', () => {
  const response = redirectTo('/login?error=paypal_unavailable');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/login?error=paypal_unavailable');
  assert.throws(() => redirectTo('https://evil.example/'));
  assert.throws(() => redirectTo('//evil.example/'));
});

test('public origin prefers APP_BASE_URL, then forwarded host, never the bind address', () => {
  const request = new NextRequest('http://0.0.0.0:10000/api/auth/paypal/start', {
    headers: { host: 'finsig-demo.onrender.com', 'x-forwarded-proto': 'https' },
  });
  const previous = process.env.APP_BASE_URL;
  delete process.env.APP_BASE_URL;
  assert.equal(publicOrigin(request), 'https://finsig-demo.onrender.com');
  process.env.APP_BASE_URL = 'https://finsig.example/';
  assert.equal(publicOrigin(request), 'https://finsig.example');
  if (previous === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = previous;
});
