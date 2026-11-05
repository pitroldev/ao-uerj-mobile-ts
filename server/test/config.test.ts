import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { loadConfig } from '../src/config.ts';
import { isSigningKey } from '../src/modules/access/domain.ts';
import {
  privateKeyEntry,
  rsaPssKeyPair,
  signingKeys,
  studentKeys,
} from './tokens.ts';

test('the defaults run a development server on 3300 with the portal monitor', () => {
  const config = loadConfig({});

  assert.equal(config.env, 'development');
  assert.equal(config.port, 3300);
  assert.equal(config.host, undefined);
  assert.equal(config.logLevel, 'info');
  assert.equal(config.mongo.uri, 'mongodb://localhost:27017/aouerj');
  assert.equal(config.mongo.autoIndex, true);
  // o corpo de /aouerj como no servidor antigo; o do gerador, folgado
  assert.equal(config.http.jsonLimit, '100kb');
  assert.equal(config.http.generatorJsonLimit, '1mb');
  // folgado: os alunos de um campus saem pelo mesmo IP
  assert.equal(config.http.rateLimitPerMinute, 120);
  assert.equal(config.http.adminToken, undefined);
  assert.equal(config.http.trustProxy, undefined);
  assert.equal(config.teachersCacheMs, 5 * 60 * 1000);
  assert.equal(path.basename(config.reportsDir), 'AOreports');
  assert.deepEqual(config.portalMonitor, {
    enabled: true,
    intervalMs: 5 * 60 * 1000,
  });
});

test('the tests stay quiet and leave the portal alone', () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  assert.equal(config.logLevel, 'silent');
  assert.equal(config.portalMonitor.enabled, false);
  assert.equal(
    loadConfig({ PORTAL_MONITOR: 'off' }).portalMonitor.enabled,
    false,
  );
});

test('TRUST_PROXY becomes what Express expects: hops, a flag or addresses', () => {
  assert.equal(loadConfig({ TRUST_PROXY: '1' }).http.trustProxy, 1);
  assert.equal(loadConfig({ TRUST_PROXY: 'true' }).http.trustProxy, true);
  assert.equal(loadConfig({ TRUST_PROXY: 'false' }).http.trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: '' }).http.trustProxy, undefined);
  assert.equal(
    loadConfig({ TRUST_PROXY: 'loopback' }).http.trustProxy,
    'loopback',
  );
});

test('an invalid configuration stops the start with every problem listed', () => {
  assert.throws(
    () =>
      loadConfig({
        PORT: '70000',
        FORCE_HTTPS: 'true',
        ADMIN_TOKEN: 'curto',
      }),
    (err: Error) =>
      /PORT/.test(err.message) &&
      /PUBLIC_URL/.test(err.message) &&
      /ADMIN_TOKEN must have at least 16 characters/.test(err.message),
  );
  assert.throws(
    () => loadConfig({ FORCE_HTTPS: 'true', PUBLIC_URL: 'http://pitrol.dev' }),
    /PUBLIC_URL/,
  );
  assert.throws(
    () => loadConfig({ RELEASE_COMMIT: 'main', RELEASE_COLOR: 'red' }),
    (err: Error) =>
      /RELEASE_COMMIT must be a git commit hash/.test(err.message) &&
      /RELEASE_COLOR/.test(err.message),
  );
  // sem proxy confiável, o redirecionamento não teria fim
  assert.throws(
    () => loadConfig({ FORCE_HTTPS: 'true', PUBLIC_URL: 'https://pitrol.dev' }),
    /TRUST_PROXY is required when FORCE_HTTPS is true/,
  );
  assert.equal(
    loadConfig({
      FORCE_HTTPS: 'true',
      PUBLIC_URL: 'https://pitrol.dev',
      TRUST_PROXY: '1',
    }).http.forceHttps,
    true,
  );
});

test('the schedule generator runs one search at a time by default, within ten seconds', () => {
  assert.deepEqual(loadConfig({}).generator, {
    concurrency: 1,
    queueLimit: 32,
    budgetMs: 10000,
    perMinute: 120,
  });
  assert.equal(
    loadConfig({ MONGODB_AUTO_INDEX: 'false', HOST: '127.0.0.1' }).mongo
      .autoIndex,
    false,
  );
  assert.deepEqual(
    loadConfig({
      GENERATOR_CONCURRENCY: '2',
      GENERATOR_QUEUE_LIMIT: '0',
      GENERATOR_BUDGET_MS: '20000',
      GENERATOR_RATE_LIMIT_PER_MINUTE: '5',
    }).generator,
    { concurrency: 2, queueLimit: 0, budgetMs: 20000, perMinute: 5 },
  );
  assert.throws(
    () =>
      loadConfig({ GENERATOR_BUDGET_MS: '90000', GENERATOR_CONCURRENCY: '0' }),
    (err: Error) =>
      /GENERATOR_BUDGET_MS must be at most 60000/.test(err.message) &&
      /GENERATOR_CONCURRENCY/.test(err.message),
  );
});

test('the student token keys are read as DER@date, and a broken one stops the start', () => {
  assert.deepEqual(loadConfig({}).studentAccess, {
    issuer: 'pitrol.dev',
    origin: 'pitrol.dev',
    keys: [],
    // sem conta de serviço, não há emissão; os limites do plano
    issuance: {
      attestation: null,
      batchSize: 32,
      batchesPerDay: 4,
      perMinute: 60,
    },
  });

  const [first, second] = studentKeys(2);
  // a forma do Node em base64 e a da RFC em base64url, as duas valem
  const node = first.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const rfc = second.issuer.spki.toString('base64url');
  const { keys } = loadConfig({
    PRIVATE_TOKEN_KEYS: ` ${node}@2027-01-01 , ${rfc}@2027-02-01 `,
  }).studentAccess;
  assert.equal(keys.length, 2);
  assert.ok(keys[0].id.equals(first.issuer.id));
  assert.ok(keys[1].id.equals(second.issuer.id));
  assert.deepEqual(keys[0].notAfter, new Date(Date.UTC(2027, 0, 1)));

  // a privada (RSA comum) resgata e emite; a pública que sai dela é a da RFC
  const [signer] = signingKeys(1);
  const [withPrivate] = loadConfig({
    PRIVATE_TOKEN_KEYS: privateKeyEntry(signer, '2027-03-01'),
  }).studentAccess.keys;
  assert.ok(isSigningKey(withPrivate));
  assert.ok(withPrivate.spki.equals(signer.spki));
  assert.equal(isSigningKey(keys[0]), false);

  const rsa = rsaPssKeyPair('sha256', 32)
    .publicKey.export({ type: 'spki', format: 'der' })
    .toString('base64');
  const pssPrivate = rsaPssKeyPair()
    .privateKey.export({ type: 'pkcs8', format: 'der' })
    .toString('base64');
  assert.throws(
    () =>
      loadConfig({
        PRIVATE_TOKEN_KEYS: [
          'sem-data',
          `${node}@amanhã`,
          `${rsa}@2027-01-01`,
          `${node}@2027-02-30`,
          `${pssPrivate}@2027-01-01`,
          'AAAA@2027-01-01',
        ].join(','),
        PRIVATE_TOKEN_ISSUER: 'não é um nome',
      }),
    (err: Error) =>
      /key 1: expected <base64 DER key>@<YYYY-MM-DD>/.test(err.message) &&
      /key 2: the expiry must be a date/.test(err.message) &&
      /key 3: the token key must be RSA with 2048 bits/.test(err.message) &&
      // 30 de fevereiro não vira 2 de março
      /key 4: the expiry must be a date/.test(err.message) &&
      // a assinatura cega precisa da chave RSA comum
      /key 5: the private token key must be a plain RSA key/.test(
        err.message,
      ) &&
      /key 6: expected an SPKI public key or a PKCS #8 private key/.test(
        err.message,
      ) &&
      /PRIVATE_TOKEN_ISSUER: must be a server name/.test(err.message),
  );
});

test('the attestation is Play Integrity with a service account and our certificate, or development outside production', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ao-uerj-config-'));
  const file = path.join(dir, 'service-account.json');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync(
    file,
    JSON.stringify({
      type: 'service_account',
      client_email: 'ao-uerj@projeto.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    }),
  );
  const fingerprint = 'AB:'.repeat(31) + 'CD';

  try {
    const { attestation } = loadConfig({
      PLAY_INTEGRITY_SERVICE_ACCOUNT: file,
      PLAY_INTEGRITY_CERT_SHA256: `${fingerprint}, ${'ef'.repeat(32)}`,
    }).studentAccess.issuance;
    assert.equal(attestation?.mode, 'play-integrity');
    assert.ok(attestation?.mode === 'play-integrity');
    assert.equal(attestation.packageName, 'com.aouerjmobile');
    assert.equal(
      attestation.account.clientEmail,
      'ao-uerj@projeto.iam.gserviceaccount.com',
    );
    assert.deepEqual(
      attestation.certificateDigests.map(digest => digest.toString('hex')),
      [`${'ab'.repeat(31)}cd`, 'ef'.repeat(32)],
    );

    assert.deepEqual(
      loadConfig({ TOKEN_ATTESTATION: 'development' }).studentAccess.issuance
        .attestation,
      { mode: 'development' },
    );

    const problems = (env: Record<string, string>) => {
      try {
        loadConfig(env);
        return '';
      } catch (err) {
        return (err as Error).message;
      }
    };
    assert.match(
      problems({ NODE_ENV: 'production', TOKEN_ATTESTATION: 'development' }),
      /TOKEN_ATTESTATION=development is not allowed in production/,
    );
    // sem o certificado, um app reassinado passaria
    assert.match(
      problems({ PLAY_INTEGRITY_SERVICE_ACCOUNT: file }),
      /PLAY_INTEGRITY_CERT_SHA256 is required/,
    );
    assert.match(
      problems({
        PLAY_INTEGRITY_SERVICE_ACCOUNT: file,
        PLAY_INTEGRITY_CERT_SHA256: 'AB:CD',
      }),
      /certificate 1: expected a SHA-256 fingerprint/,
    );
    assert.match(
      problems({
        PLAY_INTEGRITY_SERVICE_ACCOUNT: path.join(dir, 'nada.json'),
        PLAY_INTEGRITY_CERT_SHA256: fingerprint,
      }),
      /cannot read the service account JSON/,
    );
    writeFileSync(file, JSON.stringify({ type: 'authorized_user' }));
    assert.match(
      problems({
        PLAY_INTEGRITY_SERVICE_ACCOUNT: file,
        PLAY_INTEGRITY_CERT_SHA256: fingerprint,
      }),
      /not a service account key/,
    );
    assert.match(
      problems({ PLAY_INTEGRITY_PACKAGE: 'sem-ponto' }),
      /must be an Android package/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the iPhone App Attest needs the App ID, in production by default', () => {
  // sem a conta da Apple, o iPhone fica de fora
  assert.equal(loadConfig({}).students.appAttest, null);
  assert.equal(
    loadConfig({ APPLE_APP_ATTEST_APP_ID: ' ' }).students.appAttest,
    null,
  );
  assert.deepEqual(
    loadConfig({ APPLE_APP_ATTEST_APP_ID: ' ABCDE12345.com.aouerjmobile ' })
      .students.appAttest,
    { appId: 'ABCDE12345.com.aouerjmobile', environment: 'production' },
  );
  assert.deepEqual(
    loadConfig({
      NODE_ENV: 'production',
      APPLE_APP_ATTEST_APP_ID: 'ABCDE12345.com.aouerjmobile',
      APPLE_APP_ATTEST_ENVIRONMENT: 'development',
    }).students.appAttest,
    { appId: 'ABCDE12345.com.aouerjmobile', environment: 'development' },
  );
  assert.throws(
    () =>
      loadConfig({
        APPLE_APP_ATTEST_APP_ID: 'com.aouerjmobile',
        APPLE_APP_ATTEST_ENVIRONMENT: 'sandbox',
      }),
    (err: Error) =>
      /APPLE_APP_ATTEST_APP_ID: expected <Team ID>\.<bundle id>/.test(
        err.message,
      ) && /APPLE_APP_ATTEST_ENVIRONMENT/.test(err.message),
  );
  // o Team ID tem 10 caracteres, em maiúsculas
  assert.throws(
    () =>
      loadConfig({ APPLE_APP_ATTEST_APP_ID: 'abcde12345.com.aouerjmobile' }),
    /APPLE_APP_ATTEST_APP_ID/,
  );
});
