import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  callCases,
  campusAsks,
  campusDone,
  decidedCases,
} from '../src/adapters/inbound/http/aouerj/admin/desk.ts';
import { groupTitle } from '../src/adapters/inbound/http/aouerj/admin/labels.ts';
import type { Notice } from '../src/modules/campus-now/domain.ts';
import type { Moderation } from '../src/modules/campus-now/ports.ts';
import type { CallReport } from '../src/modules/companion/domain.ts';
import { createErrorReports } from '../src/modules/reports/application.ts';
import {
  parseDiagnostic,
  reportSignature,
} from '../src/modules/reports/domain.ts';
import { createSuggestions } from '../src/modules/suggestions/application.ts';
import {
  manualClock,
  memoryAttachments,
  memoryRepositories,
} from './support.ts';

/*
 * O que a administração junta para cada área: os relatos pelo erro, as
 * denúncias por chamada e o que pede você no campus.
 */

const NOW = new Date(Date.UTC(2026, 10, 19, 18, 40));
const MINUTE = 60 * 1000;
const diagnostic = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    schemaVersion: 1,
    operation: 'Quadro de Horários',
    category: 'USER_REPORT',
    appVersion: '2.19.0',
    parserVersion: '3',
    ...extra,
  });

test('the signature joins the same error: the reads with error, the generator outcome or the screen', () => {
  const layout = parseDiagnostic(
    diagnostic({
      portalErrors: { schedule: 'PORTAL_LAYOUT_CHANGED', grades: 'NETWORK' },
    }),
  );
  const sameReversed = parseDiagnostic(
    diagnostic({
      portalErrors: { grades: 'NETWORK', schedule: 'PORTAL_LAYOUT_CHANGED' },
    }),
  );
  assert.equal(
    reportSignature('Quadro de Horários', layout),
    reportSignature('Quadro de Horários', sameReversed),
  );
  assert.notEqual(
    reportSignature('Quadro de Horários', layout),
    reportSignature('Quadro de Notas', layout),
  );
  const generator = (outcome: string) =>
    parseDiagnostic(diagnostic({ generator: { step: 2, outcome } }));
  assert.notEqual(
    reportSignature('Gerador de Grade', generator('EMPTY')),
    reportSignature('Gerador de Grade', generator('SHORTFALL_ROUTINE')),
  );
  // o relato do aluno, sem erro de leitura, junta pela tela; a 1.x, também
  assert.equal(
    reportSignature('Notas', parseDiagnostic(diagnostic())),
    'Notas|USER_REPORT',
  );
  assert.equal(reportSignature('Notas', null), 'Notas|sem-diagnostico');
});

test('the groups count the students, the versions and the updates, and resolve together with one time', async () => {
  const clock = manualClock(NOW.getTime());
  const { repositories, data } = memoryRepositories(clock);
  const reports = createErrorReports(
    repositories.reports,
    memoryAttachments().store,
    { now: clock.now },
  );
  const layout = diagnostic({
    portalErrors: { schedule: 'PORTAL_LAYOUT_CHANGED' },
  });
  await reports.submit({
    page: 'Horários',
    attachments: [layout],
    studentId: 'ana',
  });
  await reports.submit({
    page: 'Horários',
    attachments: [
      diagnostic({
        portalErrors: { schedule: 'PORTAL_LAYOUT_CHANGED' },
        appVersion: '2.18.0',
        updateId: '0195f2a1-aaaa',
      }),
    ],
    studentId: 'ana',
  });
  await reports.submit({
    page: 'Horários',
    attachments: [layout],
    studentId: null,
  });
  await reports.submit({
    page: 'Notas',
    description: 'A P2 aparece 0,0, mas no portal está 7,5',
    attachments: [diagnostic()],
  });

  const [big, small] = await reports.groups('open');
  assert.equal(big.reports.length, 3);
  assert.equal(big.students, 1);
  assert.equal(big.anonymous, 1);
  assert.deepEqual(big.versions, [
    { version: '2.19.0', reports: 2 },
    { version: '2.18.0', reports: 1 },
  ]);
  assert.deepEqual(big.updates, [{ id: '0195f2a1-aaaa', reports: 1 }]);
  assert.ok(big.first < big.last);
  assert.equal(groupTitle(big), 'A grade: o portal mudou a página');
  assert.equal(groupTitle(small), 'A P2 aparece 0,0, mas no portal está 7,5');
  // a chave não muda enquanto a assinatura for a mesma
  assert.equal((await reports.groups('open'))[0].key, big.key);

  clock.advance(5 * MINUTE);
  const at = clock.now();
  const done = await reports.setResolvedMany(
    big.reports.map(report => report.id),
    true,
  );
  assert.equal(done.changed, 3);
  assert.equal(done.at?.getTime(), at);
  assert.equal((await reports.groups('open')).length, 1);
  const [resolved] = await reports.groups('resolved');
  assert.equal(resolved.key, big.key);
  assert.equal(resolved.resolvedAt?.getTime(), at);
  assert.ok(
    data.reports
      .filter(report => report.page === 'Horários')
      .every(report => report.resolvedAt?.getTime() === at),
  );
  assert.equal((await reports.byStudent('ana')).length, 2);
});

test('a suggestion is archived with the time and comes back as new', async () => {
  const clock = manualClock(NOW.getTime());
  const { repositories } = memoryRepositories(clock);
  const suggestions = createSuggestions(repositories.suggestions, {
    now: clock.now,
  });
  const created = await suggestions.submit({
    name: 'Ana',
    content: 'Modo escuro',
  });
  assert.equal(created.archivedAt, null);
  const at = clock.now();
  assert.equal(
    (await suggestions.setArchived(created.id, true))?.archivedAt?.getTime(),
    at,
  );
  assert.equal(
    (await suggestions.setArchived(created.id, false))?.archivedAt,
    null,
  );
  assert.equal(await suggestions.setArchived('nao-existe', true), null);
});

const callReport = (extra: Partial<CallReport>): CallReport => ({
  id: `r-${Math.random()}`,
  callId: 'call-1',
  kind: 'lunch',
  at: new Date(NOW.getTime() + 30 * MINUTE),
  spot: 'ru',
  destination: null,
  note: '',
  names: ['Leo'],
  people: [{ name: 'Leo', host: true, student: 'leo' }],
  reporterStudent: 'bia',
  reason: 'spam',
  source: 'outsider',
  count: 1,
  hidden: false,
  hiddenBy: null,
  reviewedAt: null,
  callExpiresAt: new Date(NOW.getTime() + 60 * MINUTE),
  createdAt: new Date(NOW.getTime() - 10 * MINUTE),
  expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * MINUTE),
  ...extra,
});

test('the reports of a call ask you while it is alive and some report has no decision', () => {
  const pending = callCases([callReport({})], [], NOW);
  assert.equal(pending[0].pending, true);
  // mantida no ar: não pede mais, e aparece no "Feitos"
  const kept = callCases(
    [callReport({ reviewedAt: new Date(NOW.getTime() - MINUTE) })],
    [],
    NOW,
  );
  assert.equal(kept[0].pending, false);
  assert.equal(decidedCases(kept, NOW).length, 1);
  // uma denúncia nova depois de mantida volta a pedir
  const again = callCases(
    [
      callReport({ createdAt: NOW }),
      callReport({ reviewedAt: new Date(NOW.getTime() - MINUTE) }),
    ],
    [],
    NOW,
  );
  assert.equal(again[0].pending, true);
  assert.equal(again[0].reports.length, 2);
  // fora do ar ou vencida, não pede
  const hidden = callCases(
    [callReport({ hidden: true, hiddenBy: 'moderation' })],
    [],
    NOW,
  );
  assert.equal(hidden[0].pending, false);
  assert.equal(hidden[0].hiddenBy, 'moderation');
  const expired = callCases(
    [callReport({ callExpiresAt: new Date(NOW.getTime() - MINUTE) })],
    [],
    NOW,
  );
  assert.equal(expired[0].pending, false);
  assert.equal(expired[0].alive, false);
});

const notice = (extra: Partial<Notice>): Notice => ({
  id: `n-${Math.random()}`,
  kind: 'elevators',
  status: 'stopped',
  place: { type: 'elevators' },
  placeKey: 'elevators',
  reporter: 'pedro',
  level: 1,
  trusted: false,
  confirmations: 0,
  ends: 0,
  flags: 1,
  views: 0,
  thanks: 0,
  createdAt: new Date(NOW.getTime() - 20 * MINUTE),
  expiresAt: new Date(NOW.getTime() + 40 * MINUTE),
  firstConfirmedAt: null,
  endedAt: null,
  endedBy: null,
  removedAt: null,
  removedBy: null,
  penalized: false,
  reviewedAt: null,
  thanksToldAt: null,
  purgeAt: new Date(NOW.getTime() + 70 * 24 * 60 * MINUTE),
  ...extra,
});

test('on campus, a notice asks you when it is on with a report or went off by the reports', () => {
  const onAir = notice({});
  const offByFlags = notice({
    flags: 3,
    removedAt: NOW,
    removedBy: 'flags',
    createdAt: new Date(NOW.getTime() - 5 * MINUTE),
  });
  const kept = notice({ reviewedAt: NOW });
  const ended = notice({ endedAt: NOW, endedBy: 'reporter' });
  const removedByYou = notice({
    removedAt: NOW,
    removedBy: 'moderation',
    reviewedAt: NOW,
  });
  const moderation: Moderation = {
    flagged: [offByFlags, onAir, kept, ended, removedByYou],
    recent: [],
    active: 2,
    live: [onAir, kept],
    week: {
      from: '2026-11-16',
      notices: 5,
      answers: 0,
      views: 0,
      minutesToEnd: null,
    },
    days: [],
    places: [],
  };
  // o que está no ar vem primeiro, mesmo mais antigo
  assert.deepEqual(campusAsks(moderation, NOW), [onAir, offByFlags]);
  assert.deepEqual(
    new Set(campusDone(moderation, NOW)),
    new Set([kept, removedByYou]),
  );
});
