# nodeServer readiness receipt

Audited October 30, 2026. This receipt covers the standalone Node product only.
No parent portfolio files, sibling products, hosting, or production databases
were changed.

## Source and scope

- Public repository: https://github.com/alexrgcdata/nodeserver
- Working checkout: `C:\AlexSeidler\projects\nodeServer`
- Verified implementation commit: `c9277d8ca3d3a2957dde2568a35b620064d30ca7`
- Go reference inspected: `2ac7ec4c16ebef827c38677726bc438ed7f1396e`
  in the sibling `goFM-Server` checkout. It was read only.
- Repository visibility remains public. No license was added or changed; the
  repository currently has no declared license. Public source availability
  should not be presented as a permissively licensed release.

The implementation is a dependency-free JavaScript HTTP dispatcher with a
private shared bearer token. `GET /health` is public; `POST /api` authenticates
before parsing a request. The action allow-list contains `hello`, `success`,
`boolean`, and `echo`. Responses include `success`, `result`, `error`,
`request_id`, and a server-generated UTC `time`.

The audit fixed numeric overflow: JSON such as `1e400` now receives HTTP 400
instead of being echoed as null. The API guide records differences from Go:
JavaScript number precision, UUID request IDs, millisecond timestamps, private
configuration names/token format, stricter timestamp and UTF-8 validation, and
some invalid-envelope error codes. This is the same basic action contract,
not a promise of byte-for-byte compatibility.

## Checks actually run

- Windows, Node.js `v24.14.0`: `npm test`, all **11 tests passed**. These use
  real loopback HTTP sockets and cover auth order/duplicate headers, JSON types,
  envelopes, methods, unknown actions, UTF-8, numeric overflow, known-length and
  chunked body limits, timestamps, configuration, and an unfinished body timeout.
- `npm run demo`: passed health, all four actions, and a missing-token request
  containing invalid JSON. That last request returned 401 before parsing.
- Seven additional real local HTTP exchanges were captured using synthetic
  values in [docs/evidence/local-http.json](docs/evidence/local-http.json).
  Authentication values are omitted; the capture contains no private token.
- `git diff --check` passed. `config.local.json` remains ignored by Git.
- CI for the exact implementation commit:
  https://github.com/alexrgcdata/nodeserver/actions/runs/41142135597
  **Passed on Windows and Linux**, including tests, config setup, and the live
  local demo. CI checked implementation commit `c9277d8ca3d3a2957dde2568a35b620064d30ca7`.

This document is a follow-up receipt. The implementation hash above identifies
the tested source; `git log -1 -- READINESS.md` identifies the receipt commit.

## Get the source and start it

Use Node.js 24 or newer and Git:

```sh
git clone https://github.com/alexrgcdata/nodeserver.git
cd nodeserver
npm run setup
npm test
npm run demo
npm start
```

No package installation or build is required. GitHub's Code menu also offers
Download ZIP; extract it and run the same npm commands from the extracted root.
No separate binary or release archive is supplied.

Setup creates ignored `config.local.json`, with a random token and a loopback
listener at `http://127.0.0.1:8080`. It never overwrites an existing config or
prints its token. Change `port` in that private file if occupied. Port 0 chooses
an available port, printed at startup. This existing checkout's private port may
differ from the generated default; use the startup address.

The demo starts its own temporary loopback listener and closes it afterwards.
`npm start` keeps the service running. Visit its `/health` endpoint; Ctrl+C stops
it. Keep the private config outside public web roots and out of screenshots,
downloads, source control, and upload folders. Tokens are not browser assets.

## Limits and handoff

This is a working local API starter, not a hosted service or user account
system. There is no public API URL, deployment, TLS setup, FileMaker connection,
database, proxy, browser dashboard, per-user identity, token expiry, or rate
limiting. The portfolio's shared host cannot run this Node process. Public
deployment would need a Node-capable host, HTTPS, and an access policy.

The server accepts only registered local functions. It doesn't execute client
code or commands, or forward to caller-selected destinations. Future network
actions would need their own cancellation and upstream deadlines; HTTP timers
cannot interrupt CPU-bound JavaScript.

For the portfolio owner: [README.md](README.md) is the employer-facing overview;
[docs/API.md](docs/API.md) is the technical contract; the JSON evidence is a safe
source for displaying real local requests and responses. There is no product
dashboard to photograph and no hosted integration to imply. Website sections,
assets, README.TXT, agent guidance, and deployment remain with PROJECT MANAGER.
