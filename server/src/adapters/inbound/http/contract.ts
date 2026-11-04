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

/*
 * A Companhia agora (`/aouerj/v2/companion`). O servidor não sabe quem é
 * ninguém: abrir, entrar e denunciar de fora gastam um token de aluno; a
 * lista pede o passe de aluno (`X-Student-Pass`, uma hora de leituras por
 * token); dentro da chamada, a chave de membro (`X-Member-Key`) que a
 * entrada devolveu, que vale só nela. Os horários vão em ISO 8601. Sair
 * (`POST …/calls/:id/leave`, com a chave) responde `OkResponse`; quem
 * chamou e sai encerra a chamada para todos.
 *
 * Quem chamou tira alguém com `POST …/calls/:id/members/:ref/remove` (com a
 * chave de quem chamou), que responde `CompanionCallResponse`; o `ref` é o
 * apelido que só os membros veem.
 *
 * Erros: 404 `call_not_found` (acabou, saiu do ar ou nunca existiu), 403
 * `not_a_member`, 403 `removed_from_call` (quem chamou tirou esta pessoa),
 * 403 `not_the_host`, 404 `member_not_found`, 409 `cannot_remove_host`, 409
 * `call_full`, `call_closed` ou `call_ended`, 422 `note_not_allowed`
 * (telefone, @ ou link no recado), 401 `invalid_pass` (passe vencido: pedir
 * outro), 429 `rate_limited` e 503 `companion_full` (o teto do campus).
 */

export type CompanionKind = 'lunch' | 'home';
export type CompanionSpot = 'ru' | 'lago' | 'concha' | 'portao-1' | 'portao-5';
export type CompanionDestination = 'metro' | 'trem' | 'onibus';
export type CompanionPhrase = 'on_my_way' | 'at_spot' | 'late' | 'home_safe';
export type CompanionReportReason = 'harassment' | 'strange' | 'spam' | 'other';

/** `POST /aouerj/v2/companion/pass`, com um token: o passe (36 bytes, base64url). */
export type StudentPassResponse = { pass: string; expiresAt: string };

/** Uma chamada como quem está fora a vê: o primeiro nome de quem chamou e quantos vão. */
export type CompanionCall = {
  id: string;
  kind: CompanionKind;
  at: string;
  spot: CompanionSpot;
  destination: CompanionDestination | null;
  note: string;
  host: string;
  going: number;
  capacity: number;
  /** Depois disso, ninguém mais entra. */
  listedUntil: string;
  /** Quando some de vez. */
  expiresAt: string;
};

/**
 * `GET /aouerj/v2/companion/calls`, com o passe. `watching`: quantos alunos
 * olharam a lista nos últimos 15 minutos, contando quem pergunta.
 */
export type CompanionCallListResponse = {
  calls: CompanionCall[];
  watching: number;
};

/** A chamada como quem está dentro a vê. */
export type CompanionMemberCall = CompanionCall & {
  endedAt: string | null;
  /** `ref`: o apelido do membro na chamada, para quem chamou tirá-lo. */
  members: { ref: string; name: string; host: boolean; you: boolean }[];
  feed: {
    name: string;
    phrase: CompanionPhrase;
    at: string;
    you: boolean;
  }[];
};

/** `POST /aouerj/v2/companion/calls`, com um token. */
export type OpenCompanionCallRequest = {
  kind: CompanionKind;
  at: string;
  spot: CompanionSpot;
  /** Só na volta (`home`). */
  destination?: CompanionDestination | null;
  note?: string;
  capacity: number;
  /** O primeiro nome, uma palavra só. */
  name: string;
};

/** `POST /aouerj/v2/companion/calls/:id/members`, com um token. */
export type JoinCompanionCallRequest = { name: string };

/**
 * A resposta de abrir e de entrar: a chamada e a chave de membro (32 bytes,
 * base64url), que o app guarda e manda em `X-Member-Key`.
 */
export type CompanionMembershipResponse = {
  call: CompanionMemberCall;
  memberKey: string;
};

/** `GET /aouerj/v2/companion/calls/:id`, com a chave de membro. */
export type CompanionCallResponse = { call: CompanionMemberCall };

/** `POST /aouerj/v2/companion/calls/:id/phrases`, com a chave de membro. */
export type CompanionPhraseRequest = { phrase: CompanionPhrase };

/**
 * `POST /aouerj/v2/companion/calls/:id/reports`: com a chave de membro (conta
 * uma vez por membro) ou, de fora, com um token. Responde `OkResponse`.
 * Assédio denunciado de dentro tira a chamada do ar na hora; outro motivo,
 * com duas pessoas de dentro. A denúncia de fora vai só para a moderação.
 */
export type CompanionReportRequest = { reason: CompanionReportReason };

/* ------------------------------------------- Agora no campus (v2, sessão) */

/*
 * Agora no campus (`/aouerj/v2/campus-now`), só com a sessão de aluno
 * (`Authorization: Student …`): avisos curtos dos alunos sobre o campus
 * (elevadores, fila do bandejão, luz e ar, internet, banheiros, acesso) que
 * somem sozinhos. Não há texto livre: o tipo, a situação e o lugar vêm de
 * listas fechadas. Os outros alunos não veem quem avisou; a moderação vê.
 * Os horários vão em ISO 8601.
 *
 * Um aviso nasce "novo" e passa a valer para todos (`confirmed`) com a
 * primeira confirmação de outro aluno ou, direto, se quem avisou tem nível 3
 * ou mais. Cada "Continua" empurra o fim; três "Acabou" encerram antes, e o
 * "Acabou" de quem avisou encerra na hora. Três denúncias ("Não é verdade")
 * tiram o aviso do ar. Um aviso igual a um que já vale (mesmo tipo,
 * situação e lugar) vira a confirmação dele; uma situação nova no mesmo
 * lugar (a fila que cresceu) encerra a anterior.
 *
 * Erros: 404 `notice_not_found` (acabou, saiu do ar ou nunca existiu), 403
 * `own_notice` (o próprio aviso não se confirma, agradece nem denuncia), 409
 * `already_answered` (o aluno já respondeu; de "Continua" ainda dá para ir a
 * "Acabou"), 422 `invalid_place` (o lugar não serve para a situação), 429
 * `notice_limit_reached` (o teto de avisos do dia por aluno), 429
 * `rate_limited` e 503 `campus_full` (avisos demais valendo ao mesmo tempo).
 */

export type CampusNoticeKind =
  'elevators' | 'ru' | 'power' | 'internet' | 'restroom' | 'access';

/**
 * A situação, que vale dentro do tipo: `elevators` short_queue, long_queue,
 * stopped; `ru` short_queue, long_queue, closed; `power` no_power, no_ac,
 * no_outlets; `internet` wifi_down, wifi_slow; `restroom` no_water, closed,
 * no_paper; `access` gate_closed, ramp_closed, room_locked.
 */
export type CampusNoticeStatus =
  | 'short_queue'
  | 'long_queue'
  | 'stopped'
  | 'closed'
  | 'no_power'
  | 'no_ac'
  | 'no_outlets'
  | 'wifi_down'
  | 'wifi_slow'
  | 'no_water'
  | 'no_paper'
  | 'gate_closed'
  | 'ramp_closed'
  | 'room_locked';

export type CampusBlock = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
/** `SE` (subsolo, só no F), `T` (térreo) ou o andar, de 1 a 12. */
export type CampusFloor = string;
/** Os portões do atlas do Mapa. */
export type CampusGate =
  | 'portao-metro'
  | 'portao-leste'
  | 'portao-sudeste'
  | 'portao-sfx'
  | 'portao-oeste'
  | 'portao-radial';

/**
 * Onde: o hall dos elevadores (no bloco C), o bandejão, um portão, um andar
 * de um bloco ou uma sala (o código, como na grade: "6019"). Cada situação
 * pede um tipo de lugar: `elevators` o hall; `ru` o bandejão; `power`,
 * `internet`, `restroom` e `ramp_closed` um andar; `gate_closed` um portão;
 * `room_locked` uma sala.
 */
export type CampusPlace =
  | { type: 'elevators' }
  | { type: 'ru' }
  | { type: 'gate'; gate: CampusGate }
  | { type: 'floor'; block: CampusBlock; floor: CampusFloor }
  | { type: 'room'; block: CampusBlock; floor: CampusFloor; room: string };

/** `active` na lista; os outros só nos avisos do próprio aluno. */
export type CampusNoticeState = 'active' | 'ended' | 'expired' | 'removed';

export type CampusNotice = {
  id: string;
  kind: CampusNoticeKind;
  status: CampusNoticeStatus;
  place: CampusPlace;
  createdAt: string;
  /** Quando some sozinho (cada "Continua" empurra). */
  expiresAt: string;
  state: CampusNoticeState;
  /** Quantos outros alunos disseram "Continua". */
  confirmations: number;
  /** Quantos disseram "Acabou" (três encerram). */
  ends: number;
  /** Vale para todos: alguém confirmou ou quem avisou tem nível 3 ou mais. */
  confirmed: boolean;
  /** O nível de quem avisou, quando é 3 ou mais (o selo); senão `null`. */
  level: number | null;
  /** De quem pergunta: o aviso é dele. */
  mine: boolean;
  /** De quem pergunta: o que respondeu. */
  answer: 'confirm' | 'end' | null;
  thanked: boolean;
  flagged: boolean;
  /** Só no aviso do próprio aluno: quantos viram e quantos agradeceram. */
  views: number | null;
  thanks: number | null;
};

/**
 * Os pontos de quem pergunta: o nível, a partir de quantos pontos ele vale e
 * a partir de quantos vem o próximo (`null` no último).
 */
export type CampusStanding = {
  points: number;
  level: number;
  levelAt: number;
  nextLevelAt: number | null;
};

/** O que uma ação rendeu: os pontos de agora e quantos ela deu. */
export type CampusEarned = CampusStanding & { earned: number };

/**
 * `GET /aouerj/v2/campus-now`: os avisos que valem agora (os novos também),
 * do mais novo ao mais antigo; quantos alunos avisaram ou responderam hoje
 * (dia de São Paulo); e os pontos de quem pergunta.
 */
export type CampusNowResponse = {
  notices: CampusNotice[];
  helpersToday: number;
  you: CampusStanding;
};

/** `POST /aouerj/v2/campus-now/notices`. */
export type CampusNoticeRequest = {
  kind: CampusNoticeKind;
  status: CampusNoticeStatus;
  place: CampusPlace;
};

/**
 * A resposta de avisar (201): o aviso e os pontos. `merged`: já havia um
 * igual valendo, e o pedido virou a confirmação dele (ou nada, se o aviso é
 * de quem pediu ou se ele já tinha respondido). `replaced`: o aviso do mesmo
 * lugar com outra situação, que este encerrou.
 */
export type CampusNoticeResultResponse = {
  notice: CampusNotice;
  merged: boolean;
  replaced: string | null;
  you: CampusEarned;
};

/**
 * `POST /aouerj/v2/campus-now/notices/:id/answer`: "Continua" (`confirm`) ou
 * "Acabou" (`end`). O `end` de quem avisou encerra o aviso na hora ("Já
 * resolveu"). Os pontos vêm só da primeira resposta de cada aviso.
 */
export type CampusAnswerRequest = { answer: 'confirm' | 'end' };

/** A resposta de responder e de agradecer. */
export type CampusNoticeResponse = { notice: CampusNotice; you: CampusEarned };

/*
 * `POST /aouerj/v2/campus-now/notices/:id/thanks` (o "Valeu", uma vez por
 * aluno, responde `CampusNoticeResponse`) e `…/flag` ("Não é verdade", uma
 * vez por aluno, responde `OkResponse`), sem corpo.
 */

/**
 * `POST /aouerj/v2/campus-now/seen`: os avisos que apareceram na tela de
 * quem pede (até 50), para "quantos viram". Conta uma vez por aluno e
 * aviso; os dele não contam. Responde `OkResponse`.
 */
export type CampusSeenRequest = { ids: string[] };

/**
 * `GET /aouerj/v2/campus-now/you`: os pontos, as contagens de sempre (para
 * as conquistas), a semana (de segunda até agora) e os avisos do aluno de
 * hoje, do mais novo ao mais antigo, em qualquer estado.
 */
export type CampusYouResponse = {
  you: CampusStanding;
  counts: {
    notices: number;
    answers: number;
    confirmedNotices: number;
    thanksReceived: number;
    viewsReceived: number;
  };
  week: { notices: number; views: number; thanks: number };
  today: CampusNotice[];
};

/** Um problema que se repete no mês: o tipo, a situação e a área. */
export type CampusProblem = {
  kind: CampusNoticeKind;
  status: CampusNoticeStatus;
  /** O bloco (andar e sala) ou o portão; `null` no hall e no bandejão. */
  block: CampusBlock | null;
  gate: CampusGate | null;
  /** Em quantos dias houve aviso confirmado. */
  days: number;
  notices: number;
  /** A média, em minutos, do aviso até o fim; `null` sem nenhum encerrado. */
  minutesToEnd: number | null;
  /** Até duas horas do dia (0 a 23) com mais avisos, da mais cheia. */
  peakHours: number[];
};

/**
 * `GET /aouerj/v2/campus-now/community?month=AAAA-MM` (o mês de agora ou o
 * anterior; sem `month`, o de agora): o campus somado, sem ninguém. A
 * semana é de segunda até agora; o mês conta só avisos confirmados e traz
 * os seis problemas que mais se repetem (por dias, depois por avisos).
 * `weekdays`: os dias de segunda a sexta do mês até hoje.
 */
export type CampusCommunityResponse = {
  week: {
    from: string;
    notices: number;
    answers: number;
    views: number;
    minutesToEnd: number | null;
  };
  month: {
    month: string;
    weekdays: number;
    notices: number;
    problems: CampusProblem[];
  };
};

/* --------------------------------------------- identificação do aluno (v2) */

/** `GET /aouerj/v2/students/challenge`: o desafio de entrada (uso único, 5 min). */
export type StudentChallengeResponse = {
  challenge: string;
  /** ISO 8601. */
  expiresAt: string;
};

/**
 * `POST /aouerj/v2/students/session`. O app passa à Play Integrity (pedido
 * standard) o `requestHash`: o SHA-256, em hex, de "AO UERJ student session
 * v1", do desafio, da instalação e, com o tamanho (u16) na frente de cada um,
 * da matrícula e do nome, em UTF-8. Bytes em base64url. O servidor tira os
 * espaços das pontas dos dois antes do hash: mande-os já assim.
 */
export type StudentSessionRequest = {
  challenge: string;
  installation: string;
  integrityToken: string;
  /** A matrícula do login no Aluno Online (só os dígitos). */
  matricula: string;
  /**
   * O nome como o Aluno Online mostra, em NFC e com os espaços de dentro
   * juntados num só (o servidor guarda assim).
   */
  name: string;
};

/**
 * A resposta da entrada (201): a sessão (32 bytes, base64url), que vale 30
 * dias sem uso e vai em `Authorization: Student <sessão>`.
 */
export type StudentSessionResponse = {
  session: string;
  expiresAt: string;
  student: { id: string };
};

/** O 403 de quem está banido, na entrada e em qualquer rota de aluno. */
export type StudentBannedError = ApiError & {
  error: 'student_banned';
  /** Até quando (ISO 8601); `null` é para sempre. */
  until: string | null;
  reason: string;
};

/** `POST /aouerj/v2/reports`, com a sessão: o relato sem e-mail (o aluno é conhecido). */
export type StudentErrorReportRequest = Omit<ErrorReportRequest, 'email'>;
