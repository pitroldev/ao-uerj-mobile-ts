import { pino, type Logger } from 'pino';

/**
 * Log em JSON, uma linha por evento (o pm2 e o journald guardam como vem).
 * Não registra IP, User-Agent nem corpo de requisição: o mural e os relatos
 * trazem nome e e-mail de aluno.
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'ao-uerj-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: label => ({ level: label }) },
  });
}
