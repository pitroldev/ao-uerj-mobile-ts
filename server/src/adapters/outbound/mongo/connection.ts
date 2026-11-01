import mongoose from 'mongoose';
import type { Logger } from 'pino';

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/** O intervalo entre tentativas: dobra a cada falha, até o teto. */
type Backoff = { firstMs: number; maxMs: number };

const BACKOFF: Backoff = { firstMs: 1000, maxMs: 30000 };

/**
 * Uma conexão própria do MongoDB (não a global do Mongoose): os modelos são
 * registrados nela e os testes criam a sua. Sem banco, nada espera: as
 * consultas falham na hora e as rotas respondem 503.
 */
export function createDatabase({
  uri,
  timeoutMs,
  autoIndex = true,
  backoff = BACKOFF,
  logger,
}: {
  uri: string;
  timeoutMs: number;
  /**
   * `false` não cria coleção nem índice na partida: a conexão só lê e grava
   * documentos (para conferir uma versão contra o banco de produção sem
   * mudar nada nele).
   */
  autoIndex?: boolean;
  backoff?: Backoff;
  logger: Logger;
}) {
  const connection = mongoose.createConnection();
  connection.set('bufferCommands', false);
  let stopped = false;
  let wake: (() => void) | null = null;

  const isReady = () =>
    connection.readyState === mongoose.ConnectionStates.connected;

  async function attempt(): Promise<boolean> {
    try {
      await connection.openUri(uri, {
        autoIndex,
        autoCreate: autoIndex,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: timeoutMs,
      });
      logger.info('MongoDB connected');
      return true;
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : err },
        'MongoDB connection failed',
      );
      return false;
    }
  }

  /** Espera `ms`, ou menos se o `disconnect` chegar antes. */
  const pause = (ms: number) =>
    new Promise<void>(resolve => {
      const timer = setTimeout(resolve, ms);
      timer.unref();
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    }).finally(() => {
      wake = null;
    });

  return {
    connection,
    isReady,
    status: (): string => STATES[connection.readyState] ?? 'unknown',

    /**
     * Conecta e, enquanto não der, tenta de novo (1 s, 2 s, 4 s… até 30 s):
     * um banco que demora a subir depois de um reboot não deixa o servidor
     * respondendo 503 para sempre. Uma queda depois de conectado o driver
     * resolve sozinho. Devolve `false` se o `disconnect` vier antes.
     */
    async connect(): Promise<boolean> {
      let delay = backoff.firstMs;
      while (!stopped) {
        if (isReady() || (await attempt())) return true;
        if (stopped) break;
        await pause(delay);
        delay = Math.min(delay * 2, backoff.maxMs);
      }
      return false;
    },

    async disconnect(): Promise<void> {
      stopped = true;
      wake?.();
      await connection.close();
    },
  };
}

export type Database = ReturnType<typeof createDatabase>;
