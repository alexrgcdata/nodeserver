# nodeServer

A small Node.js API server that checks a bearer token, routes a JSON request to
a registered function, and sends back a consistent response.

I built this alongside my [Go server](https://github.com/alexrgcdata/goFM-Server)
to work through the same idea in JavaScript: give a client one place to call,
authenticate the request, then let a named function do the work. The four demo
functions are simple on purpose. The interesting part is what happens around
them: checking input, keeping credentials private, handling bad requests, and
making the next function easy to add.

## How it works

```text
Client -> POST /api -> check token -> validate JSON -> find action -> return JSON
```

The client sends an action name and an array of parameters. The server looks up
that name in a small, explicit list of allowed functions. It never treats a
request as code to execute or a URL to forward somewhere else.

For example, this request calls `echo`:

```json
{ "action": "echo", "params": ["hello", 42, true, { "name": "Alex" }] }
```

The response includes that array as `result`, plus a success flag, an error field,
a request ID, and the server's timestamp. `hello`, `success`, and `boolean` are
the other demo actions. Booleans come back as booleans, objects as objects.

I used Node's built-in HTTP server, crypto utilities, and test runner. There are
no third-party packages, database, or build step. At this size, being able to
follow a request through a few files matters more to me than adding a framework.

## Try it locally

You'll need **Node.js 24 or newer**. From the project folder:

```sh
npm run setup
npm test
npm run demo
npm start
```

Setup creates an ignored `config.local.json` with a random token. It keeps an
existing config and never prints the token. The demo starts a temporary local
server, calls all four actions, checks that a missing token gets rejected, and
shuts itself down. You can see the whole flow without copying credentials.

`npm start` keeps the server running at `http://127.0.0.1:8080` by default.
Open `/health` to check it; Ctrl+C stops it. If that port is busy, change `port`
in your private config. [The API guide](docs/API.md) covers configuration, the
full response format, and making your own requests.

## A quick look through the code

- [server.js](src/server.js) handles HTTP, authentication, and input checks.
- [actions.js](src/actions.js) lists the functions a client is allowed to call.
- [functions.js](src/functions.js) contains those functions and their parameter checks.
- [server.test.js](test/server.test.js) tests requests over real local HTTP sockets.

To add an action, write its function, register its name, and test its parameters
and result. The HTTP handling can stay where it is.

## Where this stands

This is a working local starter with automated tests for authentication, malformed
requests, body limits, timeouts, and the four actions. A GitHub Actions workflow
is configured to run those tests on Windows and Linux. There's no login or user account system yet: a
private, shared bearer token is the authentication boundary.

It isn't hosted on my portfolio's shared hosting, which can't run this Node
service. Running it publicly would need a suitable Node host and HTTPS, along
with decisions about user access and rate limiting. FileMaker integration and
a browser client would be separate additions. For now, this repo is the small
server you can read, run, and extend.
