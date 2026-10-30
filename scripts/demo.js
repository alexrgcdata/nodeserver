import assert from 'node:assert/strict';
import { once } from 'node:events';
import { loadConfig } from '../src/config.js';
import { createServer } from '../src/server.js';

// Standalone real HTTP demo: use a free loopback port and private token without
// printing it. This does not require a separately running server.
try {
  const config = await loadConfig();
  const server = createServer(config);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    assert.equal(health.status, 200);
    console.log('GET /health ->', (await health.json()).result);
    for (const [action, params, expected] of [
      ['hello', [], 'hello world'], ['success', [], 'successful'],
      ['boolean', [], true], ['echo', ['example', 42, true, null, { nested: [1, 2] }], ['example', 42, true, null, { nested: [1, 2] }]],
    ]) {
      const response = await fetch(`${base}/api`, { method: 'POST', signal: AbortSignal.timeout(3000),
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params, time: new Date().toISOString() }) });
      const envelope = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(envelope.result, expected);
      console.log(`POST /api ${action} -> ${JSON.stringify(envelope.result)}`);
    }
    const unauthorized = await fetch(`${base}/api`, { method: 'POST', body: '{broken', signal: AbortSignal.timeout(3000) });
    assert.equal(unauthorized.status, 401);
    await unauthorized.arrayBuffer();
    console.log('Missing token + invalid JSON -> 401 (authentication first)');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} catch {
  console.error('Demo failed. Run npm run setup and npm test to check local setup.');
  process.exitCode = 1;
}
