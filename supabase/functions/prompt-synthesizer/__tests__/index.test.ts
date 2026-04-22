import { assertEquals, assert } from '@std/assert';

const hasJWT = !!Deno.env.get('TEST_PAID_JWT');
const skip = !hasJWT;

Deno.test({
  name: 'rejects unauthenticated with 401 or 403',
  ignore: skip,
  async fn() {
    const res = await fetch('http://localhost:54321/functions/v1/prompt-synthesizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'x', name: 'n' }),
    });
    assert(res.status === 401 || res.status === 403);
    await res.body?.cancel();
  },
});

Deno.test({
  name: 'rejects body without prompt',
  ignore: skip,
  async fn() {
    const res = await fetch('http://localhost:54321/functions/v1/prompt-synthesizer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('TEST_PAID_JWT')}`,
      },
      body: JSON.stringify({ name: 'n' }),
    });
    assertEquals(res.status, 400);
    await res.body?.cancel();
  },
});

Deno.test({
  name: 'rejects name over 128 chars',
  ignore: skip,
  async fn() {
    const res = await fetch('http://localhost:54321/functions/v1/prompt-synthesizer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('TEST_PAID_JWT')}`,
      },
      body: JSON.stringify({ prompt: 'x', name: 'n'.repeat(200) }),
    });
    assertEquals(res.status, 400);
    await res.body?.cancel();
  },
});
