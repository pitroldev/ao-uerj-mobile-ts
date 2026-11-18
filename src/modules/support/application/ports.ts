import type { ErrorCode } from '@root/shared/errors/AppError';

/**
 * A última tentativa no gerador de grades, só em contagens: nenhuma
 * disciplina, turma ou horário vai junto. `step` é o passo em que o aluno
 * parou (0 a 2), `outcome` o resultado ("SCHEDULES", "EMPTY",
 * "SHORTFALL_ROUTINE", um código de erro ou "NOT_RUN") e `goal` o que ele
 * pediu na ordem das grades ("COMPACT", "FEW_DAYS"…).
 */
export type GeneratorDiagnostic = {
  step: number;
  outcome: string;
  goal?: string;
  /** O teto de disciplinas, quando o aluno escolheu um. */
  maximumSubjects?: number;
  /** Tempos marcados como ocupados, e quantos deles no sábado. */
  busySlots?: number;
  saturdayBusySlots?: number;
  /** Minutos do almoço pedido; 0 com ele desligado. */
  lunchMinutes?: number;
  chosenSubjects?: number;
  /** Das escolhidas, quantas são eletivas universais. */
  universalSubjects?: number;
  eligibleSubjects?: number;
  refusedSubjects?: number;
  failedSubjects?: number;
  /** Turmas das disciplinas que podem entrar, e quantas cabem na rotina. */
  classes?: number;
  freeClasses?: number;
  subjectsWithFreeClass?: number;
  /** Turmas que o aluno tirou. */
  removedClasses?: number;
  schedules?: number;
  largestSchedule?: number;
};

/**
 * As leituras do portal com erro quando o aluno abriu o relato: o nome da
 * leitura ("schedule") e o código do erro ("PORTAL_LAYOUT_CHANGED").
 */
export type PortalErrors = Record<string, string>;

export type ErrorReportDraft = {
  page: string;
  description: string;
  category?: ErrorCode;
  subjectCode?: string;
  /** Só no relato do gerador de grades. */
  generator?: GeneratorDiagnostic;
  portalErrors?: PortalErrors;
  /**
   * As leituras do portal cuja página vai junto, anonimizada ("schedule");
   * vazio ou ausente, nenhuma (o aluno desligou ou a tela não tem página).
   */
  pageReads?: string[];
};

/** Uma página do portal no relato, já anonimizada no aparelho. */
export type PortalPage = { read: string; html: string };

/**
 * As páginas do Aluno Online que vão no relato, anonimizadas no aparelho
 * (sem nome, matrícula, notas nem textos do aluno). Nunca lança: uma
 * leitura que falha sai em `failures`, com o código do erro.
 */
export interface PortalPagesPort {
  capture(
    reads: readonly string[],
    context: {
      /** O nome e a matrícula da conta: nunca ficam na página. */
      personal: readonly string[];
      subjectCode?: string;
      signal?: AbortSignal;
    },
  ): Promise<{ pages: PortalPage[]; failures: PortalErrors }>;
}

type DiagnosticReport = {
  page: string;
  description: string;
  /** As páginas do portal anonimizadas, depois do diagnóstico. */
  attachments?: string[];
  diagnostic: {
    schemaVersion: 1;
    operation: string;
    category: ErrorCode | 'USER_REPORT';
    appVersion: string;
    parserVersion: string;
    /**
     * A atualização OTA em uso, quando há uma: com ela, o mesmo `appVersion`
     * pode rodar códigos diferentes. Ausente, o app roda o JS da loja.
     */
    updateId?: string;
    subjectCode?: string;
    /** Evento do monitoramento de falhas ligado a este relato. */
    eventId?: string;
    generator?: GeneratorDiagnostic;
    portalErrors?: PortalErrors;
    /** As leituras cujas páginas foram junto, na ordem dos anexos. */
    pages?: string[];
    /** As páginas que o aluno quis mandar e não vieram, com o código. */
    pageErrors?: PortalErrors;
  };
};

export interface ErrorReporterPort {
  submit(report: DiagnosticReport): Promise<void>;
}

type ReportCategory = DiagnosticReport['diagnostic']['category'];

/**
 * Monitoramento de falhas. Recebe só a tela e a categoria do relato, nunca a
 * descrição, que pode ter dados do aluno.
 */
export interface ErrorMonitorPort {
  /** Registra o relato e devolve o id do evento, ou null se estiver desligado. */
  linkReport(report: {
    operation: string;
    category: ReportCategory;
  }): string | null;
}
