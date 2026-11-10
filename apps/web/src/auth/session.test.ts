import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionToken, maskEmail, readSessionToken } from './session';

test('signed session round-trips and rejects tampering and expiry', async () => {
  const now = Date.UTC(2026, 10, 10);
  const token = await createSessionToken(
    { mode: 'paypal', name: 'Sandbox Freelancer', email: 'free@example.com', payerId: 'ABC123' },
    now,
  );
  const session = await readSessionToken(token, now + 1_000);
  assert.equal(session?.mode, 'paypal');
  assert.equal(session?.name, 'Sandbox Freelancer');

  const [payload, signature] = token.split('.');
  const forged = `${Buffer.from(JSON.stringify({ ...session, mode: 'paypal', name: 'Mallory' })).toString('base64url')}.${signature}`;
  assert.equal(await readSessionToken(forged, now + 1_000), null);
  assert.equal(await readSessionToken(`${payload}.x${signature}`, now + 1_000), null);
  assert.equal(await readSessionToken(token, now + 9 * 3_600_000), null);
  assert.equal(await readSessionToken(undefined, now), null);
});

test('email masking keeps the domain only', () => {
  assert.equal(maskEmail('freelancer@example.com'), 'fr••••••@example.com');
  assert.equal(maskEmail(null), null);
});
