import type { PushDevice } from '../../shared/push.ts';

/*
 * Os avisos do portal no iPhone, que não testa o portal a cada 15 minutos
 * nem faz a verificação na hora certa como o Android. Duas ajudas do
 * servidor, que já testa o portal sozinho e nunca tem a senha do aluno:
 *
 * - "Avisar quando voltar": com o portal fora, o aluno pede, e o servidor
 *   manda o aviso com alerta quando o vê de volta;
 * - o "cutucão": um push silencioso a cada 4 horas acorda o app para a
 *   verificação no portal que o iOS adia (quem entra no portal é o celular).
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** O pedido de "Avisar quando voltar" vale 3 dias (o REQUEST_MAX_AGE do app). */
export const RETURN_ALERT_TTL_MS = 3 * DAY;
/** O aviso do portal de volta que não chegou em 6 horas já não serve. */
export const RETURN_ALERT_EXPIRY_MS = 6 * HOUR;
/** O aparelho do cutucão vale 7 dias; o app registra de novo a cada abertura. */
export const PORTAL_PUSH_TTL_MS = 7 * DAY;
/** Um aparelho é cutucado no máximo a cada 4 horas (o intervalo da verificação). */
export const PORTAL_WAKE_INTERVAL_MS = 4 * HOUR;
/** O cutucão que não chegou em 1 hora já não serve. */
export const PORTAL_WAKE_EXPIRY_MS = HOUR;
/** Das 22h às 7h, nada: a verificação do celular também não roda. */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

const SAO_PAULO_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Das 22h às 7h de São Paulo. */
export function isQuietTime(now: Date): boolean {
  const hour = Number(SAO_PAULO_HOUR.format(now)) % 24;
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** O pedido de "Avisar quando voltar" de um aluno (um por aluno). */
export type ReturnAlert = {
  student: string;
  device: PushDevice;
  /** Só o teste do portal depois disso avisa. */
  requestedAt: Date;
  /** O índice TTL apaga aqui. */
  expiresAt: Date;
};

/** O iPhone do aluno para o cutucão da verificação no portal. */
export type PortalPushDevice = {
  student: string;
  device: PushDevice;
  updatedAt: Date;
  /** O índice TTL apaga aqui (o registro da próxima abertura empurra). */
  expiresAt: Date;
  /** O último cutucão (`null`: nunca). */
  wokenAt: Date | null;
};

/**
 * O aviso do portal de volta, nas palavras do app (`portalBackMessage`, em
 * src/modules/notifications/domain/messages.ts): o mesmo que o Android mostra.
 */
export const PORTAL_BACK_TEXT = {
  title: 'O Aluno Online voltou',
  body: 'Toque para atualizar seus dados no AO UERJ.',
} as const;
