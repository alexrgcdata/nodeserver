# nodeServer

A small JavaScript action server, using Node's built-in HTTP server and test
runner. It implements the basic Go server contract in its own independent
repository. There are no third-party dependencies or build step.

## Run locally

Use Node.js 24 or newer. This version was checked on Windows with Node v24.14.0.
In PowerShell:

```powershell
Set-Location C:\AlexSeidler\projects\nodeServer
npm run setup
npm test
npm run demo
npm start
```

Setup creates `config.local.json` with a random 256-bit bearer token. It never
prints the token or overwrites an existing file. This private file is ignored by
Git; keep it private when copying the project. File permissions on Windows follow
the containing folder's Windows permissions.

The server defaults to `http://127.0.0.1:8080`. Open
`http://127.0.0.1:8080/health` to check it. Stop it with Ctrl+C. Shutdown allows
active requests up to five seconds to finish, then closes remaining connections.
The demo starts its own temporary listener on an available loopback port, sends
real requests using the private config, checks results, and stops itself.

This checkout's private config uses port **8787**, because 8080 was occupied
during verification. Its health URL is `http://127.0.0.1:8787/health`.

Edit `host`, `port`, or `maxRequestBytes` in the private config if needed. Port `0`
chooses an available port and prints its address on startup. The default body
limit is 65,536 bytes; configuration accepts 1 byte through 1 MiB. Keep the
loopback default for this local version. Remote hosting, TLS and deployment have
not been configured or tested.

## Request and response

`GET /health` is public and returns `"ok"` in the normal response envelope.
`POST /api` requires `Authorization: Bearer <your private token>` and
`Content-Type: application/json` (optionally `charset=utf-8`). Authentication
happens before method checks, JSON reading, or action dispatch on `/api`.

```json
{
  "action": "echo",
  "params": ["hello", 42, true, null, { "nested": [1, 2] }],
  "time": "2026-10-30T12:00:00Z"
}
```

`action` is a registered name of 1-64 characters. `params` is always required and
must be an array, including `[]` for an action with no parameters. `time` is
optional client metadata: omit it or provide an RFC3339 date and time with a
timezone. Empty strings, null, impossible dates and leap seconds are rejected.
Extra envelope fields and multiple JSON values are rejected. Bodies must be
uncompressed UTF-8 JSON.

| Action | Params | Result |
| --- | --- | --- |
| `hello` | `[]` | `"hello world"` |
| `success` | `[]` | `"successful"` |
| `boolean` | `[]` | `true` |
| `echo` | Any JSON array | The same array |

Every application response contains these five fields; `time` always comes from
the server in UTC, regardless of the client's timestamp:

```json
{
  "success": true,
  "result": true,
  "error": null,
  "request_id": "dc2c8527-55e7-4af4-8c3a-d71dd2b67598",
  "time": "2026-10-30T17:00:00.000Z"
}
```

Errors use `success: false`, `result: null`, and
`error: { "code": "invalid_params", "message": "..." }`. Statuses include 400 for
invalid JSON, envelopes, times or action parameters; 401 for missing/invalid
tokens; 404 for unknown routes/actions; 405 for methods; 408 for a slow body;
413 for oversized bodies; 415 for content type/encoding; and a generic 500 for
unexpected failures. Low-level malformed HTTP and header timeouts may receive
Node's own HTTP errors rather than the JSON application envelope.

Headers and body reads have time limits; body handling has a ten-second total
deadline, sockets have a fifteen-second inactivity timeout, and keep-alive lasts
five seconds. Unauthorized and oversized requests close the connection when
their bodies are unread. Internal errors, request bodies and tokens are not
logged. The token is compared using fixed-size hashes and a timing-safe compare.

JSON strings, booleans, null, objects and arrays keep their types. JavaScript
numbers use standard double precision: pass large integer identifiers as strings
when exact values beyond `Number.MAX_SAFE_INTEGER` matter.

## Code and future additions

- `src/main.js`: load config, listen, and handle shutdown signals.
- `src/server.js`: HTTP routes, authentication, bounded body reads and validation.
- `src/actions.js`: the commented action allow-list.
- `src/functions.js`: the actual demo functions and safe parameter errors.
- `src/config.js`: private config loading and validation.
- `test/server.test.js`: automated checks using real local HTTP sockets.

To add an action, implement a function in `functions.js`, validate its parameters,
register it in `actions.js`, and add tests. Throw `ParamsError` only for messages
safe to show callers. Future asynchronous actions should add cancellation and
their own upstream deadlines; HTTP deadlines cannot interrupt CPU-bound work.
FileMaker, a database, AI tools, and a browser playground are possible later
additions. This version only dispatches the four local demo functions.

The repository is ready for Alex to connect to a GitHub repository once he has
created it and supplied its URL. No remote, push, deployment or hosting change is
part of this local implementation.
