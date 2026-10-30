import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer, validTime } from '../src/server.js';
import { validateConfig } from '../src/config.js';

const token = randomBytes(32).toString('base64url');
let server;
let port;
before(async () => {
  server = createServer({ token, maxRequestBytes: 512 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
});
after(() => new Promise((resolve) => server.close(resolve)));

// Use actual HTTP sockets, including duplicate headers and chunked bodies.
function request({ path = '/api', method = 'POST', headers = {}, body = '', chunked = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(text) }));
    });
    req.on('error', reject);
    if (chunked) req.write(body);
    req.end(chunked ? undefined : body);
  });
}

function checkEnvelope(response) {
  assert.deepEqual(Object.keys(response.data).sort(), ['error', 'request_id', 'result', 'success', 'time']);
  assert.equal(response.data.request_id, response.headers['x-request-id']);
  assert.match(response.data.request_id, /^[0-9a-f-]{36}$/);
  assert.ok(validTime(response.data.time));
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
}

test('health is public and returns a consistent envelope', async () => {
  const response = await request({ path: '/health', method: 'GET', headers: { Authorization: '' } });
  assert.equal(response.status, 200);
  assert.equal(response.data.result, 'ok');
  assert.equal(response.data.error, null);
  checkEnvelope(response);
});

test('all registered actions preserve JSON types and generate server metadata', async () => {
  const mixed = ['text', 3.5, true, false, null, { nested: [1, 'two'] }, []];
  for (const [action, params, expected] of [
    ['hello', [], 'hello world'], ['success', [], 'successful'],
    ['boolean', [], true], ['echo', mixed, mixed],
  ]) {
    const response = await request({ body: JSON.stringify({ action, params, time: '2020-02-29T01:02:03+05:30' }) });
    assert.equal(response.status, 200);
    assert.equal(response.data.success, true);
    assert.equal(response.data.error, null);
    assert.deepEqual(response.data.result, expected);
    assert.notEqual(response.data.time, '2020-02-29T01:02:03+05:30');
    checkEnvelope(response);
  }
});

test('authentication precedes JSON, method, content type and body processing', async () => {
  for (const Authorization of ['', 'Basic abc', 'Bearer wrong', `Bearer ${token} extra`, [`Bearer ${token}`, `Bearer ${token}`]]) {
    const response = await request({ method: 'PUT', headers: { Authorization, 'Content-Type': 'text/plain' }, body: '{broken' });
    assert.equal(response.status, 401);
    assert.equal(response.data.error.code, 'unauthorized');
    assert.ok(response.headers['www-authenticate']);
    assert.equal(JSON.stringify(response.data).includes(token), false);
    checkEnvelope(response);
  }
  const response = await request({ headers: { Authorization: '' }, body: 'x'.repeat(1024) });
  assert.equal(response.status, 401);
});

test('methods and unknown HTTP routes return useful statuses', async () => {
  for (const [path, method, status, allow] of [
    ['/health', 'POST', 405, 'GET'], ['/api', 'GET', 405, 'POST'], ['/missing', 'GET', 404, undefined],
  ]) {
    const response = await request({ path, method });
    assert.equal(response.status, status);
    assert.equal(response.headers.allow, allow);
  }
});

test('malformed JSON, envelopes, actions and parameters fail clearly', async () => {
  const cases = [
    ['', 400, 'invalid_json'], ['{bad', 400, 'invalid_json'], ['{}{}', 400, 'invalid_json'],
    ['null', 400, 'invalid_request'], ['[]', 400, 'invalid_request'],
    ['{"action":"hello"}', 400, 'invalid_request'],
    ...[null, {}, 'text', 2, true].map((params) => [JSON.stringify({ action: 'echo', params }), 400, 'invalid_request']),
    [JSON.stringify({ action: 1, params: [] }), 400, 'invalid_request'],
    [JSON.stringify({ action: '', params: [] }), 400, 'invalid_request'],
    [JSON.stringify({ action: 'x'.repeat(65), params: [] }), 400, 'invalid_request'],
    [JSON.stringify({ action: 'hello', params: [], extra: true }), 400, 'invalid_request'],
    ...['unknown', 'constructor', '__proto__'].map((action) => [JSON.stringify({ action, params: [] }), 404, 'unknown_action']),
    ...['hello', 'success', 'boolean'].map((action) => [JSON.stringify({ action, params: [1] }), 400, 'invalid_params']),
    ...[null, '', 123, '2026-02-30T00:00:00Z', '2026-01-01', '2026-01-01T25:00:00Z']
      .map((time) => [JSON.stringify({ action: 'hello', params: [], time }), 400, 'invalid_time']),
  ];
  for (const [body, status, code] of cases) {
    const response = await request({ body });
    assert.equal(response.status, status, body);
    assert.equal(response.data.error.code, code, body);
    assert.equal(response.data.result, null);
    assert.equal(response.data.success, false);
    checkEnvelope(response);
  }
});

test('requires UTF-8 JSON, rejects compressed content and malformed UTF-8', async () => {
  for (const headers of [
    { 'Content-Type': '' }, { 'Content-Type': 'text/plain' },
    { 'Content-Type': 'application/json; charset=latin1' }, { 'Content-Encoding': 'gzip' },
  ]) {
    assert.equal((await request({ headers, body: '{"action":"hello","params":[]}' })).status, 415);
  }
  assert.equal((await request({ body: Buffer.from([0xff]) })).data.error.code, 'invalid_json');
  assert.equal((await request({ headers: { 'Content-Type': 'application/json; charset="UTF-8"' },
    body: '{"action":"hello","params":[]}' })).status, 200);
});

test('bounds bodies both with Content-Length and chunked encoding', async () => {
  for (const chunked of [false, true]) {
    const response = await request({ body: 'x'.repeat(513), chunked });
    assert.equal(response.status, 413);
    assert.equal(response.data.error.code, 'request_too_large');
  }
  // A rejected request must not break the listener.
  assert.equal((await request({ path: '/health', method: 'GET' })).status, 200);
});

test('configuration fails closed and timeouts are bounded', () => {
  for (const config of [null, {}, { token: '' }, { token, port: -1 }, { token, maxRequestBytes: 0 }, { token, host: '' }]) {
    assert.throws(() => validateConfig(config));
  }
  assert.equal(validateConfig({ token }).host, '127.0.0.1');
  assert.equal(server.headersTimeout, 10000);
  assert.equal(server.requestTimeout, 15000);
  assert.equal(server.keepAliveTimeout, 5000);
});

test('an unfinished request body receives 408 within its deadline', { timeout: 13000 }, async () => {
  const response = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api', method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': '100' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { req.destroy(); resolve({ status: res.statusCode, data: JSON.parse(body) }); });
    });
    req.on('error', reject);
    // Deliberately never finish the advertised body.
    req.write('{');
  });
  assert.equal(response.status, 408);
  assert.equal(response.data.error.code, 'request_timeout');
  assert.equal((await request({ path: '/health', method: 'GET' })).status, 200);
});

test('timestamp validation checks leap years, calendar and timezone', () => {
  for (const time of ['2024-02-29T23:59:59.123456789Z', '2026-01-01t00:00:00z', '2026-01-01T00:00:00-05:00']) {
    assert.ok(validTime(time), time);
  }
  for (const time of ['2025-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2026-04-31T00:00:00Z',
    '2026-01-01T00:00:00+24:00', '2026-01-01T00:00:00+00:60', '2026-01-01T00:00:60Z']) {
    assert.equal(validTime(time), false, time);
  }
});
