import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { createGameServer } from './server.js';

const config = loadConfig();
const log = createLogger();
const server = createGameServer(config, { log });

const port = await server.listen();
log.info('server.listening', {
  port,
  static: config.staticDir ?? null,
  persistence: config.databaseUrl ? 'postgres' : 'memory',
  production: config.production,
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  log.info('server.shutdown', { signal });
  await server.close().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('uncaughtException', (err) => log.error('process.uncaught', { err: String(err), stack: err.stack }));
process.on('unhandledRejection', (err) => log.error('process.unhandled_rejection', { err: String(err) }));
