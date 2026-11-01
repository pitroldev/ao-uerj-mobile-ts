/*
 * cutover.sh: a troca única do nginx do servidor antigo para o novo e a volta
 * (--undo). Roda de dentro de deploy/server de uma versão implantada, como na
 * VM, com um smoke.mjs de mentira ao lado.
 */
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  FAKE_SMOKE,
  SCRIPTS,
  app,
  modeOf,
  put,
  read,
  sandbox,
  unsupported,
} from './support.mjs';

const SHA = 'abc'.padEnd(40, '3');
const INCLUDE = 'include snippets/ao-uerj-proxy.conf;';

const block = listen => `server {
  listen ${listen};
  server_name pitrol.dev;
  location /aouerj/ {
    proxy_pass http://localhost:3000/aouerj/;
  }
  location /schedules/ {
    proxy_pass http://localhost:3333/;
  }
}
`;
const SITE_BEFORE = `${block(80)}${block('443 ssl')}`;

const LEGACY = {
  aouerj: app('ao-uerj', {
    script: '/home/ubuntu/server-pitroldev/src/index.js',
    cwd: '/home/ubuntu/server-pitroldev',
  }),
  generator: app('uerj-generator', {
    script: '/home/ubuntu/class-schedule-generator/dist/index.js',
    cwd: '/home/ubuntu/class-schedule-generator',
  }),
};

/** A VM depois da primeira implantação, ainda com o nginx no servidor antigo. */
function vm(t, { site = SITE_BEFORE, active = 'blue' } = {}) {
  const box = sandbox(t);
  const here = join(box.root, 'releases', SHA, 'deploy', 'server');
  for (const file of ['cutover.sh', 'nginx-proxy.conf']) {
    put(join(here, file), read(join(SCRIPTS, file)));
  }
  put(join(here, 'smoke.mjs'), FAKE_SMOKE);

  // o sites-enabled é um link, como no Ubuntu: a troca edita o arquivo dele
  const siteFile = join(box.etc, 'nginx', 'sites-available', 'default');
  put(siteFile, site);
  mkdirSync(join(box.etc, 'nginx', 'sites-enabled'), { recursive: true });
  const siteLink = join(box.etc, 'nginx', 'sites-enabled', 'default');
  symlinkSync(siteFile, siteLink);
  mkdirSync(join(box.etc, 'nginx', 'snippets'), { recursive: true });

  const state = join(box.root, 'state');
  if (active) {
    put(join(state, 'active'), `${active}\n`);
    put(join(state, `${active}.sha`), `${SHA}\n`);
  }
  // os anexos: um já copiado pelo bootstrap (e não pode ser sobrescrito) e um novo
  const legacyReports = join(box.home, 'server-pitroldev', 'AOreports');
  put(join(legacyReports, 'Home-1.html'), 'do servidor antigo\n');
  put(join(legacyReports, 'Notas-2.html'), 'chegou depois do bootstrap\n');
  const reports = join(box.root, 'shared', 'AOreports');
  put(join(reports, 'Home-1.html'), 'já copiado\n');

  box.apps([
    LEGACY.aouerj,
    LEGACY.generator,
    app('uerj-twitter'),
    app(`ao-uerj-${active || 'blue'}`),
  ]);
  return {
    ...box,
    siteFile,
    siteLink,
    state,
    reports,
    snippet: join(box.etc, 'nginx', 'snippets', 'ao-uerj-proxy.conf'),
    cutover: (args = [], env = {}) =>
      box.run(join(here, 'cutover.sh'), args, { env }),
    names: () => box.apps().map(entry => entry.name),
  };
}

describe('cutover.sh', { skip: unsupported }, () => {
  test('the cutover sends both locations to the new server and retires the old processes', async t => {
    const box = vm(t);
    const { code, output } = await box.cutover();
    assert.equal(code, 0, output);

    // as quatro linhas (80 e 443) viram o include, e o link continua link
    const site = read(box.siteFile);
    assert.equal(site.split(INCLUDE).length - 1, 4);
    assert.doesNotMatch(site, /localhost:3000|localhost:3333/);
    assert.ok(lstatSync(box.siteLink).isSymbolicLink());
    assert.equal(read(box.snippet), read(join(SCRIPTS, 'nginx-proxy.conf')));
    assert.equal(modeOf(box.snippet), 0o644);
    assert.equal(
      read(join(box.state, 'nginx-default.before-cutover')),
      SITE_BEFORE,
    );

    // confere a versão ativa antes, e pelo nginx depois de recarregar
    assert.deepEqual(
      box
        .calls()
        .filter(call => ['smoke', 'nginx', 'systemctl'].includes(call.cmd))
        .map(call => `${call.cmd} ${call.args.join(' ')}`),
      [
        `smoke http://127.0.0.1:3101 --require-database --expect-commit ${SHA}`,
        'nginx -t -q',
        'systemctl reload nginx',
        `smoke https://pitrol.dev --via 127.0.0.1 --require-database --expect-commit ${SHA}`,
      ],
    );

    // os antigos saem do pm2, com o que o --undo precisa para voltar
    assert.deepEqual(box.names(), ['uerj-twitter', 'ao-uerj-blue']);
    assert.equal(
      read(join(box.state, 'legacy-apps.tsv')),
      [
        `ao-uerj\t${LEGACY.aouerj.pm2_env.pm_exec_path}\t${LEGACY.aouerj.pm2_env.pm_cwd}`,
        `uerj-generator\t${LEGACY.generator.pm2_env.pm_exec_path}\t${LEGACY.generator.pm2_env.pm_cwd}`,
        '',
      ].join('\n'),
    );

    // os anexos que chegaram, sem sobrescrever, numa pasta só do dono
    assert.equal(read(join(box.reports, 'Home-1.html')), 'já copiado\n');
    assert.equal(
      read(join(box.reports, 'Notas-2.html')),
      'chegou depois do bootstrap\n',
    );
    assert.equal(modeOf(box.reports), 0o700);
  });

  test('a second cutover does nothing', async t => {
    const box = vm(t);
    assert.equal((await box.cutover()).code, 0);
    const smokes = box.calls('smoke').length;
    const { code, output } = await box.cutover();
    assert.equal(code, 0);
    assert.match(output, /o cutover já foi feito/);
    assert.equal(box.calls('smoke').length, smokes);
  });

  test('a failed check through the nginx undoes the switch and keeps the old processes', async t => {
    const box = vm(t);
    const { code, output } = await box.cutover([], { SMOKE_FAIL: 'nginx' });
    assert.equal(code, 1);
    assert.match(output, /a conferência pelo nginx falhou; desfazendo/);
    assert.equal(read(box.siteFile), SITE_BEFORE);
    assert.ok(box.names().includes('ao-uerj'));
    assert.ok(box.names().includes('uerj-generator'));
    assert.equal(existsSync(join(box.state, 'legacy-apps.tsv')), false);
  });

  test('a configuration the nginx refuses is undone', async t => {
    const box = vm(t);
    box.rules.push({ cmd: 'nginx', match: '-t', calls: [1] });
    const { code, output } = await box.cutover();
    assert.equal(code, 1);
    assert.match(output, /o nginx recusou a configuração; desfazendo/);
    assert.equal(read(box.siteFile), SITE_BEFORE);
    assert.ok(box.names().includes('ao-uerj'));
  });

  test('the cutover refuses a site that is not the expected one, or no deployed version', async t => {
    const changed = SITE_BEFORE.replace(
      'proxy_pass http://localhost:3000/aouerj/;',
      'proxy_pass http://localhost:3001/aouerj/;',
    );
    const odd = vm(t, { site: changed });
    const refused = await odd.cutover();
    assert.equal(refused.code, 1);
    assert.match(
      refused.output,
      /esperava 2 linhas 'proxy_pass http:\/\/localhost:3000\/aouerj\/;'/,
    );
    assert.equal(read(odd.siteFile), changed);
    assert.equal(existsSync(odd.snippet), false);

    const empty = vm(t, { active: null });
    const none = await empty.cutover();
    assert.equal(none.code, 1);
    assert.match(none.output, /nenhuma versão implantada/);
    assert.deepEqual(empty.calls('smoke'), []);
  });

  test('the undo brings back the old site and the old processes', async t => {
    const box = vm(t);
    assert.equal((await box.cutover()).code, 0);
    const { code, output } = await box.cutover(['--undo']);
    assert.equal(code, 0, output);
    assert.match(output, /o nginx voltou para o servidor antigo/);
    assert.equal(read(box.siteFile), SITE_BEFORE);
    const starts = box
      .calls('pm2')
      .filter(call => call.args[0] === 'start')
      .map(call => call.args);
    assert.deepEqual(starts, [
      [
        'start',
        LEGACY.aouerj.pm2_env.pm_exec_path,
        '--name',
        'ao-uerj',
        '--cwd',
        LEGACY.aouerj.pm2_env.pm_cwd,
      ],
      [
        'start',
        LEGACY.generator.pm2_env.pm_exec_path,
        '--name',
        'uerj-generator',
        '--cwd',
        LEGACY.generator.pm2_env.pm_cwd,
      ],
    ]);
    assert.ok(box.names().includes('ao-uerj'));
    assert.equal(
      box.calls('systemctl').filter(call => call.args[0] === 'reload').length,
      2,
    );
  });

  test('the undo without a backup refuses to guess', async t => {
    const box = vm(t);
    const { code, output } = await box.cutover(['--undo']);
    assert.equal(code, 1);
    assert.match(output, /sem cópia em/);
    assert.equal(read(box.siteFile), SITE_BEFORE);
  });
});
