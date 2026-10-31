# nodeServer handoff

Updated October 30, 2026 after the hardware-maintenance pause. The local product
is complete for its current scope. The resume review found a clean checkout at
`7f7dd5a790f373ca03e81b12eaec21ab8bc05505`; no implementation changes were needed.
This handoff is a documentation-only follow-up.

## Ownership and source

Work only in `C:\AlexSeidler\projects\nodeServer`. PROJECT MANAGER owns the
parent portfolio, generated website pages/assets, and deployment. Do not edit
the Go checkout or another product. Use one worker; no duplicate servers,
watchers, installs, or unchanged test runs.

- [Public repository](https://github.com/alexrgcdata/nodeserver)
- [Verified implementation, c9277d8](https://github.com/alexrgcdata/nodeserver/commit/c9277d8ca3d3a2957dde2568a35b620064d30ca7)
- [Readiness receipt commit, 7f7dd5a](https://github.com/alexrgcdata/nodeserver/commit/7f7dd5a790f373ca03e81b12eaec21ab8bc05505)
- [Passing Windows/Linux CI for that implementation](https://github.com/alexrgcdata/nodeserver/actions/runs/41142135597)

There is no tagged release, binary download, or separately packaged archive.
Get the source through Git clone or GitHub's Code > Download ZIP. Repository
visibility remains public. No license has been declared or changed. Find the
commit introducing this handoff with `git log -1 -- agentic_handoff.md`; it
does not replace the verified implementation hash above.

## What works and what was checked

Node's built-in HTTP server authenticates `POST /api` before parsing input,
then calls an explicitly registered function. `GET /health` is public. The four
actions are `hello`, `success`, `boolean`, and `echo`. All responses use the
documented success/result/error/request ID/server-time fields.

Before the pause, Windows with Node v24.14.0 passed all 11 HTTP tests and
`npm run demo`. CI passed tests, config setup, and the live local demo on both
Windows and Linux for implementation commit c9277d8. The audit fixed numeric
overflow becoming null and documented Go/Node differences. These checks were
not rerun after resume because only this handoff changed.

Resume checks were limited to Git status/history/remotes and reading the saved
receipt and project instructions, followed by a documentation whitespace check.
No heavy suite, install, build, server, or persistent monitor was started. No
RAM/CPU measurements were taken because this follow-up involved no heavy work.

Useful files for PROJECT MANAGER:

- [README.md](README.md): employer-facing explanation and quick start.
- [docs/API.md](docs/API.md): full contract, limitations, and a PowerShell request.
- [READINESS.md](READINESS.md): verification receipt and startup/download details.
- [docs/evidence/local-http.json](docs/evidence/local-http.json): seven actual
  loopback HTTP exchanges with synthetic values and token values omitted.

The evidence is a real local API capture, not a hosted integration or dashboard.
No private runtime configuration should be copied into portfolio assets.

## Run locally

Use Node.js 24 or newer. No dependencies need installing and no build is needed.

```sh
git clone https://github.com/alexrgcdata/nodeserver.git
cd nodeserver
npm run setup
npm run demo
npm start
```

Setup creates an ignored private config with a random bearer token; it neither
prints the token nor replaces existing config. The generated default address is
`http://127.0.0.1:8080`. Existing private config can use another port, so follow
the address printed at startup. The demo starts and closes its own temporary
listener. Ctrl+C stops `npm start`. Run `npm test` when verifying code changes.

## Limits and next steps

There is no public service URL, hosting deployment, TLS setup, FileMaker
connection, database, browser dashboard, proxy, user account system, per-user
permissions, token expiry, or rate limiting. Alex's Namecheap cPanel includes
Setup Node.js App, but compatibility with the account's available Node version,
application startup setup, and resource limits still needs checking. This
project has not been deployed or verified there. JavaScript numbers have the
precision limits described in the API guide; the Node and Go implementations
aren't byte-identical.

No further product implementation is required for this starter. PROJECT MANAGER
can use the README, receipt, and safe captures to finish the portfolio section.
Any later product expansion should start with a concrete requirement. Network
actions would need cancellation and upstream deadlines; public hosting would
need a Node-capable host, HTTPS, and an access policy.

Preserve history, visibility, and licensing. Never publish tokens, private
config, customer records, clipboard captures, or another product's source. Do
not deploy or write to production databases under this handoff. Commit genuine
changes at logical checkpoints; don't manufacture history to suggest activity.
