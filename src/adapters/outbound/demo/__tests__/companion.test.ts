import { AppError } from '@root/shared/errors/AppError';
import { CompanionCalls } from '@root/modules/companion/application/CompanionCalls';
import type { MembershipStorePort } from '@root/modules/companion/application/ports';
import {
  canJoin,
  CompanionError,
  type Membership,
  type OpenCallRequest,
} from '@root/modules/companion/domain/companion';
import { createDemoClock } from '../clock';
import { createDemoCompanion } from '../ports/companion';

const MINUTE = 60_000;

function setup() {
  let time = new Date(2026, 10, 16, 11, 2).getTime();
  const clock = createDemoClock(() => time, 0);
  const server = createDemoCompanion(clock);
  let saved: Membership[] = [];
  const store: MembershipStorePort = {
    read: async () => saved,
    write: async next => {
      saved = [...next];
    },
  };
  const calls = new CompanionCalls({ server, store, now: () => time });
  return {
    server,
    calls,
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

const lunchRequest = (at: number): OpenCallRequest => ({
  kind: 'lunch',
  at,
  spot: 'lago',
  destination: null,
  note: 'Na sombra, perto dos bancos',
  capacity: 4,
  name: 'Alex',
});

describe('createDemoCompanion', () => {
  it('lists a lunch at the RU and a group home to the metro', async () => {
    const { calls, now } = setup();
    const list = await calls.list();
    expect(list.watching).toBeGreaterThan(1);
    expect(list.calls.map(call => [call.kind, call.spot])).toEqual([
      ['lunch', 'ru'],
      ['home', 'portao-1'],
    ]);
    const [lunch, home] = list.calls;
    expect(lunch.at).toBeGreaterThan(now());
    expect(lunch.going).toBe(2);
    expect(home.destination).toBe('metro');
    expect(home.going).toBe(3);
    expect(list.calls.every(call => canJoin(call, now()))).toBe(true);
  });

  it('joins, says a phrase, reads and leaves through CompanionCalls', async () => {
    const { calls, server } = setup();
    const [lunch] = (await calls.list()).calls;

    const joined = await calls.join(lunch.id, 'Alex');
    expect(joined.going).toBe(3);
    expect(joined.members.find(member => member.you)?.name).toBe('Alex');
    expect(calls.membership(lunch.id)?.host).toBe(false);

    const said = await calls.say(lunch.id, 'at_spot');
    expect(said.feed.at(-1)).toMatchObject({ phrase: 'at_spot', you: true });
    expect(said.feed.some(entry => !entry.you)).toBe(true);
    await expect(calls.say(lunch.id, 'home_safe')).rejects.toEqual(
      new AppError('INVALID_INPUT'),
    );

    // entrar de novo pelo servidor: o aluno já está lá
    await expect(server.join(lunch.id, 'Alex')).rejects.toEqual(
      new CompanionError('already_member'),
    );

    await calls.leave(lunch.id);
    expect(calls.membership(lunch.id)).toBeUndefined();
    const after = (await calls.list()).calls.find(call => call.id === lunch.id);
    expect(after?.going).toBe(2);
  });

  it('opens a call, gets someone joining and removes them as the host', async () => {
    const { calls, advance, now } = setup();
    const opened = await calls.open(lunchRequest(now() + 30 * MINUTE));
    expect(opened.members).toEqual([
      expect.objectContaining({ name: 'Alex', host: true, you: true }),
    ]);
    expect(calls.membership(opened.id)?.host).toBe(true);
    expect((await calls.list()).calls.some(call => call.id === opened.id)).toBe(
      true,
    );

    advance(MINUTE);
    const read = await calls.read(opened.id);
    const guest = read.members.find(member => !member.you);
    expect(guest).toBeDefined();
    expect(read.feed).toEqual([
      expect.objectContaining({ phrase: 'on_my_way', you: false }),
    ]);

    await expect(calls.remove(opened.id, read.members[0].ref)).rejects.toEqual(
      new CompanionError('not_host'),
    );
    const removed = await calls.remove(opened.id, guest!.ref);
    expect(removed.members).toHaveLength(1);
    await expect(calls.remove(opened.id, guest!.ref)).rejects.toEqual(
      new CompanionError('member_gone'),
    );

    // quem chamou e sai encerra para todos
    await calls.leave(opened.id);
    expect((await calls.list()).calls.some(call => call.id === opened.id)).toBe(
      false,
    );
  });

  it('keeps one open call per student', async () => {
    const { server, now } = setup();
    const first = await server.open(lunchRequest(now() + 20 * MINUTE));
    await server.open(lunchRequest(now() + 40 * MINUTE));
    const read = await server.read(first.call.id, first.memberKey);
    expect(read.endedAt).not.toBeNull();
  });

  it('refuses like the server', async () => {
    const { server, now } = setup();
    const at = now() + 30 * MINUTE;
    await expect(
      server.open({ ...lunchRequest(at), note: 'me chama no zap' }),
    ).rejects.toEqual(new CompanionError('contact'));
    await expect(
      server.open({ ...lunchRequest(at), note: 'x'.repeat(81) }),
    ).rejects.toEqual(new AppError('INVALID_INPUT'));
    await expect(
      server.open({ ...lunchRequest(at), name: 'Alex 2' }),
    ).rejects.toEqual(new AppError('INVALID_INPUT'));
    await expect(
      server.open({ ...lunchRequest(at), capacity: 7 }),
    ).rejects.toEqual(new AppError('INVALID_INPUT'));
    await expect(
      server.open({ ...lunchRequest(now() + 4 * 60 * MINUTE) }),
    ).rejects.toEqual(new AppError('INVALID_INPUT'));
    await expect(
      server.open({ ...lunchRequest(at), spot: 'portao-1' }),
    ).rejects.toEqual(new AppError('INVALID_INPUT'));
    await expect(server.join('nada', 'Alex')).rejects.toEqual(
      new CompanionError('gone'),
    );
    await expect(server.read('nada', 'chave')).rejects.toEqual(
      new CompanionError('gone'),
    );
    await expect(server.list('passe-falso')).rejects.toEqual(
      new CompanionError('pass_expired'),
    );
  });

  it('takes a joined call off the list after the time and seeds new ones', async () => {
    const { server, advance } = setup();
    const { pass } = await server.pass();
    const [, home] = (await server.list(pass)).calls;
    // o grupo da volta, com 8 vagas e 3 pessoas: o aluno ocupa uma
    const joined = await server.join(home.id, 'Alex');
    expect(joined.call.going).toBe(4);
    advance(2 * 60 * MINUTE);
    const fresh = (await server.pass()).pass;
    const listed = (await server.list(fresh)).calls;
    expect(listed.some(call => call.id === home.id)).toBe(false);
    // as inventadas voltam, com horários a partir de agora
    expect(listed.map(call => call.kind)).toEqual(['lunch', 'home']);
  });

  it('hides a call reported for harassment from inside', async () => {
    const { calls } = setup();
    const [lunch] = (await calls.list()).calls;
    await calls.join(lunch.id, 'Alex');
    await calls.report(lunch.id, 'harassment');
    await expect(calls.read(lunch.id)).rejects.toEqual(
      new CompanionError('gone'),
    );
    expect(calls.membership(lunch.id)).toBeUndefined();
  });

  it('counts an outside report once and keeps the call', async () => {
    const { calls } = setup();
    const [, home] = (await calls.list()).calls;
    await calls.report(home.id, 'spam');
    expect(calls.hasReported(home.id)).toBe(true);
    await calls.report(home.id, 'spam');
    expect((await calls.list()).calls.some(call => call.id === home.id)).toBe(
      true,
    );
  });

  it('cancels a read with the signal and returns copies', async () => {
    const { server } = setup();
    const { pass } = await server.pass();
    const controller = new AbortController();
    controller.abort();
    await expect(
      server.list(pass, { signal: controller.signal }),
    ).rejects.toEqual(new AppError('CANCELLED'));
    const first = await server.list(pass);
    first.calls[0].going = 99;
    const second = await server.list(pass);
    expect(second.calls[0].going).toBe(2);
  });
});
