import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { publicOrigin, redirectTo } from './redirect';

test('redirects stay relative so a proxied internal host never leaks', () => {
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
