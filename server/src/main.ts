import { createLogger } from './adapters/logging.ts';
import { createServer } from './composition.ts';
import { loadConfig, type Config } from './config.ts';

// `pnpm start` (node --env-file-if-exists=.env src/main.ts): as variáveis
// estão em .env.example. Uma configuração inválida para aqui, com a lista do
// que está errado.
let config: Config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const logger = createLogger(config.logLevel);
const server = createServer(config, logger);
await server.start();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.stop().then(
      () => {
        process.exitCode = 0;
      },
      (err: unknown) => {
        logger.error({ err }, 'shutdown failed');
        process.exitCode = 1;
      },
    );
  });
}
