import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { loadConfig } from '../src/config.ts';

test('the defaults run a development server on 3300 with the portal monitor', () => {
  const config = loadConfig({});

  assert.equal(config.env, 'development');
  assert.equal(config.port, 3300);
  assert.equal(config.host, undefined);
  assert.equal(config.logLevel, 'info');
  assert.equal(config.mongo.uri, 'mongodb://localhost:27017/aouerj');
  assert.equal(config.mongo.autoIndex, true);
  assert.equal(config.http.jsonLimit, '1mb');
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
  assert.equal(
    loadConfig({ FORCE_HTTPS: 'true', PUBLIC_URL: 'https://pitrol.dev' }).http
      .forceHttps,
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
