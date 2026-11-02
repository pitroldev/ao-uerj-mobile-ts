import vector from '../../../../server/test/fixtures/rfc9578-type2.json';
import { concat, fromHex, toHex } from '../domain/bytes';
import type { TokenCrypto } from '../domain/privateToken';

/*
 * O crypto do Node nos testes, no lugar do módulo nativo. Tipado aqui: o
 * tsconfig do app não traz os tipos do Node, que não existem no aparelho.
 */
type NodeCrypto = {
  createHash(algorithm: string): {
    update(data: Uint8Array): { digest(): Uint8Array };
  };
  randomBytes(size: number): Uint8Array;
  generateKeyPairSync(
    type: 'rsa',
    options: { modulusLength: number },
  ): {
    publicKey: {
      export(options: { type: 'spki'; format: 'der' }): Uint8Array;
    };
    privateKey: unknown;
  };
  privateDecrypt(
    key: { key: unknown; padding: number },
    data: Uint8Array,
  ): Uint8Array;
  constants: { RSA_NO_PADDING: number };
};

const node = jest.requireActual<NodeCrypto>('node:crypto');
const plain = (bytes: Uint8Array) => new Uint8Array(bytes);

export const testCrypto: TokenCrypto = {
  sha256: data => plain(node.createHash('sha256').update(data).digest()),
  sha384: data => plain(node.createHash('sha384').update(data).digest()),
  randomBytes: length => plain(node.randomBytes(length)),
};

/** O vetor 1 do Blind RSA (RFC 9578, A.2), em bytes. */
export const rfcVector = {
  pkI: fromHex(vector.pkI),
  tokenChallenge: fromHex(vector.token_challenge),
  nonce: fromHex(vector.nonce),
  blind: BigInt(`0x${vector.blind}`),
  salt: fromHex(vector.salt),
  tokenRequest: fromHex(vector.token_request),
  tokenResponse: fromHex(vector.token_response),
  token: fromHex(vector.token),
};

/** O SPKI da RFC 9578 até o BIT STRING: o começo do pkI do vetor. */
const SPKI_PREFIX_BYTES = 72;
const RSA_PUBLIC_KEY_BYTES = 270;

/**
 * Um emissor de teste, como o do servidor: uma chave RSA comum, publicada na
 * forma da RFC, que assina o pedido cego com a RSA crua (RFC 9474, BlindSign).
 */
export function testIssuer() {
  const { publicKey, privateKey } = node.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const der = plain(publicKey.export({ type: 'spki', format: 'der' }));
  const tokenKey = concat(
    rfcVector.pkI.subarray(0, SPKI_PREFIX_BYTES),
    der.subarray(der.length - RSA_PUBLIC_KEY_BYTES),
  );
  return {
    tokenKey,
    keyId: toHex(testCrypto.sha256(tokenKey)),
    sign: (tokenRequest: Uint8Array) =>
      plain(
        node.privateDecrypt(
          { key: privateKey, padding: node.constants.RSA_NO_PADDING },
          tokenRequest.subarray(3),
        ),
      ),
  };
}
