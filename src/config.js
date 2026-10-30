import { readFile } from 'node:fs/promises';

export const configPath = new URL('../config.local.json', import.meta.url);

export function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('invalid config object');
  if (typeof config.token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(config.token)) {
    throw new Error('config token must be 43-128 base64url characters; run npm run setup');
  }
  const settings = { host: '127.0.0.1', port: 8080, maxRequestBytes: 65536, ...config };
  if (typeof settings.host !== 'string' || !settings.host.trim()) throw new Error('invalid config host');
  if (!Number.isInteger(settings.port) || settings.port < 0 || settings.port > 65535) throw new Error('invalid config port');
  if (!Number.isInteger(settings.maxRequestBytes) || settings.maxRequestBytes < 1 || settings.maxRequestBytes > 1048576) {
    throw new Error('maxRequestBytes must be between 1 and 1048576');
  }
  return settings;
}

export async function loadConfig() {
  // Never include the file contents or parser errors (which may contain secrets).
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { throw new Error('cannot read config.local.json; run npm run setup or repair the file'); }
  return validateConfig(config);
}
