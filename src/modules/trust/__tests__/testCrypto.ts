import type { SessionCrypto } from '../domain/studentSession';

/*
 * O crypto do Node nos testes, no lugar do módulo nativo. Tipado aqui: o
 * tsconfig do app não traz os tipos do Node, que não existem no aparelho.
 */
type NodeCrypto = {
  createHash(algorithm: string): {
    update(data: Uint8Array): { digest(): Uint8Array };
  };
  randomBytes(size: number): Uint8Array;
};

const node = jest.requireActual<NodeCrypto>('node:crypto');
const plain = (bytes: Uint8Array) => new Uint8Array(bytes);

export const testCrypto: SessionCrypto = {
  sha256: data => plain(node.createHash('sha256').update(data).digest()),
  randomBytes: length => plain(node.randomBytes(length)),
};
