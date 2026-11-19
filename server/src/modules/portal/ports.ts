import type { PushDevice } from '../../shared/push.ts';
import type { StudentActor } from '../students/ports.ts';
import type { PortalStatus } from './domain.ts';
import type { PortalPushDevice, ReturnAlert } from './push.ts';

/** Porta de entrada: a situação do portal e a consulta que a atualiza. */
export interface PortalWatch {
  /** Consulta o portal agora; consultas simultâneas dividem uma só. */
  check(): Promise<PortalStatus>;
  /** A situação da última consulta, sem consultar. */
  snapshot(): PortalStatus;
}

/**
 * Porta de saída: consulta a página inicial do portal (sem conta) e devolve
 * o status HTTP; sem resposta no tempo, rejeita.
 */
export type PortalProbe = (timeoutMs: number) => Promise<number>;

/**
 * Porta de entrada: os avisos do portal no iPhone, o "Avisar quando voltar"
 * por push e o cutucão da verificação. Tudo com a sessão de aluno.
 */
export interface PortalAlerts {
  /**
   * `available`: o servidor manda push e testa o portal sozinho (sem o
   * monitor, não sabe quando ele volta). `requested`: o aluno pediu.
   */
  returnAlertStatus(
    actor: StudentActor,
  ): Promise<{ available: boolean; requested: boolean }>;
  /** Pede (ou troca) o aviso; 503 `push_unavailable` sem `available`. */
  requestReturnAlert(device: PushDevice, actor: StudentActor): Promise<void>;
  cancelReturnAlert(actor: StudentActor): Promise<void>;
  /** `available`: o servidor manda push (a chave do APNs configurada). */
  pushStatus(
    actor: StudentActor,
  ): Promise<{ available: boolean; registered: boolean }>;
  /** Registra (ou troca) o iPhone do cutucão; 503 `push_unavailable` sem o APNs. */
  registerPush(device: PushDevice, actor: StudentActor): Promise<void>;
  unregisterPush(actor: StudentActor): Promise<void>;
  /**
   * Depois de cada teste do portal: no ar, os pedidos feitos antes do teste
   * recebem o aviso (das 22h às 7h, esperam). Devolve quantos saíram.
   */
  portalChecked(status: PortalStatus): Promise<number>;
  /** A rodada (a cada minuto): o cutucão de quem não recebe há 4 horas. */
  wakeDevices(): Promise<number>;
  /** O aluno foi banido: os dois registros dele saem. */
  dropStudent(studentId: string): Promise<void>;
}

/** Porta de saída: os pedidos de "Avisar quando voltar", um por aluno. */
export interface ReturnAlertRepository {
  /** O que vale em `now`; `null` sem ele. */
  find(student: string, now: Date): Promise<ReturnAlert | null>;
  /**
   * Grava (ou troca) o pedido do aluno. O mesmo token de outro aluno (a
   * troca de conta no aparelho) sai: um dono por token.
   */
  put(alert: ReturnAlert): Promise<void>;
  remove(student: string): Promise<void>;
  /** Os que valem em `now`, pedidos antes de `before`. */
  listRequestedBefore(now: Date, before: Date): Promise<ReturnAlert[]>;
  /**
   * Apaga o pedido se ainda for o mesmo (o `requestedAt`) e diz se apagou:
   * dois envios juntos (as duas cores do azul/verde) não avisam duas vezes.
   */
  claim(alert: ReturnAlert): Promise<boolean>;
  /** Devolve o pedido cujo aviso não chegou, se o aluno não pediu outro. */
  restore(alert: ReturnAlert): Promise<void>;
}

/** Porta de saída: o iPhone de cada aluno, para o cutucão da verificação. */
export interface PortalPushDeviceRepository {
  /** O que vale em `now`; `null` sem ele. */
  find(student: string, now: Date): Promise<PortalPushDevice | null>;
  /**
   * Grava (ou troca) o aparelho do aluno, sem mexer no último cutucão. O
   * mesmo token de outro aluno sai: um dono por token.
   */
  put(entry: Omit<PortalPushDevice, 'wokenAt'>): Promise<void>;
  remove(student: string): Promise<void>;
  /** Tira o aparelho que a Apple recusou de vez, se ainda for o mesmo token. */
  forget(student: string, token: string): Promise<void>;
  /** Os que valem em `now` e não foram cutucados desde `since`. */
  listWakeable(now: Date, since: Date): Promise<PortalPushDevice[]>;
  /** Marca o cutucão de agora, se ninguém cutucou desde `since`. */
  claimWake(student: string, now: Date, since: Date): Promise<boolean>;
}
