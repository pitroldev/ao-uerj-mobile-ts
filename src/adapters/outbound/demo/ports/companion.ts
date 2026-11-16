import { AppError } from '@root/shared/errors/AppError';
import {
  CAPACITY,
  CompanionError,
  hasContact,
  isValidName,
  LEAD_MS,
  NOTE_MAX,
  PHRASES_BY_KIND,
  SPOTS_BY_KIND,
  type CallKind,
  type CallList,
  type CompanionCall,
  type DestinationId,
  type MemberCall,
  type OpenCallRequest,
  type PhraseId,
  type ReportReason,
  type SpotId,
} from '@root/modules/companion/domain/companion';
import type {
  CompanionServerPort,
  JoinedCall,
} from '@root/modules/companion/application/ports';
import type { DemoClock } from '../clock';
import {
  DEMO_CALL_SEEDS,
  DEMO_JOIN_AFTER_MINUTES,
  DEMO_JOINERS,
  DEMO_WATCHING_OTHERS,
  type DemoCallSeed,
} from '../data/companion';

/*
 * A Companhia agora da demo: as regras do servidor
 * (server/src/modules/companion), na memória e simplificadas. Há um aluno
 * só, quem está usando a demo; os outros nomes são inventados, e o único
 * que age é quem entra na chamada que o aluno abre. Tudo some quando o app
 * fecha.
 */

const MINUTE = 60 * 1000;
/** Os prazos do servidor (CALL_TIMES). */
const VISIBLE_BEFORE_MS = 60 * MINUTE;
const LISTED_AFTER_MS: Record<CallKind, number> = {
  lunch: 30 * MINUTE,
  home: 10 * MINUTE,
};
const LIFETIME_MS: Record<CallKind, number> = {
  lunch: 30 * MINUTE,
  home: 120 * MINUTE,
};
const LATE_MS = 5 * MINUTE;
const PASS_MS = 60 * MINUTE;
/** Os recados mais recentes que a chamada guarda. */
const FEED_KEEP = 60;
/** Denúncias de dentro (fora quem chamou) que tiram a chamada do ar. */
const MEMBER_REPORTS_TO_HIDE = 2;
/** A marca de quem denuncia de fora: o aluno da demo. */
const OUTSIDER = 'outsider:you';
/** O aluno da demo, quando quem chamou o tira da chamada. */
const REMOVED_STUDENT = 'student:you';

type Member = {
  /** A chave de membro (do aluno da demo) ou uma marca dos inventados. */
  id: string;
  ref: string;
  name: string;
  host: boolean;
  /** É o aluno da demo (em qualquer aparelho, a mesma pessoa). */
  student: boolean;
};

type Call = {
  id: string;
  kind: CallKind;
  at: number;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  capacity: number;
  members: Member[];
  feed: { member: string; name: string; phrase: PhraseId; at: number }[];
  reporters: string[];
  removed: string[];
  endedAt: number | null;
  hiddenAt: number | null;
  visibleFrom: number;
  listedUntil: number;
  expiresAt: number;
  /** Quando o aluno da demo abriu; `null` nas inventadas. */
  openedAt: number | null;
  /** Alguém inventado já entrou na chamada do aluno (uma vez só). */
  joinedByCrowd: boolean;
};

const invalid = () => new AppError('INVALID_INPUT');

export function createDemoCompanion(clock: DemoClock): CompanionServerPort {
  const calls = new Map<string, Call>();
  const passes = new Map<string, number>();
  /** A chamada de cada semente, para repor quando ela sai da lista. */
  const seeded = new Map<DemoCallSeed, string>();
  let sequence = 0;
  const nextId = (prefix: string) =>
    `${prefix}${(++sequence).toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  function plan(
    request: Omit<OpenCallRequest, 'name'>,
    members: Member[],
  ): Call {
    const { kind, at } = request;
    return {
      id: nextId('demo-call-'),
      kind,
      at,
      spot: request.spot,
      destination: kind === 'home' ? request.destination : null,
      note: request.note,
      capacity: request.capacity,
      members,
      feed: [],
      reporters: [],
      removed: [],
      endedAt: null,
      hiddenAt: null,
      visibleFrom: at - VISIBLE_BEFORE_MS,
      listedUntil: at + LISTED_AFTER_MS[kind],
      expiresAt: at + LIFETIME_MS[kind],
      openedAt: null,
      joinedByCrowd: false,
    };
  }

  /** As chamadas inventadas, sempre a partir de agora. */
  function seed(item: DemoCallSeed, now: number) {
    const fives = Math.ceil((now + item.inMinutes * MINUTE) / (5 * MINUTE));
    const call = plan(
      { ...item, at: fives * 5 * MINUTE },
      item.people.map((name, index) => ({
        id: `seed:${name}`,
        ref: nextId('ref-'),
        name,
        host: index === 0,
        student: false,
      })),
    );
    call.feed = item.feed.map(entry => ({
      member: `seed:${item.people[entry.person]}`,
      name: item.people[entry.person] ?? '',
      phrase: entry.phrase,
      at: now - entry.minutesAgo * MINUTE,
    }));
    calls.set(call.id, call);
    seeded.set(item, call.id);
  }

  /** Repõe a semente cuja chamada já saiu da lista: a demo nunca fica vazia. */
  function refill(now: number) {
    for (const item of DEMO_CALL_SEEDS) {
      const current = calls.get(seeded.get(item) ?? '');
      if (!current || now >= current.listedUntil) seed(item, now);
    }
  }

  const isListed = (call: Call, now: number) =>
    call.visibleFrom <= now &&
    now < call.listedUntil &&
    !call.endedAt &&
    !call.hiddenAt;

  /** A chamada que ainda vale (não venceu, não saiu do ar). */
  function find(callId: string, now: number): Call | null {
    const call = calls.get(callId);
    if (!call || now >= call.expiresAt || call.hiddenAt) return null;
    return call;
  }

  function publicView(call: Call): CompanionCall {
    return {
      id: call.id,
      kind: call.kind,
      at: call.at,
      spot: call.spot,
      destination: call.destination,
      note: call.note,
      host: call.members.find(member => member.host)?.name ?? '',
      going: call.members.length,
      capacity: call.capacity,
      listedUntil: call.listedUntil,
      expiresAt: call.expiresAt,
    };
  }

  function memberView(call: Call, member: string): MemberCall {
    return {
      ...publicView(call),
      endedAt: call.endedAt,
      members: call.members.map(item => ({
        ref: item.ref,
        name: item.name,
        host: item.host,
        you: item.id === member,
      })),
      feed: call.feed.map(entry => ({
        name: entry.name,
        phrase: entry.phrase,
        at: entry.at,
        you: entry.member === member,
      })),
    };
  }

  /** A chamada e o membro dono da chave; senão, a recusa do servidor. */
  function membership(callId: string, memberKey: string, now: number) {
    const call = find(callId, now);
    if (!call) throw new CompanionError('gone');
    const member = call.members.find(item => item.id === memberKey);
    if (!member)
      throw new CompanionError(
        call.removed.includes(memberKey) ? 'removed' : 'not_member',
      );
    return { call, member };
  }

  function checkName(name: string): string {
    if (!isValidName(name)) throw invalid();
    return name.trim();
  }

  /** Um membro novo do aluno da demo, com a chave que só o app guarda. */
  const newMember = (name: string, host: boolean): Member => ({
    id: nextId('demo-key-'),
    ref: nextId('ref-'),
    name: checkName(name),
    host,
    student: true,
  });

  function open(request: OpenCallRequest, now: number): JoinedCall {
    const { kind, at, spot, destination, capacity } = request;
    if (!SPOTS_BY_KIND[kind]?.includes(spot)) throw invalid();
    if (kind === 'home' && !destination) throw invalid();
    if (kind === 'lunch' && destination) throw invalid();
    const limits = CAPACITY[kind];
    if (
      !Number.isInteger(capacity) ||
      capacity < limits.min ||
      capacity > limits.max
    )
      throw invalid();
    if (!Number.isFinite(at) || at < now - LATE_MS || at > now + LEAD_MS)
      throw invalid();
    const note = request.note.replace(/\s+/g, ' ').trim();
    if (note.length > NOTE_MAX) throw invalid();
    if (hasContact(note)) throw new CompanionError('contact');
    const host = newMember(request.name, true);
    // uma chamada aberta por aluno: as anteriores acabam
    for (const other of calls.values())
      if (
        !other.endedAt &&
        find(other.id, now) &&
        other.members.some(item => item.host && item.student)
      )
        other.endedAt = now;
    const call = plan({ ...request, note }, [host]);
    call.openedAt = now;
    calls.set(call.id, call);
    return { call: memberView(call, host.id), memberKey: host.id };
  }

  function join(callId: string, name: string, now: number): JoinedCall {
    const member = newMember(name, false);
    const call = find(callId, now);
    if (!call) throw new CompanionError('gone');
    if (call.removed.includes(REMOVED_STUDENT))
      throw new CompanionError('removed');
    if (call.members.some(item => item.student))
      throw new CompanionError('already_member');
    if (!isListed(call, now)) throw new CompanionError('closed');
    if (call.members.length >= call.capacity) throw new CompanionError('full');
    call.members.push(member);
    return { call: memberView(call, member.id), memberKey: member.id };
  }

  function report(
    callId: string,
    reason: ReportReason,
    memberKey: string | null,
    now: number,
  ) {
    let reporter: string;
    let fromMember = false;
    if (memberKey) {
      const { member } = membership(callId, memberKey, now);
      reporter = member.id;
      fromMember = !member.host;
    } else {
      if (!find(callId, now)) throw new CompanionError('gone');
      reporter = OUTSIDER;
    }
    const call = calls.get(callId)!;
    // a mesma pessoa já tinha denunciado: nada muda
    if (call.reporters.includes(reporter)) return;
    call.reporters.push(reporter);
    if (call.hiddenAt || !fromMember) return;
    const host = call.members.find(item => item.host)?.id;
    const fromMembers = call.reporters.filter(
      item => item !== OUTSIDER && item !== host,
    );
    if (reason === 'harassment' || fromMembers.length >= MEMBER_REPORTS_TO_HIDE)
      call.hiddenAt = now;
  }

  /**
   * Um minuto depois de abrir (ou de a chamada aparecer na lista, se foi
   * aberta com mais de uma hora de antecedência), alguém inventado entra e
   * diz que está indo.
   */
  function crowd(now: number) {
    for (const call of calls.values()) {
      if (call.openedAt === null || call.joinedByCrowd) continue;
      const at = Math.max(
        call.openedAt + DEMO_JOIN_AFTER_MINUTES * MINUTE,
        call.visibleFrom,
      );
      if (now < at) continue;
      call.joinedByCrowd = true;
      if (!isListed(call, at) || call.members.length >= call.capacity) continue;
      const name = DEMO_JOINERS[call.kind];
      const id = `seed:${name}:${call.id}`;
      call.members.push({
        id,
        ref: nextId('ref-'),
        name,
        host: false,
        student: false,
      });
      call.feed = [
        ...call.feed,
        { member: id, name, phrase: 'on_my_way' as const, at },
      ].slice(-FEED_KEEP);
    }
  }

  /** Faz o pedido depois da espera da resposta, com o relógio de então. */
  const act = <T>(run: (now: number) => T, signal?: AbortSignal) =>
    clock.respond(() => {
      const now = clock.now();
      refill(now);
      crowd(now);
      return run(now);
    }, signal);

  refill(clock.now());

  return {
    pass: () =>
      act(now => {
        const pass = nextId('demo-pass-');
        const expiresAt = now + PASS_MS;
        passes.set(pass, expiresAt);
        return { pass, expiresAt };
      }),

    list: (pass, options) =>
      act((now): CallList => {
        const expiresAt = passes.get(pass);
        if (expiresAt === undefined || now >= expiresAt)
          throw new CompanionError('pass_expired');
        const listed = [...calls.values()]
          .filter(call => isListed(call, now))
          .sort((a, b) => a.at - b.at);
        return {
          calls: listed.map(publicView),
          // quem pergunta entra na conta
          watching: DEMO_WATCHING_OTHERS + 1,
        };
      }, options?.signal),

    open: request => act(now => open(request, now)),

    join: (callId, name) => act(now => join(callId, name, now)),

    read: (callId, memberKey, options) =>
      act(now => {
        const { call, member } = membership(callId, memberKey, now);
        return memberView(call, member.id);
      }, options?.signal),

    leave: (callId, memberKey) =>
      act(now => {
        const { call, member } = membership(callId, memberKey, now);
        // quem chamou e sai encerra para todos
        if (member.host) call.endedAt ??= now;
        else call.members = call.members.filter(item => item !== member);
      }),

    say: (callId, memberKey, phrase) =>
      act(now => {
        const { call, member } = membership(callId, memberKey, now);
        if (!PHRASES_BY_KIND[call.kind].includes(phrase)) throw invalid();
        if (call.endedAt) throw new CompanionError('ended');
        call.feed = [
          ...call.feed,
          { member: member.id, name: member.name, phrase, at: now },
        ].slice(-FEED_KEEP);
        return memberView(call, member.id);
      }),

    remove: (callId, memberKey, ref) =>
      act(now => {
        const { call, member } = membership(callId, memberKey, now);
        if (!member.host) throw new CompanionError('not_host');
        const target = call.members.find(item => item.ref === ref);
        if (!target) throw new CompanionError('member_gone');
        if (target.host) throw new CompanionError('not_host');
        call.members = call.members.filter(item => item !== target);
        call.removed.push(target.id);
        if (target.student) call.removed.push(REMOVED_STUDENT);
        return memberView(call, member.id);
      }),

    report: (callId, reason, memberKey) =>
      act(now => report(callId, reason, memberKey, now)),
  };
}
