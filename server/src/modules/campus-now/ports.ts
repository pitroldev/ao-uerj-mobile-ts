import type { StudentActor } from '../students/ports.ts';
import type {
  Answer,
  AnswerValue,
  Contributor,
  ContributorChange,
  DayCounts,
  DayField,
  EndedBy,
  Notice,
  NoticeKind,
  NoticeRequest,
  NoticeView,
  Problem,
  RemovedBy,
  Standing,
} from './domain.ts';

/** O que uma ação rendeu: os pontos de agora e quantos ela deu. */
export type Earned = Standing & { earned: number };

/** A lista de agora, como um aluno a vê. */
export type NowList = {
  notices: NoticeView[];
  /** Quantos alunos avisaram, responderam ou agradeceram hoje. */
  helpersToday: number;
  you: Standing;
};

export type ReportResult = {
  notice: NoticeView;
  /** Já havia um igual valendo: o pedido virou a confirmação dele. */
  merged: boolean;
  /** O aviso do mesmo lugar com outra situação, que este encerrou. */
  replaced: string | null;
  you: Earned;
};

export type NoticeResult = { notice: NoticeView; you: Earned };

/** Os pontos, as contagens, a semana e os avisos de hoje de um aluno. */
export type YouSummary = {
  you: Standing;
  counts: Omit<Contributor, 'student' | 'points'>;
  week: { notices: number; views: number; thanks: number };
  today: NoticeView[];
};

export type WeekNumbers = {
  /** A segunda-feira (AAAA-MM-DD). */
  from: string;
  notices: number;
  answers: number;
  views: number;
  minutesToEnd: number | null;
};

/** O campus somado: a semana e um mês, sem ninguém. */
export type Community = {
  week: WeekNumbers;
  month: {
    month: string;
    weekdays: number;
    notices: number;
    problems: Problem[];
  };
};

/** O que a moderação vê: os denunciados, os recentes e os números. */
export type Moderation = {
  /** Os denunciados dos últimos 7 dias, dos mais novos aos mais antigos. */
  flagged: Notice[];
  /** Os outros avisos recentes. */
  recent: Notice[];
  /** Quantos valem agora. */
  active: number;
  week: WeekNumbers;
};

/** Porta de entrada: Agora no campus. Toda ação vem de um aluno identificado. */
export interface CampusNow {
  list(actor: StudentActor): Promise<NowList>;
  /**
   * Avisa. Igual a um que já vale, vira a confirmação dele; outra situação
   * no mesmo lugar encerra a anterior.
   */
  report(request: NoticeRequest, actor: StudentActor): Promise<ReportResult>;
  /** "Continua" ou "Acabou"; o "Acabou" de quem avisou encerra na hora. */
  answer(
    id: string,
    answer: AnswerValue,
    actor: StudentActor,
  ): Promise<NoticeResult>;
  thank(id: string, actor: StudentActor): Promise<NoticeResult>;
  /** "Não é verdade": com três alunos, o aviso sai do ar. */
  flag(id: string, actor: StudentActor): Promise<void>;
  /** Os avisos que apareceram na tela do aluno (para "quantos viram"). */
  seen(ids: readonly string[], actor: StudentActor): Promise<void>;
  you(actor: StudentActor): Promise<YouSummary>;
  /** `month` (AAAA-MM): o de agora (com `null`) ou o anterior. */
  community(month: string | null): Promise<Community>;
  /** O aluno foi banido: os avisos dele que valem saem do ar. */
  dropStudent(studentId: string): Promise<void>;
  /** Para a moderação. */
  moderation(): Promise<Moderation>;
  /** Quantos denunciados esperam a moderação (a contagem da aba). */
  pendingFlags(): Promise<number>;
  /** Tira do ar (quem avisou perde os pontos); `gone` se não existe. */
  removeByModerator(id: string): Promise<'removed' | 'gone'>;
  /** Volta ao ar (devolve os pontos); `gone` se não existe ou não estava fora. */
  restoreByModerator(id: string): Promise<'restored' | 'gone'>;
}

/** Porta de saída: os avisos. */
export interface NoticeRepository {
  create(notice: Notice): Promise<void>;
  /** Em qualquer estado, até o banco apagar; `null` sem ele. */
  find(id: string): Promise<Notice | null>;
  findMany(ids: readonly string[]): Promise<Notice[]>;
  /** Os que valem em `now`. */
  listActive(now: Date): Promise<Notice[]>;
  countActive(now: Date): Promise<number>;
  /** Os que valem em `now` com o mesmo tipo e lugar. */
  listActiveAt(
    kind: NoticeKind,
    placeKey: string,
    now: Date,
  ): Promise<Notice[]>;
  /** Os do aluno criados desde `since`, do mais novo ao mais antigo. */
  listByReporter(student: string, since: Date): Promise<Notice[]>;
  /** Os criados entre `from` e `to` (o resumo do campus). */
  listCreated(from: Date, to: Date): Promise<Notice[]>;
  /** Mais um "Continua", empurrando o fim para `expiresAt` (nunca para trás). */
  addConfirmation(id: string, expiresAt: Date): Promise<Notice | null>;
  /** Marca a primeira confirmação; `false` se já tinha. */
  markFirstConfirmed(id: string, now: Date): Promise<boolean>;
  addEnd(id: string): Promise<Notice | null>;
  addThanks(id: string): Promise<Notice | null>;
  addFlag(id: string): Promise<Notice | null>;
  /** Mais uma visualização em cada um. */
  addViews(ids: readonly string[]): Promise<void>;
  /** Encerra se ainda não acabou nem saiu do ar; `false` se não mudou. */
  end(id: string, now: Date, by: EndedBy): Promise<boolean>;
  /** Tira do ar se ainda não saiu; `false` se não mudou. */
  remove(id: string, now: Date, by: RemovedBy): Promise<boolean>;
  /** Volta ao ar o que saiu (não o do banido); `false` se não mudou. */
  restore(id: string, now: Date): Promise<boolean>;
  /** Liga ou desliga a perda de pontos, uma vez; `false` se já estava assim. */
  setPenalized(id: string, penalized: boolean): Promise<boolean>;
  markReviewed(id: string, now: Date): Promise<void>;
  /** Os que valem e são do aluno. */
  listActiveBy(student: string, now: Date): Promise<Notice[]>;
  /** Os denunciados desde `since`, dos mais novos aos mais antigos. */
  listFlagged(since: Date, limit: number): Promise<Notice[]>;
  /** Os denunciados que a moderação ainda não olhou. */
  countPendingFlags(since: Date): Promise<number>;
  listRecent(limit: number): Promise<Notice[]>;
}

/** Porta de saída: o que cada aluno fez com cada aviso. */
export interface AnswerRepository {
  /**
   * Grava a resposta se o aluno ainda não tinha respondido (ou se passa de
   * "Continua" para "Acabou"), de uma vez só; devolve a anterior, ou `null`
   * se nada mudou (já tinha respondido).
   */
  answer(
    notice: string,
    student: string,
    value: AnswerValue,
    purgeAt: Date,
  ): Promise<{ previous: AnswerValue | null } | null>;
  /** `true` se o aluno ainda não tinha feito isso. */
  mark(
    notice: string,
    student: string,
    field: 'thanked' | 'flagged',
    purgeAt: Date,
  ): Promise<boolean>;
  /** Os avisos que o aluno vê pela primeira vez (os outros ficam de fora). */
  see(
    notices: readonly { id: string; purgeAt: Date }[],
    student: string,
  ): Promise<string[]>;
  forStudent(student: string, notices: readonly string[]): Promise<Answer[]>;
}

/** Porta de saída: os pontos e as contagens de sempre de cada aluno. */
export interface ContributorRepository {
  find(student: string): Promise<Contributor | null>;
  /** Soma as mudanças (os pontos nunca ficam negativos) e devolve como ficou. */
  add(student: string, change: ContributorChange): Promise<Contributor>;
}

/** Porta de saída: as contagens do dia de cada aluno. */
export interface DayRepository {
  /** Soma `amount` no dia do aluno e devolve as contagens depois. */
  add(
    student: string,
    day: string,
    field: DayField,
    amount: number,
    purgeAt: Date,
  ): Promise<DayCounts>;
  /** Quantos alunos fizeram algo no dia. */
  countDay(day: string): Promise<number>;
}
