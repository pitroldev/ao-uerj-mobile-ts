import type {
  CommunitySummary,
  NoticeAction,
  NoticeAnswer,
  NoticeList,
  NoticeRequest,
  NoticeResult,
  YouSummary,
} from '../domain/campusNow';

export type RequestOptions = { signal?: AbortSignal };

/**
 * O servidor (pitrol.dev/aouerj/v2/campus-now). Todo pedido leva a sessão de
 * aluno. As recusas vêm como `CampusNowError`; rede e servidor fora, como
 * `AppError`.
 */
export interface CampusNowServerPort {
  list(options?: RequestOptions): Promise<NoticeList>;
  report(request: NoticeRequest): Promise<NoticeResult>;
  answer(id: string, answer: NoticeAnswer): Promise<NoticeAction>;
  thank(id: string): Promise<NoticeAction>;
  flag(id: string): Promise<void>;
  seen(ids: readonly string[]): Promise<void>;
  you(options?: RequestOptions): Promise<YouSummary>;
  /** `month` AAAA-MM: o de agora ou o anterior. */
  community(month: string, options?: RequestOptions): Promise<CommunitySummary>;
}

/** Um aviso do celular, no formato dos outros avisos do app. */
export type CampusNotification = {
  id: string;
  channel: 'campus';
  title: string;
  body: string;
  publicTitle: string;
  publicBody: string;
  target: 'campus';
};

/** As preferências da conta (o logout apaga). */
export interface CampusNowStorePort {
  read<T>(scope: string, key: string): Promise<T | null>;
  write<T>(scope: string, key: string, value: T): Promise<void>;
}
