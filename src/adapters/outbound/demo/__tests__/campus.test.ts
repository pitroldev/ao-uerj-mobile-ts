import { AppError } from '@root/shared/errors/AppError';
import { CampusNow } from '@root/modules/campus-now/application/CampusNow';
import type { CampusNowStorePort } from '@root/modules/campus-now/application/ports';
import {
  CampusNowError,
  isLive,
  monthOf,
  previousMonth,
} from '@root/modules/campus-now/domain/campusNow';
import { createDemoClock } from '../clock';
import { createDemoCampus } from '../ports/campus';

const MINUTE = 60_000;

function setup() {
  let time = new Date(2026, 10, 18, 10, 0).getTime();
  const clock = createDemoClock(() => time, 0);
  const server = createDemoCampus(clock);
  const saved = new Map<string, unknown>();
  const store: CampusNowStorePort = {
    read: async <T>(scope: string, key: string) =>
      (saved.get(`${scope}:${key}`) as T | undefined) ?? null,
    write: async (scope, key, value) => {
      saved.set(`${scope}:${key}`, value);
    },
  };
  const campus = new CampusNow({
    server,
    store,
    account: () => ({ scope: 'demo' }),
    now: () => time,
  });
  return {
    server,
    campus,
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('createDemoCampus', () => {
  it('lists three live notices from other students, newest first', async () => {
    const { campus, now } = setup();
    const list = await campus.list();
    expect(list.notices).toHaveLength(3);
    expect(list.notices.map(notice => notice.kind)).toEqual([
      'elevators',
      'power',
      'access',
    ]);
    expect(list.notices.every(notice => isLive(notice, now()))).toBe(true);
    expect(list.notices.some(notice => notice.mine)).toBe(false);
    expect(list.notices[0].confirmed).toBe(false);
    expect(list.notices[2]).toMatchObject({ confirmed: true, level: 3 });
    expect(list.helpersToday).toBeGreaterThan(0);
    expect(list.you).toEqual({
      points: 140,
      level: 2,
      levelAt: 100,
      nextLevelAt: 300,
    });
  });

  it('reports, answers, thanks and shows it in "Você"', async () => {
    const { campus, advance } = setup();
    const before = await campus.list();
    const [elevators, power] = before.notices;

    const reported = await campus.report({
      kind: 'restroom',
      status: 'no_paper',
      place: { type: 'floor', block: 'B', floor: '3' },
    });
    expect(reported).toMatchObject({
      merged: false,
      replaced: null,
      you: { earned: 10, points: 150 },
    });
    expect(reported.notice).toMatchObject({ mine: true, views: 0, thanks: 0 });

    const confirmed = await campus.answer(elevators.id, 'confirm');
    expect(confirmed.notice).toMatchObject({
      confirmed: true,
      confirmations: 1,
      answer: 'confirm',
    });
    expect(confirmed.you.earned).toBe(3);
    await expect(campus.answer(elevators.id, 'confirm')).rejects.toEqual(
      new CampusNowError('answered'),
    );
    // de "Continua" para "Acabou": vale, sem pontos
    const ended = await campus.answer(elevators.id, 'end');
    expect(ended.notice).toMatchObject({ answer: 'end', ends: 1 });
    expect(ended.you.earned).toBe(0);

    const thanked = await campus.thank(power.id);
    expect(thanked.notice.thanked).toBe(true);
    await campus.flag(power.id);
    await campus.markSeen([power.id]);

    await expect(campus.answer(reported.notice.id, 'confirm')).rejects.toEqual(
      new CampusNowError('own'),
    );
    await expect(campus.thank(reported.notice.id)).rejects.toEqual(
      new CampusNowError('own'),
    );

    // os alunos inventados veem, confirmam e agradecem o aviso
    advance(5 * MINUTE);
    const later = await campus.list();
    const mine = later.notices.find(notice => notice.mine)!;
    expect(mine).toMatchObject({ confirmed: true, thanks: 1 });
    expect(mine.views).toBeGreaterThan(0);
    expect(await campus.observe(later)).toBe(true);

    const you = await campus.you();
    expect(you.today.map(notice => notice.id)).toEqual([reported.notice.id]);
    expect(you.counts).toMatchObject({ notices: 10, answers: 18 });
    expect(you.you.points).toBe(140 + 10 + 3 + 5 + 1);
    expect(you.week.notices).toBeGreaterThanOrEqual(1);

    // "Já resolveu": o aviso do próprio aluno acaba na hora
    const done = await campus.answer(reported.notice.id, 'end');
    expect(done.notice.state).toBe('ended');
    expect(
      (await campus.list()).notices.some(notice => notice.id === mine.id),
    ).toBe(false);
  });

  it('merges an equal notice and replaces another status at the same place', async () => {
    const { campus } = setup();
    const [elevators] = (await campus.list()).notices;
    const merged = await campus.report({
      kind: 'elevators',
      status: 'long_queue',
      place: { type: 'elevators' },
    });
    expect(merged).toMatchObject({ merged: true, replaced: null });
    expect(merged.notice.id).toBe(elevators.id);
    expect(merged.you.earned).toBe(3);

    const replaced = await campus.report({
      kind: 'elevators',
      status: 'short_queue',
      place: { type: 'elevators' },
    });
    expect(replaced).toMatchObject({ merged: false, replaced: elevators.id });
    const ids = (await campus.list()).notices.map(notice => notice.id);
    expect(ids).not.toContain(elevators.id);
    expect(ids).toContain(replaced.notice.id);
  });

  it('refuses like the server', async () => {
    const { server } = setup();
    await expect(
      server.report({
        kind: 'access',
        status: 'gate_closed',
        place: { type: 'floor', block: 'A', floor: '2' },
      }),
    ).rejects.toEqual(new CampusNowError('place'));
    await expect(
      server.report({
        kind: 'power',
        status: 'no_ac',
        place: { type: 'floor', block: 'A', floor: 'SE' },
      }),
    ).rejects.toEqual(new CampusNowError('place'));
    await expect(
      server.report({
        kind: 'power',
        status: 'stopped',
        place: { type: 'floor', block: 'A', floor: '2' },
      }),
    ).rejects.toEqual(new AppError('INVALID_INPUT'));
    await expect(server.thank('nada')).rejects.toEqual(
      new CampusNowError('gone'),
    );
    for (let floor = 1; floor <= 10; floor++)
      await server.report({
        kind: 'internet',
        status: 'wifi_slow',
        place: { type: 'floor', block: 'C', floor: String(floor) },
      });
    await expect(
      server.report({
        kind: 'internet',
        status: 'wifi_slow',
        place: { type: 'floor', block: 'C', floor: '11' },
      }),
    ).rejects.toEqual(new CampusNowError('limit'));
  });

  it('summarizes the community for this month and the previous one', async () => {
    const { campus, now } = setup();
    const month = monthOf(new Date(now()));
    const current = await campus.community(month);
    expect(current.week.from).toBe('2026-11-16');
    expect(current.month.month).toBe(month);
    expect(current.month.weekdays).toBe(13);
    expect(current.month.problems.length).toBeGreaterThan(0);
    for (const problem of current.month.problems)
      expect(problem.days).toBeLessThanOrEqual(current.month.weekdays);

    const previous = await campus.community(previousMonth(month));
    expect(previous.month.weekdays).toBe(22);
    await expect(campus.community('2020-01')).rejects.toEqual(
      new AppError('INVALID_INPUT'),
    );
  });

  it('brings the seeded notices back after they expire', async () => {
    const { campus, advance, now } = setup();
    const first = (await campus.list()).notices.map(notice => notice.id);
    advance(13 * 60 * MINUTE);
    const later = (await campus.list()).notices;
    expect(later).toHaveLength(3);
    expect(later.every(notice => isLive(notice, now()))).toBe(true);
    expect(later.map(notice => notice.id)).not.toEqual(first);
  });

  it('cancels a read with the signal', async () => {
    const { server } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(server.you({ signal: controller.signal })).rejects.toEqual(
      new AppError('CANCELLED'),
    );
  });
});
