/**
 * O contrato da API (`/aouerj` e `/schedules`): o que o app manda e o que
 * recebe. Só tipos, sem import nenhum, para que o app (React Native) e o
 * servidor (Node) usem o mesmo arquivo. Os nomes dos campos são os dos
 * servidores antigos, que os apps já publicados ainda mandam.
 */

/** Erro de qualquer rota. */
export type ApiError = { error: string; message: string };

/** `GET /portal-status`: o Aluno Online visto daqui, sem dado de aluno. */
export type PortalState = 'up' | 'down' | 'unknown';
export type PortalStatusResponse = {
  state: PortalState;
  /** Desde quando está nesse estado (ISO). */
  since: string | null;
  /** A última consulta ao portal (ISO). */
  checkedAt: string | null;
};

/** `GET /health`: o processo e o banco. */
export type HealthResponse = {
  online: true;
  database: string;
  timestamp: string;
};

/**
 * `GET /status`: a versão no ar e como estão as partes, para consultar (e
 * para a implantação conferir o commit). Sem dado de aluno. Responde 503
 * enquanto o banco não está conectado.
 */
export type StatusResponse = {
  status: 'ok' | 'degraded';
  release: {
    /** O commit implantado (`null` fora da implantação automática). */
    commit: string | null;
    /** A cor da implantação azul/verde. */
    color: 'blue' | 'green' | null;
    startedAt: string;
    uptimeSeconds: number;
  };
  database: string;
  portal: PortalStatusResponse;
  generator: { running: number; queued: number };
  timestamp: string;
};

/** `POST /messages/get`: a conversa de uma turma num período. */
export type MessageThreadRequest = {
  /** Código da disciplina. */
  disciplina: string;
  /** "2026.1". */
  periodo: string;
  turma: string;
};

/** `POST /messages/post`. */
export type PostMessageRequest = MessageThreadRequest & {
  fullName: string;
  message: string;
};

/** Uma mensagem do mural, como o banco a devolve. */
export type MuralMessage = PostMessageRequest & {
  _id: string;
  createdAt: string;
  updatedAt: string;
};

/** `GET /docentes`: os nomes, em ordem alfabética. */
export type TeacherListResponse = { docentes: string[] };

/** Uma turma de um docente, como o banco a guarda. */
export type TeacherClass = { turma: string | number; local?: string | null };

/** Um docente da busca, com as disciplinas e turmas que o banco guarda. */
export type Teacher = {
  _id: string;
  docente: string;
  /** Por código de disciplina: o nome e as turmas. */
  disciplinas?: Record<string, { disciplina: string; turmas: TeacherClass[] }>;
  createdAt?: string;
  updatedAt?: string;
};

/** `GET /docentes/:name`: até 50 docentes cujo nome contém o texto. */
export type TeacherSearchResponse = { docentes: Teacher[] };

/**
 * `POST /reportError`. `html` guarda anexos em arquivo no servidor: desde a
 * 2.0 o app manda só um JSON de diagnóstico, nunca a página do portal.
 */
export type ErrorReportRequest = {
  page: string;
  description?: string;
  email?: string;
  html?: string[];
};

/** `POST /suggestions` (apps antigos; o atual não manda). */
export type SuggestionRequest = {
  name: string;
  content: string;
  email?: string;
};

/** A resposta das gravações sem corpo próprio (relato e sugestão). */
export type OkResponse = { status: 'ok' };

/** Um relato na listagem de administração (`GET /reportError`). */
export type ErrorReportRecord = {
  _id: string;
  page: string;
  description?: string;
  email?: string;
  filesID: string[];
  createdAt: string;
  updatedAt: string;
};

export type ErrorReportListResponse = { reports: ErrorReportRecord[] };

/** Uma sugestão na listagem de administração (`GET /suggestions`). */
export type SuggestionRecord = {
  _id: string;
  name: string;
  content: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
};

/** Um horário na semana: dia de 0 a 6 e minutos desde a meia-noite (fim exclusivo). */
export type ScheduleInterval = {
  week_day: number;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};

/** O que o aluno quer primeiro; a grade com mais disciplinas vem sempre antes. */
export type SchedulePriority =
  | 'MOST_SUBJECTS_POSSIBLE'
  | 'MAX_CREDITS'
  | 'MAX_WORKLOAD'
  | 'MIN_WORKLOAD'
  | 'MAX_DAY_WORKLOAD'
  | 'MIN_DAY_WORKLOAD'
  | 'LIVES_FAR_AWAY'
  | 'MIN_GAPS'
  | 'MANDATORY_CLASSES'
  | 'CRITICAL_FIRST'
  | 'MOST_BLOCKED_FIRST';

/** Uma disciplina do pedido ao gerador. */
export type GeneratorSubject = {
  id: string;
  name: string;
  /** "MANDATORY" conta para `MANDATORY_CLASSES`. */
  type: string;
  credits: number;
  /** A carga horária no período, em horas. */
  total_workload: number;
  prerequisites: string[];
  /** O portal deixa cursá-la em choque de horário. */
  allow_conflict: boolean;
  recomended_period?: number;
  minimum_credits?: number;
  /** Sem estes dois, `CRITICAL_FIRST` e `MOST_BLOCKED_FIRST` não mudam a ordem. */
  criticality?: number;
  blocks?: number;
};

/** Uma turma do pedido ao gerador. */
export type GeneratorClass = {
  /** O número da turma. */
  id: string;
  name: string;
  /** "PREFERRED" ou "REGULAR". */
  type: string;
  teachers: string[];
  vacancies_amount: number;
  subject_id: string;
  schedules: ScheduleInterval[];
  selected_by_user?: boolean;
};

/** `POST /schedules/generate`. */
export type GenerateSchedulesRequest = {
  preferences: {
    min_subject_amount: number;
    max_subject_amount: number;
    priority: SchedulePriority[];
    /** Horários em que o aluno não pode. */
    busy_schedules?: ScheduleInterval[];
  };
  classes: GeneratorClass[];
  subjects: GeneratorSubject[];
};

/** Uma turma da grade: a do pedido, com a disciplina junto. */
export type GeneratedClass = GeneratorClass & { subject: GeneratorSubject };

/** Uma grade gerada. */
export type GeneratedScheduleResponse = {
  /** Disciplinas e horários; duas turmas no mesmo horário dão a mesma grade. */
  hash: string;
  /** Na ordem das turmas do pedido. */
  schedule: GeneratedClass[];
  total_week_days: number;
  total_credits: number;
  total_workload: number;
  /** Do servidor antigo; sempre `false` (uma grade abaixo do mínimo não sai). */
  fails: { subject_amount: boolean };
  /** O tempo livre entre as aulas de cada dia, somado na semana. */
  total_gaps_in_minutes: number;
};

/** A resposta de `POST /schedules/generate`: as até 5 melhores, em ordem. */
export type GenerateSchedulesResponse = {
  data: GeneratedScheduleResponse[];
  /** `false` quando o tempo acabou antes de ver todas as combinações. */
  exhaustive: boolean;
};

/** `GET /schedules/health`. */
export type GeneratorHealthResponse = {
  online: true;
  running: number;
  queued: number;
};

/*
 * API v2 (`/aouerj/v2`): as rotas de aluno exigem
 * `Authorization: PrivateToken token="…"` (Privacy Pass, RFC 9577). Sem token
 * válido: 401 `unauthenticated`, com o desafio em `WWW-Authenticate`; sem
 * chave no servidor: 503 `student_access_unavailable`; sem o banco: 503
 * `database_unavailable`.
 */

/** `GET /aouerj/v2/auth` com um token válido (que fica gasto). */
export type StudentAuthResponse = { authenticated: true };

/*
 * A emissão (`/aouerj/v2/tokens`), sem token. Os bytes vão em base64url com
 * o `=` do fim (a entrada aceita sem). Sem chave privada ou sem quem ateste:
 * 503 `token_issuance_unavailable`; a Play Integrity fora do ar: 503
 * `attestation_unavailable`.
 */

/**
 * `GET /aouerj/v2/tokens/challenge`: o desafio (36 bytes, uso único, até
 * `expiresAt`) e a chave com que o app cega os pedidos (o SPKI da RFC 9578).
 */
export type TokenChallengeResponse = {
  challenge: string;
  /** ISO 8601. */
  expiresAt: string;
  tokenKey: string;
};

/**
 * `POST /aouerj/v2/tokens`. O app passa à Play Integrity (pedido standard) o
 * `requestHash` = SHA-256, em hex minúsculo, de "AO UERJ token issuance v1"
 * (ASCII), do desafio, da instalação e dos pedidos, nessa ordem.
 */
export type TokenIssuanceRequest = {
  challenge: string;
  /** 32 bytes ao acaso, criados uma vez por instalação. */
  installation: string;
  /** O token da Play Integrity sobre o `requestHash`. */
  integrityToken: string;
  /** Os TokenRequest da RFC 9578 (259 bytes cada), até o tamanho do lote. */
  tokenRequests: string[];
};

/**
 * A resposta do lote: as assinaturas cegas (256 bytes cada), na ordem dos
 * pedidos. Recusas: 403 `invalid_challenge` (pedir outro desafio), 403
 * `attestation_failed`, 422 `invalid_token_request` (cegar com a `tokenKey`
 * do desafio) e 429 `issuance_limit_reached`, com `Retry-After`.
 */
export type TokenIssuanceResponse = {
  tokenKey: string;
  tokenResponses: string[];
};
