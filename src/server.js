import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { performance } from 'node:perf_hooks';
import { actions } from './actions.js';
import { ParamsError } from './functions.js';
import { validateConfig } from './config.js';

function hash(value) {
  return createHash('sha256').update(value).digest();
}

// Require a real calendar date and an explicit RFC3339 timezone.
export function validTime(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const parts = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts) {
    return false;
  }

  const [, year, month, day, hour, minute, second, , offsetHour = '0', offsetMinute = '0'] = parts;
  const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= days[+month - 1]
    && +hour < 24 && +minute < 60 && +second < 60 && +offsetHour < 24 && +offsetMinute < 60;
}

export function createServer(config) {
  const settings = validateConfig(config);
  const tokenHash = hash(settings.token);
  const started = performance.now();
  let requests = 0;
  let errors = 0;
  let totalResponseMs = 0;

  const server = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    const requestStarted = performance.now();
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Count completed API responses only. Health and dashboard reads stay out.
    if (path === '/api') {
      res.once('finish', () => {
        requests += 1;
        totalResponseMs += performance.now() - requestStarted;
        if (res.statusCode >= 400) {
          errors += 1;
        }
      });
    }

    function reply(status, result = null, code = null, message = null) {
      if (res.writableEnded || res.destroyed) {
        return;
      }

      let error = null;
      if (code) {
        error = { code, message };
      }

      const response = {
        success: status < 400,
        result,
        error,
        request_id: requestId,
        time: new Date().toISOString(),
      };
      // Close after early rejection instead of consuming an unbounded unread body.
      if (!req.complete) res.setHeader('Connection', 'close');
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(response));
    }

    const deadline = setTimeout(() => {
      reply(408, null, 'request_timeout', 'request body took too long');
    }, 10000);
    res.once('close', () => clearTimeout(deadline));
    try {
      // Health is public. Actions and metrics use the same token check.
      if (path === '/health') {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return reply(405, null, 'method_not_allowed', 'use GET');
        }
        return reply(200, 'ok');
      }
      if (path !== '/api' && path !== '/admin/metrics') {
        return reply(404, null, 'not_found', 'route not found');
      }

      // Reject duplicate authorization headers and compare fixed-length hashes.
      const authorization = req.headersDistinct.authorization;
      let match = null;
      if (authorization?.length === 1) {
        match = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(authorization[0]);
      }
      if (!match || !timingSafeEqual(hash(match[1]), tokenHash)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="nodeServer"');
        return reply(401, null, 'unauthorized', 'a valid bearer token is required');
      }
      if (path === '/admin/metrics') {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return reply(405, null, 'method_not_allowed', 'use GET');
        }

        let averageResponseMs = 0;
        if (requests > 0) {
          averageResponseMs = totalResponseMs / requests;
        }

        return reply(200, {
          uptime_seconds: Math.floor((performance.now() - started) / 1000),
          requests,
          errors,
          average_response_ms: averageResponseMs,
        });
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

      function rejectLargeBody() {
        return reply(413, null, 'request_too_large', 'request body exceeds the configured limit');
      }

      // A declared length can reject early. Count actual bytes for streamed bodies.
      if (Number(req.headers['content-length']) > settings.maxRequestBytes) {
        return rejectLargeBody();
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        if (res.writableEnded) {
          return;
        }
        size += chunk.length;
        if (size > settings.maxRequestBytes) {
          return rejectLargeBody();
        }
        chunks.push(chunk);
      }

      let input;
      try {
        input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), (_key, value) => {
          // JSON accepts 1e400, but JavaScript turns it into Infinity and would
          // silently serialize it as null. Reject overflow at any nesting depth.
          if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('numeric overflow');
          return value;
        });
      } catch {
        return reply(400, null, 'invalid_json', 'provide exactly one valid UTF-8 JSON object with finite numbers');
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some((key) => !['action', 'params', 'time'].includes(key))
        || typeof input.action !== 'string' || input.action.length < 1 || input.action.length > 64
        || !Array.isArray(input.params)) {
        return reply(400, null, 'invalid_request', 'action is required, params must be an array; only action, params and time are allowed');
      }
      if (Object.hasOwn(input, 'time') && !validTime(input.time)) {
        return reply(400, null, 'invalid_time', 'time must be an RFC3339 timestamp');
      }

      // Only names registered in actions.js can reach application code.
      const handleAction = actions.get(input.action);
      if (!handleAction) {
        return reply(404, null, 'unknown_action', 'action is not registered');
      }

      const result = await handleAction(input.params);
      reply(200, result);
    } catch (error) {
      // Parameter errors are written for callers. Unexpected errors stay private.
      if (error instanceof ParamsError) {
        reply(400, null, 'invalid_params', error.message);
        return;
      }

      reply(500, null, 'action_failed', 'the request could not be completed');
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.setTimeout(15000, (socket) => socket.destroy());
  server.maxRequestsPerSocket = 100;
  return server;
}
