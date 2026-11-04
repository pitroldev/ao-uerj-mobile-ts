import { ascii, concat, toHex, u16, utf8 } from './bytes';

/*
 * A identificação do aluno no servidor (pitrol.dev/aouerj/v2/students): o app
 * manda a matrícula e o nome do login no Aluno Online, com a Play Integrity
 * sobre esses campos, e recebe uma sessão que vai em cada pedido. O hash do
 * pedido é o mesmo do servidor (server/src/modules/students/domain.ts).
 */

/** Os bytes que o hash do pedido usa (o SHA-256 da plataforma). */
export type SessionCrypto = {
  sha256(data: Uint8Array): Uint8Array;
  randomBytes(length: number): Uint8Array;
};

/** O id da instalação: 32 bytes ao acaso, criados uma vez por aparelho. */
export const INSTALLATION_BYTES = 32;

const LABEL = ascii('AO UERJ student session v1');

/** Um campo de texto com o tamanho (u16) na frente. */
const field = (text: string) => {
  const bytes = utf8(text);
  return concat(u16(bytes.length), bytes);
};

/** O nome como o portal mostra, sem espaços sobrando (o servidor também limpa). */
export const normalizeName = (name: string) =>
  name.normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * O `requestHash` da Play Integrity para entrar: o SHA-256, em hex, do
 * rótulo, do desafio, da instalação, da matrícula e do nome. A atestação vale
 * só para esta matrícula, neste aparelho, agora.
 */
export function sessionRequestHash(
  crypto: SessionCrypto,
  {
    challenge,
    installation,
    matricula,
    name,
  }: {
    challenge: Uint8Array;
    installation: Uint8Array;
    matricula: string;
    name: string;
  },
): string {
  return toHex(
    crypto.sha256(
      concat(LABEL, challenge, installation, field(matricula), field(name)),
    ),
  );
}

/** O banimento que o servidor mandou: até quando (`null`, para sempre) e por quê. */
export type StudentBan = { until: number | null; reason: string };

const pad = (value: number) => String(value).padStart(2, '0');

/** "Sua conta está suspensa até 10/12 por: Assédio." */
export function banMessage(ban: StudentBan): string {
  const when =
    ban.until === null
      ? 'por tempo indeterminado'
      : (() => {
          const date = new Date(ban.until);
          return `até ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
        })();
  const reason = ban.reason ? ` Motivo: ${ban.reason}.` : '';
  return `Sua conta está suspensa no AO UERJ ${when} por uma denúncia.${reason} Mural, docentes, Companhia e gerador de grades voltam quando a suspensão acabar.`;
}
