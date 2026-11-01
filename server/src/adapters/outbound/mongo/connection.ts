import mongoose from 'mongoose';
import type { Logger } from 'pino';

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * Uma conexão própria do MongoDB (não a global do Mongoose): os modelos são
 * registrados nela e os testes criam a sua. Sem banco, nada espera: as
 * consultas falham na hora e as rotas respondem 503.
 */
export function createDatabase({
  uri,
  timeoutMs,
  autoIndex = true,
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
  logger: Logger;
}) {
  const connection = mongoose.createConnection();
  connection.set('bufferCommands', false);

  const isReady = () =>
    connection.readyState === mongoose.ConnectionStates.connected;

  return {
    connection,
    isReady,
    status: (): string => STATES[connection.readyState] ?? 'unknown',

    /** Conecta; uma falha fica no log e devolve `false` (o servidor segue). */
    async connect(): Promise<boolean> {
      if (isReady()) return true;
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
    },

    async disconnect(): Promise<void> {
      if (connection.readyState !== mongoose.ConnectionStates.disconnected) {
        await connection.close();
      }
    },
  };
}

export type Database = ReturnType<typeof createDatabase>;
