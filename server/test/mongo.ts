import { MongoMemoryServer } from 'mongodb-memory-server-core';

/**
 * A versão do MongoDB da produção (Atlas, 8.0), para os testes que precisam
 * de um mongod de verdade. O binário vem do mongodb-memory-server e fica em
 * ~/.cache/mongodb-binaries; o CI guarda essa pasta com este arquivo na
 * chave. `MONGOMS_VERSION` troca a versão numa execução.
 */
export const MONGO_VERSION = process.env.MONGOMS_VERSION ?? '8.0.34';

/** Um mongod só para o teste, numa porta livre. */
export const startMongo = () =>
  MongoMemoryServer.create({ binary: { version: MONGO_VERSION } });

export type Mongo = MongoMemoryServer;
