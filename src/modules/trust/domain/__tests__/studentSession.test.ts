import { testCrypto } from '../../__tests__/testCrypto';
import { toHex, utf8 } from '../bytes';
import {
  banMessage,
  normalizeName,
  sessionRequestHash,
} from '../studentSession';

type NodeHash = {
  createHash(algorithm: string): {
    update(data: string | Uint8Array): { digest(encoding: 'hex'): string };
  };
};
type NodeBuffer = {
  Buffer: {
    from(text: string, encoding: 'utf8'): Uint8Array & { length: number };
    alloc(size: number): Uint8Array & { writeUInt16BE(value: number): void };
    concat(parts: Uint8Array[]): Uint8Array;
  };
};

const node = jest.requireActual<NodeHash>('node:crypto');
const { Buffer } = jest.requireActual<NodeBuffer>('node:buffer');

it('encodes UTF-8 like the platform does', () => {
  for (const text of ['MARINA', 'JOÃO ÇÂNDIDO', '€', 'ação 😀'])
    expect(toHex(utf8(text))).toBe(toHex(Buffer.from(text, 'utf8')));
});

it('hashes the sign-in the same way as the server (label, challenge, installation, u16-prefixed fields)', () => {
  const challenge = Uint8Array.from({ length: 36 }, (_, index) => index);
  const installation = Uint8Array.from(
    { length: 32 },
    (_, index) => 255 - index,
  );
  const field = (text: string) => {
    const bytes = Buffer.from(text, 'utf8');
    const length = Buffer.alloc(2);
    length.writeUInt16BE(bytes.length);
    return Buffer.concat([length, bytes]);
  };
  // o mesmo cálculo de server/src/modules/students/domain.ts, feito à parte
  const expected = node
    .createHash('sha256')
    .update(
      Buffer.concat([
        Buffer.from('AO UERJ student session v1', 'utf8'),
        challenge,
        installation,
        field('201810012345'),
        field('JOÃO DA SILVA'),
      ]),
    )
    .digest('hex');
  expect(
    sessionRequestHash(testCrypto, {
      challenge,
      installation,
      matricula: '201810012345',
      name: 'JOÃO DA SILVA',
    }),
  ).toBe(expected);
});

it('cleans the name and says until when the ban lasts', () => {
  expect(normalizeName('  MARINA \n  COSTA ')).toBe('MARINA COSTA');
  expect(
    banMessage({ until: new Date(2026, 11, 10, 14).getTime(), reason: 'Spam' }),
  ).toMatch(
    /^Sua conta está suspensa no AO UERJ até 10\/12 por uma denúncia\. Motivo: Spam\./,
  );
  expect(banMessage({ until: null, reason: '' })).toMatch(
    /por tempo indeterminado por uma denúncia\. Mural/,
  );
});
