import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/*
 * O aluno identificado: a matrícula com que ele entrou no Aluno Online, o nome
 * que o portal mostra e os aparelhos de onde veio. O app manda os dois depois
 * do login, e a Play Integrity atesta que o pedido saiu do app genuíno, num
 * aparelho íntegro, com aquela matrícula (o `requestHash` cobre os campos).
 * No banco, matrícula e nome ficam cifrados; a busca pela matrícula usa um
 * HMAC, nunca o texto.
 */

/** A matrícula da UERJ: só dígitos (o app a lê do login). */
export const MATRICULA = /^\d{6,15}$/;

export const STUDENT_LIMITS = {
  /** O nome como o portal mostra, em maiúsculas (o mesmo teto do mural). */
  name: 200,
  /** O motivo do banimento, para a moderação e para o aluno. */
  banReason: 200,
  /** Os aparelhos lembrados por aluno (os mais recentes). */
  devices: 10,
} as const;

/** Quanto uma sessão vale sem uso; cada uso empurra o prazo. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Quanto uma sessão fica sem gravar o uso de novo (o banco não muda a cada pedido). */
export const SESSION_TOUCH_MS = 60 * 60 * 1000;

/** Quanto o desafio de entrada vale: o app pede a atestação logo depois. */
export const STUDENT_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const SESSION_TOKEN_BYTES = 32;
export const STUDENT_INSTALLATION_BYTES = 32;

/** O banimento: até quando (ou para sempre), por quê e quando foi dado. */
export type Ban = { until: Date | null; reason: string; at: Date };

export const isBanned = (ban: Ban | null | undefined, now: Date) =>
  Boolean(ban && (ban.until === null || ban.until > now));

/** Um aparelho de onde o aluno entrou, pelo HMAC do id da instalação. */
export type StudentDevice = { id: string; firstSeenAt: Date; lastSeenAt: Date };

/** O aluno como fica no banco: matrícula e nome cifrados. */
export type StoredStudent = {
  id: string;
  /** HMAC da matrícula: acha o aluno sem guardar a matrícula em claro. */
  lookup: string;
  matricula: string;
  name: string;
  createdAt: Date;
  lastSeenAt: Date;
  devices: StudentDevice[];
  ban: Ban | null;
};

/** O aluno aberto, para a moderação. */
export type Student = Omit<StoredStudent, 'lookup' | 'matricula' | 'name'> & {
  matricula: string;
  name: string;
};

/** Uma sessão no banco: o hash do token, de quem e de qual aparelho. */
export type StoredSession = {
  id: string;
  student: string;
  device: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
};

/** As chaves tiradas de `STUDENT_DATA_KEY`, uma para cada uso. */
export type StudentKeys = {
  lookup: Buffer;
  seal: Buffer;
  challenge: Buffer;
  device: Buffer;
};

export function studentKeys(dataKey: Buffer): StudentKeys {
  const derive = (info: string) =>
    Buffer.from(hkdfSync('sha256', dataKey, Buffer.alloc(0), info, 32));
  return {
    lookup: derive('ao-uerj student lookup v1'),
    seal: derive('ao-uerj student data v1'),
    challenge: derive('ao-uerj student challenge v1'),
    device: derive('ao-uerj student device v1'),
  };
}

const hmacHex = (key: Buffer, data: string | Buffer) =>
  createHmac('sha256', key).update(data).digest('hex');

export const matriculaLookup = (keys: StudentKeys, matricula: string) =>
  hmacHex(keys.lookup, matricula);

/** O aparelho como fica guardado: 32 caracteres do HMAC da instalação. */
export const deviceId = (keys: StudentKeys, installation: Buffer) =>
  hmacHex(keys.device, installation).slice(0, 32);

/** O token da sessão como fica guardado: o SHA-256, em hex. */
export const sessionId = (token: Buffer) =>
  createHash('sha256')
    .update('ao-uerj student session v1')
    .update(token)
    .digest('hex');

export const newSessionToken = () => randomBytes(SESSION_TOKEN_BYTES);
export const newStudentId = () => randomBytes(12).toString('base64url');

const SEAL_PREFIX = 'v1.';

/**
 * Cifra um campo (AES-256-GCM). O nome do campo entra como dado associado:
 * a matrícula cifrada não abre como nome.
 */
export function seal(keys: StudentKeys, field: string, value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.seal, iv);
  cipher.setAAD(Buffer.from(field));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${SEAL_PREFIX}${Buffer.concat([iv, data, cipher.getAuthTag()]).toString('base64url')}`;
}

/** Abre o campo; `null` se não for nosso ou se foi mexido. */
export function open(
  keys: StudentKeys,
  field: string,
  sealed: string,
): string | null {
  if (!sealed.startsWith(SEAL_PREFIX)) return null;
  const bytes = Buffer.from(sealed.slice(SEAL_PREFIX.length), 'base64url');
  if (bytes.length < 12 + 16) return null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keys.seal,
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(field));
    decipher.setAuthTag(bytes.subarray(bytes.length - 16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, bytes.length - 16)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

const SESSION_LABEL = Buffer.from('AO UERJ student session v1', 'ascii');

/** Um campo de texto com o tamanho na frente (u16): a concatenação não é ambígua. */
function prefixed(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

/**
 * O `requestHash` que o app passa à Play Integrity para entrar: o SHA-256, em
 * hex minúsculo, do rótulo, do desafio, da instalação, da matrícula e do nome.
 * A atestação passa a valer só para esta matrícula, neste aparelho, agora.
 */
export function studentSessionRequestHash({
  challenge,
  installation,
  matricula,
  name,
}: {
  challenge: Buffer;
  installation: Buffer;
  matricula: string;
  name: string;
}): string {
  return createHash('sha256')
    .update(
      Buffer.concat([
        SESSION_LABEL,
        challenge,
        installation,
        prefixed(matricula),
        prefixed(name),
      ]),
    )
    .digest('hex');
}

/** O nome como o portal mostra: espaços juntos e sem as pontas. */
export const normalizeName = (name: string) =>
  name.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Os prazos que a moderação escolhe; `null` é para sempre. */
export const BAN_DAYS = [1, 7, 30, null] as const;
export type BanDays = (typeof BAN_DAYS)[number];
