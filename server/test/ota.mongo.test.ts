import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createFileOtaAssetStore } from '../src/adapters/outbound/files/otaAssetStore.ts';
import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import { createMongoRepositories } from '../src/adapters/outbound/mongo/repositories.ts';
import { createOtaSignatureVerifier } from '../src/adapters/outbound/ota/signature.ts';
import { createOtaUpdates } from '../src/modules/ota/application.ts';
import {
  assetHashOf,
  bodyHashOf,
  type NewOtaEntry,
} from '../src/modules/ota/domain.ts';
import { startMongo, type Mongo } from './mongo.ts';
import {
  assetOf,
  bundleBytes,
  manifestText,
  otaSigningKeys,
  rollbackText,
  signText,
} from './ota.ts';
import { silentLogger } from './support.ts';

// As publicações das atualizações pelo ar num mongod de verdade: a ordem, os
// índices únicos (o mesmo texto e o mesmo update uma vez só) e os arquivos
// que a limpeza guarda ($topN).

let mongo: Mongo;
let sequence = 0;
const opened: Array<{ disconnect(): Promise<void> }> = [];
const directories: string[] = [];

before(async () => {
  mongo = await startMongo();
});

after(async () => {
  await Promise.all(opened.map(db => db.disconnect()));
  await mongo.stop();
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
});

async function open() {
  const db = createDatabase({
    uri: mongo.getUri(`ao-uerj-ota-${++sequence}`),
    timeoutMs: 5000,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  opened.push(db);
  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  return { models, repositories: createMongoRepositories(models) };
}

const T0 = Date.UTC(2026, 10, 6, 12);

function entry(
  overrides: Partial<NewOtaEntry> & { body: string; at: number },
): NewOtaEntry {
  const { at, ...rest } = overrides;
  return {
    platform: 'android',
    runtimeVersion: '2.16.0',
    kind: 'manifest',
    signature: 'c2ln',
    bodyHash: bodyHashOf(rest.body),
    updateId: null,
    commitTime: new Date(at),
    launchAsset: null,
    assets: [],
    publishedAt: new Date(at),
    ...rest,
  };
}

test('entries keep the exact text, come back newest first and are unique by text and update id', async () => {
  const { repositories } = await open();
  const entries = repositories.otaEntries;
  // o texto volta igual, byte a byte: espaços, a ordem das chaves e acentos
  const body = '{ "id":"x",  "extra": {"nome":"Avaliação"} }\n';
  const first = await entries.create(
    entry({ body, at: T0, updateId: 'a', launchAsset: 'L1', assets: ['L1'] }),
  );
  assert.ok(first);
  assert.equal(first.body, body);
  assert.equal(first.updateId, 'a');

  const second = await entries.create(
    entry({ body: '{"id":"y"}', at: T0 + 1000, updateId: 'b' }),
  );
  assert.equal((await entries.latest('android', '2.16.0'))?.id, second?.id);
  assert.equal(await entries.latest('ios', '2.16.0'), null);
  assert.equal(await entries.latest('android', '2.15.0'), null);

  // o mesmo texto, ou o mesmo update com outro texto, não entram de novo
  assert.equal(await entries.create(entry({ body, at: T0 + 2000 })), null);
  assert.equal(
    await entries.create(
      entry({ body: '{"id":"z"}', at: T0 + 3000, updateId: 'a' }),
    ),
    null,
  );
  // as diretivas (sem update id) não se atrapalham entre si
  const rollbacks = await Promise.all(
    [4000, 5000].map(at =>
      entries.create(
        entry({
          body: rollbackText(new Date(T0 + at)),
          at: T0 + at,
          kind: 'directive',
        }),
      ),
    ),
  );
  assert.ok(rollbacks.every(Boolean));
  // em outro runtime, o mesmo texto e o mesmo update são outra publicação
  assert.ok(
    await entries.create(
      entry({ body, at: T0, updateId: 'a', runtimeVersion: '2.17.0' }),
    ),
  );

  assert.equal(
    (await entries.findByUpdateId('android', '2.16.0', 'a'))?.body,
    body,
  );
  assert.equal(
    (await entries.findByBodyHash('android', '2.16.0', bodyHashOf(body)))
      ?.updateId,
    'a',
  );
  assert.equal(await entries.isLaunchAssetOfOtherPlatform('L1', 'ios'), true);
  assert.equal(
    await entries.isLaunchAssetOfOtherPlatform('L1', 'android'),
    false,
  );
});

test('the kept files are those of the last manifests of each platform and runtime', async () => {
  const { repositories } = await open();
  const entries = repositories.otaEntries;
  for (let i = 1; i <= 5; i += 1)
    await entries.create(
      entry({
        body: `{"n":${i}}`,
        at: T0 + i * 1000,
        updateId: `u${i}`,
        assets: [`L${i}`, 'shared'],
      }),
    );
  // uma diretiva mais nova não tira o lugar de um manifesto
  await entries.create(
    entry({ body: 'rollback', at: T0 + 9000, kind: 'directive' }),
  );
  await entries.create(
    entry({
      body: '{"ios":1}',
      at: T0,
      platform: 'ios',
      updateId: 'i1',
      assets: ['I1'],
    }),
  );
  assert.deepEqual([...(await entries.keptAssets(3))].sort(), [
    'I1',
    'L3',
    'L4',
    'L5',
    'shared',
  ]);
  assert.deepEqual([...(await entries.keptAssets(1))].sort(), [
    'I1',
    'L5',
    'shared',
  ]);
});

test('a publication goes through the database and is answered to the app', async () => {
  const { repositories } = await open();
  const keys = otaSigningKeys();
  const dir = mkdtempSync(path.join(tmpdir(), 'ao-uerj-ota-mongo-'));
  directories.push(dir);
  const ota = createOtaUpdates({
    entries: repositories.otaEntries,
    assets: createFileOtaAssetStore(dir),
    verifier: createOtaSignatureVerifier(keys.certificate),
    noUpdateSignature: null,
    assetOrigin: null,
  });
  const bundle = bundleBytes('mongo');
  const hash = assetHashOf(bundle);
  await ota.uploadAsset({
    hash,
    signature: signText(keys.privateKey, hash),
    contentType: 'application/javascript',
    content: bundle,
  });
  const manifest = manifestText({
    createdAt: new Date(Date.now() - 60 * 1000),
    runtimeVersion: '2.16.0',
    launchAsset: assetOf(bundle, {
      fileExtension: '.bundle',
      contentType: 'application/javascript',
    }),
  });
  const input = {
    platform: 'android' as const,
    runtimeVersion: '2.16.0',
    manifest,
    signature: signText(keys.privateKey, manifest),
  };
  assert.equal((await ota.publishUpdate(input)).created, true);
  assert.equal((await ota.publishUpdate(input)).created, false);
  assert.deepEqual(
    await ota.check({
      platform: 'android',
      runtimeVersion: '2.16.0',
      currentUpdateId: null,
    }),
    { kind: 'manifest', body: manifest, signature: input.signature },
  );
});
