import {
  issuanceChallenge,
  openIssuanceChallenge,
  usedChallengeId,
} from '../access/domain.ts';
import type {
  AppAttester,
  AppAttestVerifier,
  Attestation,
  SingleUse,
} from '../access/ports.ts';
import { systemClock, type Clock } from '../../shared/clock.ts';
import { InvalidInputError } from '../../shared/errors.ts';
import {
  deviceId,
  isBanned,
  MATRICULA,
  matriculaLookup,
  newSessionToken,
  newStudentId,
  normalizeName,
  open,
  seal,
  SESSION_TOKEN_BYTES,
  SESSION_TOUCH_MS,
  SESSION_TTL_MS,
  sessionId,
  STUDENT_CHALLENGE_TTL_MS,
  STUDENT_INSTALLATION_BYTES,
  STUDENT_LIMITS,
  studentKeys,
  studentSessionRequestHash,
  type Ban,
  type StoredStudent,
  type Student,
} from './domain.ts';
import type {
  Authentication,
  EnrollmentAttestation,
  StudentIdentity,
  StudentRepository,
  StudentSessionRepository,
} from './ports.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Quanto a resposta do `authenticate` vale na memória, nunca além do fim da
 * sessão (nem do banimento). Banir, desbanir e sair valem na hora neste
 * processo (o `forget` e o `endSession`); num outro (a troca azul/verde),
 * nesse prazo. Com muitos alunos, quase todo pedido acaba aqui, sem banco.
 */
export const AUTH_CACHE_MS = 5 * 60 * 1000;
/** Sessões guardadas ao mesmo tempo (cada uma, uns 200 bytes). */
export const AUTH_CACHE_MAX = 20000;

/** O desafio dos alunos guarda o uso com outro prefixo que o da emissão. */
const usedId = (challenge: Buffer) => `student:${usedChallengeId(challenge)}`;

/**
 * A identificação do aluno. O app manda a matrícula e o nome do login no
 * Aluno Online, com a atestação sobre esses campos (a Play Integrity no
 * Android, o App Attest no iPhone); a partir daí, cada pedido leva a sessão.
 * A moderação abre matrícula e nome para banir.
 */
export function createStudentIdentity({
  students,
  sessions,
  usedChallenges,
  attester,
  appAttest = null,
  dataKey,
  onBan = async () => undefined,
  now = systemClock,
}: {
  students: StudentRepository;
  sessions: StudentSessionRepository;
  usedChallenges: SingleUse;
  /** A Play Integrity; `null`: o Android não entra. */
  attester: AppAttester | null;
  /** O App Attest; `null` (sem o App ID da Apple): o iPhone não entra. */
  appAttest?: AppAttestVerifier | null;
  /** `STUDENT_DATA_KEY`; `null` desliga a identificação (503). */
  dataKey: Buffer | null;
  /** O que mais acontece no banimento (a Companhia tira o aluno das mesas). */
  onBan?: (studentId: string) => Promise<void>;
  now?: Clock;
}): StudentIdentity {
  const keys = dataKey ? studentKeys(dataKey) : null;
  const at = () => new Date(now());

  // o resultado do `authenticate` por pouco tempo: a maior parte dos pedidos
  // nem chega ao banco. Só o de sessões de verdade (válidas ou de banido):
  // um token inventado não ocupa lugar nem empurra os outros para fora
  const cache = new Map<
    string,
    { result: Authentication; student: string; until: number }
  >();
  const remember = (
    id: string,
    result: Authentication,
    student: string,
    sessionEnds: Date,
  ) => {
    cache.delete(id);
    // cheio, sai o mais antigo (o Map guarda a ordem de entrada)
    if (cache.size >= AUTH_CACHE_MAX) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    // nunca além do fim da sessão nem do fim do banimento
    let until = Math.min(now() + AUTH_CACHE_MS, sessionEnds.getTime());
    if (!result.ok && result.reason === 'banned' && result.ban.until)
      until = Math.min(until, result.ban.until.getTime());
    cache.set(id, { result, student, until });
  };
  // banir e desbanir valem na hora neste processo
  const forget = (studentId: string) => {
    for (const [id, entry] of cache)
      if (entry.student === studentId) cache.delete(id);
  };

  /**
   * Quem confere a atestação deste pedido, já com ela: a Play Integrity
   * recebe o hash em hex; o App Attest, os 32 bytes dele como
   * `clientDataHash`. `null` sem quem ateste aquele aparelho.
   */
  const attestationOf = (
    request: EnrollmentAttestation,
  ): ((requestHash: string) => Promise<Attestation>) | null => {
    if (request.appAttest !== undefined) {
      const { appAttest: attested } = request;
      return appAttest
        ? requestHash =>
            appAttest.verify(attested, Buffer.from(requestHash, 'hex'))
        : null;
    }
    const { integrityToken } = request;
    return attester
      ? requestHash => attester.verify(integrityToken, requestHash)
      : null;
  };

  const opened = (stored: StoredStudent): Student => {
    if (!keys) throw new Error('student identity is disabled');
    return {
      id: stored.id,
      matricula: open(keys, 'matricula', stored.matricula) ?? '?',
      name: open(keys, 'name', stored.name) ?? '?',
      createdAt: stored.createdAt,
      lastSeenAt: stored.lastSeenAt,
      devices: stored.devices,
      ban: stored.ban,
    };
  };

  return {
    challenge() {
      // o mesmo desafio serve aos dois aparelhos: basta um deles entrar
      if (!keys || (!attester && !appAttest)) return null;
      return issuanceChallenge(
        keys.challenge,
        new Date(now() + STUDENT_CHALLENGE_TTL_MS),
      );
    },

    async enroll(request) {
      const { challenge, installation, matricula, name } = request;
      if (
        (request.integrityToken === undefined) ===
        (request.appAttest === undefined)
      )
        throw new InvalidInputError(
          'send either integrityToken (Android) or appAttest (iPhone)',
        );
      const verify = attestationOf(request);
      if (!keys || !verify) return { ok: false, reason: 'unavailable' };
      if (installation.length !== STUDENT_INSTALLATION_BYTES)
        throw new InvalidInputError(
          `installation must have ${STUDENT_INSTALLATION_BYTES} bytes`,
        );
      if (!MATRICULA.test(matricula))
        throw new InvalidInputError(
          'matricula must be the digits of a UERJ matrícula',
        );
      const clean = normalizeName(name);
      if (!clean || clean.length > STUDENT_LIMITS.name)
        throw new InvalidInputError(
          `name must have 1 to ${STUDENT_LIMITS.name} characters`,
        );
      const time = at();
      const expiresAt = openIssuanceChallenge(keys.challenge, challenge, time);
      if (!expiresAt) return { ok: false, reason: 'invalid_challenge' };
      // o desafio vale uma vez, e é gasto antes de perguntar à atestação
      if (!(await usedChallenges.spend(usedId(challenge), expiresAt)))
        return { ok: false, reason: 'invalid_challenge' };

      const attestation = await verify(
        // o hash usa a matrícula e o nome como chegaram (o app já os manda
        // limpos, sem espaços nas pontas): é o que ele passou à atestação
        studentSessionRequestHash({ challenge, installation, matricula, name }),
      );
      if (!attestation.trusted)
        return {
          ok: false,
          reason: 'attestation_failed',
          detail: attestation.reason,
        };

      const lookup = matriculaLookup(keys, matricula);
      const device = deviceId(keys, installation);
      const sealedName = seal(keys, 'name', clean);
      let student = await students.findByLookup(lookup);
      if (!student)
        student = await students.create({
          id: newStudentId(),
          lookup,
          matricula: seal(keys, 'matricula', matricula),
          name: sealedName,
          createdAt: time,
          lastSeenAt: time,
          devices: [{ id: device, firstSeenAt: time, lastSeenAt: time }],
          ban: null,
        });
      const current =
        (await students.seen(student.id, {
          name: sealedName,
          device,
          now: time,
          keepDevices: STUDENT_LIMITS.devices,
        })) ?? student;
      if (isBanned(current.ban, time))
        return { ok: false, reason: 'banned', ban: current.ban as Ban };

      const token = newSessionToken();
      const sessionExpires = new Date(time.getTime() + SESSION_TTL_MS);
      await sessions.create({
        id: sessionId(token),
        student: current.id,
        device,
        createdAt: time,
        lastUsedAt: time,
        expiresAt: sessionExpires,
      });
      // a sessão nova já entra no cache: o primeiro pedido depois da entrada
      // conta pelo aluno, sem dividir o teto do IP
      remember(
        sessionId(token),
        { ok: true, studentId: current.id },
        current.id,
        sessionExpires,
      );
      return {
        ok: true,
        token,
        expiresAt: sessionExpires,
        studentId: current.id,
      };
    },

    async authenticate(token) {
      if (token.length !== SESSION_TOKEN_BYTES)
        return { ok: false, reason: 'invalid_session' };
      const id = sessionId(token);
      const cached = cache.get(id);
      if (cached && cached.until > now()) return cached.result;

      const time = at();
      const session = await sessions.find(id, time);
      if (!session) return { ok: false, reason: 'invalid_session' };
      const student = await students.findById(session.student);
      if (!student) return { ok: false, reason: 'invalid_session' };
      let result: Authentication;
      if (isBanned(student.ban, time))
        result = { ok: false, reason: 'banned', ban: student.ban as Ban };
      else result = { ok: true, studentId: student.id };
      // o uso empurra o prazo, uma vez por hora
      let sessionEnds = session.expiresAt;
      if (
        result.ok &&
        time.getTime() - session.lastUsedAt.getTime() >= SESSION_TOUCH_MS
      ) {
        sessionEnds = new Date(time.getTime() + SESSION_TTL_MS);
        await sessions.touch(id, time, sessionEnds);
      }
      remember(id, result, student.id, sessionEnds);
      return result;
    },

    peek(token) {
      if (token.length !== SESSION_TOKEN_BYTES) return null;
      const cached = cache.get(sessionId(token));
      if (!cached || cached.until <= now() || !cached.result.ok) return null;
      return { studentId: cached.result.studentId };
    },

    async endSession(token) {
      if (token.length !== SESSION_TOKEN_BYTES) return;
      const id = sessionId(token);
      cache.delete(id);
      await sessions.remove(id);
    },

    available: () => Boolean(keys),

    async find(id) {
      if (!keys) return null;
      const stored = await students.findById(id);
      return stored ? opened(stored) : null;
    },

    async findByMatricula(matricula) {
      if (!keys || !MATRICULA.test(matricula.trim())) return null;
      const stored = await students.findByLookup(
        matriculaLookup(keys, matricula.trim()),
      );
      return stored ? opened(stored) : null;
    },

    async describe(ids) {
      const found = new Map<string, Student>();
      const wanted = [...new Set(ids.filter(Boolean))];
      if (!keys || !wanted.length) return found;
      for (const stored of await students.findMany(wanted))
        found.set(stored.id, opened(stored));
      return found;
    },

    async recent(limit) {
      if (!keys) return [];
      return (await students.listRecent(limit)).map(opened);
    },

    async banned(limit) {
      if (!keys) return [];
      return (await students.listBanned(at(), limit)).map(opened);
    },

    async ban(id, days, reason) {
      if (!keys) return null;
      const clean = reason.replace(/\s+/g, ' ').trim();
      if (!clean || clean.length > STUDENT_LIMITS.banReason)
        throw new InvalidInputError(
          `reason must have 1 to ${STUDENT_LIMITS.banReason} characters`,
        );
      const time = at();
      const updated = await students.setBan(id, {
        until: days === null ? null : new Date(time.getTime() + days * DAY_MS),
        reason: clean,
        at: time,
      });
      forget(id);
      if (!updated) return null;
      await onBan(id);
      return opened(updated);
    },

    async unban(id) {
      if (!keys) return null;
      const updated = await students.setBan(id, null);
      forget(id);
      return updated ? opened(updated) : null;
    },
  };
}
