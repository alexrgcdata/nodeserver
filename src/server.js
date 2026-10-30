import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { actions } from './actions.js';
import { ParamsError } from './functions.js';
import { validateConfig } from './config.js';

const hash = (value) => createHash('sha256').update(value).digest();

// Require a real calendar date and an explicit RFC3339 timezone.
export function validTime(value) {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [, year, month, day, hour, minute, second, , offsetHour = '0', offsetMinute = '0'] = parts;
  const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= days[+month - 1]
    && +hour < 24 && +minute < 60 && +second < 60 && +offsetHour < 24 && +offsetMinute < 60;
}

export function createServer(config) {
  const settings = validateConfig(config);
  const tokenHash = hash(settings.token);
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, result = null, code = null, message = null) => {
      if (res.writableEnded || res.destroyed) return;
      // Close after early rejection instead of consuming an unbounded unread body.
      if (!req.complete) res.setHeader('Connection', 'close');
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: status < 400, result,
        error: code ? { code, message } : null, request_id: requestId, time: new Date().toISOString() }));
    };
    const deadline = setTimeout(() => reply(408, null, 'request_timeout', 'request body took too long'), 10000);
    res.once('close', () => clearTimeout(deadline));
    try {
      // HTTP routes: health is public; every /api method authenticates first.
      const path = req.url.split('?')[0];
      if (path === '/health') {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return reply(405, null, 'method_not_allowed', 'use GET');
        }
        return reply(200, 'ok');
      }
      if (path !== '/api') return reply(404, null, 'not_found', 'route not found');
      const authorization = req.headersDistinct.authorization;
      const match = authorization?.length === 1 && /^Bearer ([A-Za-z0-9_-]+)$/i.exec(authorization[0]);
      if (!match || !timingSafeEqual(hash(match[1]), tokenHash)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="nodeServer"');
        return reply(401, null, 'unauthorized', 'a valid bearer token is required');
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return reply(405, null, 'method_not_allowed', 'use POST');
      }
      if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(req.headers['content-type'] ?? '')) {
        return reply(415, null, 'unsupported_media_type', 'use Content-Type: application/json with UTF-8');
      }
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
        return reply(415, null, 'unsupported_encoding', 'send uncompressed JSON');
      }
      const tooLarge = () => reply(413, null, 'request_too_large', 'request body exceeds the configured limit');
      if (Number(req.headers['content-length']) > settings.maxRequestBytes) return tooLarge();
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        if (res.writableEnded) return;
        size += chunk.length;
        if (size > settings.maxRequestBytes) return tooLarge();
        chunks.push(chunk);
      }
      let input;
      try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { return reply(400, null, 'invalid_json', 'provide exactly one valid UTF-8 JSON object'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some((key) => !['action', 'params', 'time'].includes(key))
        || typeof input.action !== 'string' || input.action.length < 1 || input.action.length > 64
        || !Array.isArray(input.params)) {
        return reply(400, null, 'invalid_request', 'action is required, params must be an array; only action, params and time are allowed');
      }
      if (Object.hasOwn(input, 'time') && !validTime(input.time)) {
        return reply(400, null, 'invalid_time', 'time must be an RFC3339 timestamp');
      }
      const action = actions.get(input.action);
      if (!action) return reply(404, null, 'unknown_action', 'action is not registered');
      const result = await action(input.params);
      reply(200, result);
    } catch (error) {
      if (error instanceof ParamsError) reply(400, null, 'invalid_params', error.message);
      else reply(500, null, 'action_failed', 'the request could not be completed');
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.setTimeout(15000, (socket) => socket.destroy());
  server.maxRequestsPerSocket = 100;
  return server;
}
