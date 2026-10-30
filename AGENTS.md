# nodeServer working scope

Work only in C:\AlexSeidler\projects\nodeServer for this product.
Do not edit the sibling goFM-Server, the parent portfolio, or other products.

Build a small Node.js equivalent of the Go action dispatcher. Use the installed
Node LTS runtime and minimal dependencies. JavaScript with clear comments is
sufficient; no database, framework, or TypeScript build is required for this demo.

- GET /health is public.
- POST /api authenticates a bearer token from private local JSON configuration
  before parsing the payload or dispatching an action.
- Envelope: action (registered function name), params (required JSON array),
  time (optional RFC3339 client timestamp).
- Organize a commented route/action allow-list separately from demo functions.
- Actions: hello -> "hello world"; success -> "successful";
  boolean -> true; echo -> supplied params array.
- Consistent response: success, result, error (code/message or null), request_id,
  and server-generated UTC time. Preserve JSON value types.
- Bound request bodies; validate JSON, params, methods, timestamps, and actions.
  Return useful HTTP statuses. No arbitrary commands, code, or caller-selected
  upstream destinations. Keep internal errors and tokens out of responses/logs.
- Generate a strong random token into an ignored config.local.json without
  printing it or overwriting existing config. Default listener is loopback.
- Include focused tests using Node's built-in test runner, a live local demo,
  and short run instructions. Commit distinct working changes often.

GitHub: Alex will create a new repository. Do not create one, add a guessed
remote, push, deploy, or change hosting. Keep all credentials private and ignored.
The Go reference may be read selectively but must not be edited or copied whole.
React playground and FileMaker integrations are later work, not this first task.
