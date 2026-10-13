import { SENTRY_DSN } from './config';
import { startObservability } from './sentry';

// Primeiro import do index.js: o Sentry precisa estar ativo antes de o App
// criar os serviços e montar a árvore.
startObservability({ dsn: SENTRY_DSN, isDev: __DEV__ });
