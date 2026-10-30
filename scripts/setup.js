import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { configPath } from '../src/config.js';

try {
  // Exclusive creation never replaces an existing private configuration.
  await writeFile(configPath, `${JSON.stringify({ host: '127.0.0.1', port: 8080,
    maxRequestBytes: 65536, token: randomBytes(32).toString('base64url') }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created private config.local.json. The token was not printed.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('Kept existing config.local.json unchanged.');
  else { console.error('Could not create private configuration.'); process.exitCode = 1; }
}
