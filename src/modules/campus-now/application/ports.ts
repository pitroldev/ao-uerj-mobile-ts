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

/**
 * O iPhone registrado para o Agora no campus em segundo plano
 * (pitrol.dev/aouerj/v2/campus-now/push), com a sessão de aluno: o iOS não
 * acorda o app a cada 15 minutos, então o servidor manda push. Os avisos do
 * próprio aviso (confirmado, quantos agradeceram, o nível novo) chegam
 * prontos; o "ainda está lá?" chega como um push silencioso, e o celular
 * confere com a grade se é do caminho. Recusas e falhas, como `AppError`.
 */
export interface CampusPushServerPort {
  /** `available`: o servidor manda push; `registered`: este aluno está registrado. */
  status(): Promise<{ available: boolean; registered: boolean }>;
  /** Registra (ou renova) o token de push do aparelho. */
  register(token: string): Promise<void>;
  unregister(): Promise<void>;
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
