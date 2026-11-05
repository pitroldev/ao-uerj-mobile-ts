import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import {
  APP_ATTESTATION_MAX_BYTES,
  createAppAttestVerifier,
  judgeAppAttestation,
  type AppAttestExpectation,
} from '../src/adapters/outbound/attestation/appAttest.ts';
import {
  APPLE_APP_ATTESTATION_ROOT_SHA256,
  appleAppAttestationRoot,
} from '../src/adapters/outbound/attestation/appleRoot.ts';
import { decodeCbor } from '../src/adapters/outbound/attestation/cbor.ts';
import {
  children,
  DER,
  only,
} from '../src/adapters/outbound/attestation/der.ts';
import type { AppAttestation } from '../src/modules/access/ports.ts';
import {
  AFTER_CREDCERT,
  APP_ATTEST,
  appAttestation,
  base64,
  cbor,
  cborMap,
  CLIENT_DATA_HASH,
  FAKE_ROOT,
  OTHER_ROOT,
  VALID_AT,
  type AppAttestCase,
} from './appAttest.ts';

/*
 * O App Attest: os passos de "Validating apps that connect to your server",
 * contra a cadeia de mentira do fixtures/appAttest.sh (o OpenSSL montou os
 * certificados e o nonce, não o código daqui). Cada recusa é conferida pelo
 * motivo, que vai para o log.
 */

const EXPECTED: AppAttestExpectation = {
  appId: APP_ATTEST.appId,
  root: FAKE_ROOT,
  environment: 'production',
  now: VALID_AT,
};

const judge = (
  attestation: AppAttestation,
  expected: Partial<AppAttestExpectation> = {},
  clientDataHash = CLIENT_DATA_HASH,
) =>
  judgeAppAttestation(attestation, clientDataHash, {
    ...EXPECTED,
    ...expected,
  });

/** O motivo da recusa, ou `trusted`. */
const verdict = (...args: Parameters<typeof judge>) => {
  const result = judge(...args);
  return result.trusted ? 'trusted' : result.reason;
};

const keyIdOf = (name: AppAttestCase) =>
  base64(APP_ATTEST.credCerts[name].keyId);

test('an attestation built like Apple builds it, under the pinned root, is trusted', async () => {
  assert.equal(verdict(appAttestation('valid')), 'trusted');
  // a porta é assíncrona e usa o relógio
  const verifier = createAppAttestVerifier({
    appId: APP_ATTEST.appId,
    root: FAKE_ROOT,
    now: () => VALID_AT,
  });
  assert.deepEqual(
    await verifier.verify(appAttestation('valid'), CLIENT_DATA_HASH),
    { trusted: true },
  );
  // a ordem das chaves do mapa não importa
  const { keyId } = appAttestation('valid');
  const credCert = APP_ATTEST.credCerts.valid;
  const reordered = cbor(
    cborMap(
      ['authData', base64(credCert.authData)],
      [
        'attStmt',
        cborMap(
          ['receipt', Buffer.from('r')],
          [
            'x5c',
            [base64(credCert.certificate), base64(APP_ATTEST.intermediate)],
          ],
        ),
      ],
      ['fmt', 'apple-appattest'],
    ),
  );
  assert.equal(verdict({ keyId, attestation: reordered }), 'trusted');
});

test('the embedded root is the Apple App Attestation Root CA, and the fake chain does not pass under it', () => {
  const apple = appleAppAttestationRoot();
  assert.equal(apple.fingerprint256, APPLE_APP_ATTESTATION_ROOT_SHA256);
  assert.match(apple.subject, /CN=Apple App Attestation Root CA/);
  assert.equal(apple.ca, true);
  assert.equal(apple.validToDate.toISOString(), '2045-03-15T00:00:00.000Z');
  assert.equal(
    verdict(appAttestation('valid'), { root: apple }),
    'certificate_chain',
  );
});

test('the nonce ties the attestation to this request: another clientDataHash or a changed authData is refused', () => {
  const other = createHash('sha256').update('outro pedido').digest();
  assert.equal(verdict(appAttestation('valid'), {}, other), 'nonce');
  // um byte do authData (a chave em COSE, que nenhum outro passo lê)
  const authData = Buffer.from(base64(APP_ATTEST.credCerts.valid.authData));
  const last = authData.length - 1;
  authData.writeUInt8((authData.readUInt8(last) + 1) % 256, last);
  assert.equal(verdict(appAttestation('valid', { authData })), 'nonce');
  // o clientDataHash tem 32 bytes
  assert.equal(
    verdict(appAttestation('valid'), {}, CLIENT_DATA_HASH.subarray(1)),
    'client_data_hash',
  );
  // sem a extensão do nonce, nada liga a chave ao pedido
  assert.equal(verdict(appAttestation('withoutNonce')), 'nonce_missing');
});

test('the key id must be the credCert key and the credential in authData', () => {
  const { attestation } = appAttestation('valid');
  assert.equal(
    verdict({ keyId: keyIdOf('development'), attestation }),
    'key_id',
  );
  assert.equal(
    verdict({ keyId: keyIdOf('valid').subarray(0, 31), attestation }),
    'key_id',
  );
  // a chave confere, mas o credentialId do authData é outro
  assert.equal(verdict(appAttestation('credentialId')), 'credential_id');
});

test('only our App ID, a fresh key and the production environment pass', () => {
  assert.equal(
    verdict(appAttestation('valid'), { appId: 'ZZZZZ99999.com.aouerjmobile' }),
    'app_id',
  );
  assert.equal(
    verdict(appAttestation('valid'), { appId: 'ABCDE12345.com.outroapp' }),
    'app_id',
  );
  // o contador maior que zero: a chave já assinou alguma coisa
  assert.equal(verdict(appAttestation('counter')), 'counter');
  // um build do Xcode (o ambiente de desenvolvimento) na produção
  assert.equal(
    verdict(appAttestation('development')),
    'development_environment',
  );
  // quase o aaguid de produção
  assert.equal(verdict(appAttestation('otherAaguid')), 'aaguid');
});

test('the development environment accepts the Xcode keys only when configured, and still the production ones', () => {
  const development = { environment: 'development' } as const;
  assert.equal(verdict(appAttestation('development'), development), 'trusted');
  assert.equal(verdict(appAttestation('valid'), development), 'trusted');
  assert.equal(verdict(appAttestation('otherAaguid'), development), 'aaguid');
  assert.equal(verdict(appAttestation('counter'), development), 'counter');
});

test('the chain must reach the pinned root, signed at each step, and be valid now', () => {
  // a mesma cadeia, mas fixada outra raiz
  assert.equal(
    verdict(appAttestation('valid'), { root: OTHER_ROOT }),
    'certificate_chain',
  );
  // a intermediária impostora tem o nosso nome: o nome bate, a assinatura não
  assert.equal(verdict(appAttestation('impostor')), 'certificate_chain');
  const impostorChain = appAttestation('impostor', {
    intermediate: APP_ATTEST.impostor,
  });
  assert.equal(verdict(impostorChain), 'certificate_chain');
  // a cadeia dela vale sob a raiz dela: a recusa acima é da raiz fixada
  assert.equal(verdict(impostorChain, { root: OTHER_ROOT }), 'trusted');

  const credCert = base64(APP_ATTEST.credCerts.valid.certificate);
  const intermediate = base64(APP_ATTEST.intermediate);
  // fora de ordem, o credCert como autoridade, só a raiz depois dele
  for (const x5c of [
    [intermediate, credCert],
    [credCert, credCert],
    [credCert, base64(APP_ATTEST.root)],
  ])
    assert.equal(
      verdict(appAttestation('valid', { x5c })),
      'certificate_chain',
      `x5c ${x5c.length}`,
    );

  // antes de o credCert valer e depois de vencer; o relógio nosso meio
  // minuto atrasado não recusa o recém-emitido
  const issued = VALID_AT - 60 * 60 * 1000;
  assert.equal(
    verdict(appAttestation('valid'), { now: issued - 30 * 1000 }),
    'trusted',
  );
  assert.equal(
    verdict(appAttestation('valid'), { now: issued - 2 * 60 * 1000 }),
    'certificate_expired',
  );
  assert.equal(
    verdict(appAttestation('valid'), { now: AFTER_CREDCERT }),
    'certificate_expired',
  );
});

test('a malformed object is refused, never thrown, with each CBOR rule enforced', async () => {
  const keyId = keyIdOf('valid');
  const credCert = base64(APP_ATTEST.credCerts.valid.certificate);
  const intermediate = base64(APP_ATTEST.intermediate);
  const valid = appAttestation('valid').attestation;
  const wrapped = (inner: Buffer) => ({ raw: inner });

  const malformed: Array<[string, Buffer]> = [
    ['empty', Buffer.alloc(0)],
    ['not CBOR', Buffer.from('não é CBOR')],
    ['truncated', valid.subarray(0, valid.length - 1)],
    ['trailing byte', Buffer.concat([valid, Buffer.from([0])])],
    ['a list on top', cbor([valid])],
    // um mapa de tamanho indefinido (0xbf … 0xff)
    [
      'indefinite length',
      Buffer.concat([
        Buffer.from([0xbf]),
        cbor('fmt'),
        cbor('apple-appattest'),
        Buffer.from([0xff]),
      ]),
    ],
    [
      'a repeated key',
      cbor(cborMap(['fmt', 'apple-appattest'], ['fmt', 'apple-appattest'])),
    ],
    ['a key that is not text', cbor(cborMap([Buffer.from('fmt'), 'x']))],
    // uma tag (0xc0, data e hora) no lugar do authData
    [
      'a tag',
      appAttestation('valid', {
        authData: wrapped(Buffer.concat([Buffer.from([0xc0]), cbor('x')])),
      }).attestation,
    ],
    [
      'an integer',
      appAttestation('valid', { receipt: wrapped(Buffer.from([0x01])) })
        .attestation,
    ],
    [
      'text that is not UTF-8',
      appAttestation('valid', {
        fmt: wrapped(Buffer.from([0x62, 0xc3, 0x28])),
      }).attestation,
    ],
    [
      'nested too deep',
      appAttestation('valid', { receipt: [[[[[Buffer.from('r')]]]]] })
        .attestation,
    ],
    [
      'a list too long',
      appAttestation('valid', {
        receipt: Array.from({ length: 17 }, () => 'r'),
      }).attestation,
    ],
    // bytes que diriam ter 2^64 - 1 de tamanho
    [
      'a huge length',
      appAttestation('valid', {
        receipt: wrapped(Buffer.from([0x5b, ...Array<number>(8).fill(0xff)])),
      }).attestation,
    ],
    ['too big', Buffer.alloc(APP_ATTESTATION_MAX_BYTES + 1)],
    [
      'without the receipt',
      cbor(
        cborMap(
          ['fmt', 'apple-appattest'],
          ['attStmt', cborMap(['x5c', [credCert, intermediate]])],
          ['authData', base64(APP_ATTEST.credCerts.valid.authData)],
        ),
      ),
    ],
    [
      'x5c with one certificate',
      appAttestation('valid', { x5c: [credCert] }).attestation,
    ],
    [
      'x5c with three certificates',
      appAttestation('valid', {
        x5c: [credCert, intermediate, base64(APP_ATTEST.root)],
      }).attestation,
    ],
    [
      'x5c as text',
      appAttestation('valid', { x5c: ['credCert', 'intermediate'] })
        .attestation,
    ],
    [
      'authData as text',
      appAttestation('valid', { authData: 'authData' }).attestation,
    ],
  ];
  for (const [what, attestation] of malformed)
    assert.equal(
      verdict({ keyId, attestation }),
      'malformed_attestation',
      what,
    );

  assert.equal(
    verdict({
      keyId,
      attestation: appAttestation('valid', { fmt: 'packed' }).attestation,
    }),
    'attestation_format',
  );

  // um certificado que não é DER: lixo, o PEM do mesmo e o DER com um byte a mais
  const pem = Buffer.from(
    `-----BEGIN CERTIFICATE-----\n${APP_ATTEST.credCerts.valid.certificate}\n-----END CERTIFICATE-----\n`,
  );
  for (const [what, first] of [
    ['garbage', Buffer.from('não é certificado')],
    ['PEM', pem],
    ['DER with a trailing byte', Buffer.concat([credCert, Buffer.from([0])])],
  ] as const)
    assert.equal(
      verdict(appAttestation('valid', { x5c: [first, intermediate] })),
      'malformed_certificate',
      what,
    );

  // o authData curto demais, ou com um credentialId maior que ele
  const tooLong = Buffer.from(base64(APP_ATTEST.credCerts.valid.authData));
  tooLong.writeUInt16BE(tooLong.length, 53);
  for (const authData of [Buffer.alloc(54), tooLong])
    assert.equal(
      verdict(appAttestation('valid', { authData })),
      'malformed_auth_data',
    );

  // pela porta, a recusa vem como veredito, sem exceção
  const verifier = createAppAttestVerifier({
    appId: APP_ATTEST.appId,
    root: FAKE_ROOT,
    now: () => VALID_AT,
  });
  for (const [, attestation] of malformed)
    assert.equal(
      (await verifier.verify({ keyId, attestation }, CLIENT_DATA_HASH)).trusted,
      false,
    );
});

test('the CBOR reader returns the bytes as slices and the maps by key', () => {
  const decoded = decodeCbor(
    cbor(cborMap(['a', Buffer.from('xyz')], ['b', ['t', Buffer.alloc(300)]])),
  );
  assert.ok(decoded instanceof Map);
  assert.deepEqual(decoded.get('a'), Buffer.from('xyz'));
  const list = decoded.get('b');
  assert.ok(Array.isArray(list));
  assert.equal(list[0], 't');
  assert.equal((list[1] as Buffer).length, 300);
  // um mapa com a chave "__proto__" é só uma chave
  const proto = decodeCbor(cbor(cborMap(['__proto__', 'x'])));
  assert.ok(proto instanceof Map);
  assert.equal(proto.get('__proto__'), 'x');
});

test('the DER reader takes only the shortest definite lengths, and nothing left over', () => {
  // SEQUENCE { OCTET STRING "ab" }
  const sequence = Buffer.from([0x30, 0x04, 0x04, 0x02, 0x61, 0x62]);
  const [octets] = children(only(sequence, DER.SEQUENCE).content);
  assert.deepEqual(octets?.content, Buffer.from('ab'));
  for (const [what, bytes] of [
    ['indefinite length', Buffer.from([0x30, 0x80, 0x00, 0x00])],
    ['long form for a short length', Buffer.from([0x30, 0x81, 0x01, 0x05])],
    ['a leading zero in the length', Buffer.from([0x30, 0x82, 0x00, 0x81])],
    ['truncated', Buffer.from([0x30, 0x05, 0x04])],
    ['trailing bytes', Buffer.concat([sequence, Buffer.from([0])])],
    ['another tag', Buffer.from([0x31, 0x00])],
    ['a multi-byte tag', Buffer.from([0x1f, 0x81, 0x00])],
  ] as const)
    assert.throws(() => only(bytes, DER.SEQUENCE), Error, what);
});
