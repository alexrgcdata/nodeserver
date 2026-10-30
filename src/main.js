import { loadConfig } from './config.js';
import { createServer } from './server.js';

try {
  const config = await loadConfig();
  const server = createServer(config);
  server.on('error', () => {
    console.error('Server could not listen. Check the configured address and port.');
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    console.log(`nodeServer listening on http://${config.host}:${server.address().port}`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    console.log('Stopping nodeServer.');
    // Finish active requests; force remaining sockets closed after five seconds.
    const deadline = setTimeout(() => server.closeAllConnections(), 5000);
    deadline.unref();
    server.close(() => clearTimeout(deadline));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
