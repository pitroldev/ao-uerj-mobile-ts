import {
  isActive,
  type Notice,
} from '../../../../../modules/campus-now/domain.ts';
import type { Moderation } from '../../../../../modules/campus-now/ports.ts';
import type {
  CallReport,
  HiddenBy,
  ListedCall,
} from '../../../../../modules/companion/domain.ts';
import type { ReportGroup } from '../../../../../modules/reports/ports.ts';
import type { Student } from '../../../../../modules/students/domain.ts';
import type { Suggestion } from '../../../../../modules/suggestions/domain.ts';
import { DAY_MS } from './format.ts';
import type { SideCounts } from './shell.ts';

/*
 * O quadro: o que cada área tem agora, carregado de uma vez para a barra
 * lateral, o Início e a área aberta. Cada área só usa o que é dela.
 */

/** Quanto o "Feitos" de cada área mostra. */
export const DONE_WINDOW_MS = 7 * DAY_MS;

/** As denúncias de uma chamada, juntas (a moderação decide por chamada). */
export type CallCase = {
  callId: string;
  /** As mais novas primeiro. */
  reports: CallReport[];
  latest: CallReport;
  /** Pede você: há denúncia sem decisão e a chamada ainda vale. */
  pending: boolean;
  hidden: boolean;
  hiddenBy: HiddenBy | null;
  /** O "Manter no ar" mais recente. */
  reviewedAt: Date | null;
  /** A chamada ainda vale (a moderação ainda a tira do ar). */
  alive: boolean;
  /** A chamada na lista agora, se estiver. */
  listed: ListedCall | null;
};

export type Desk = {
  now: Date;
  companion: {
    cases: CallCase[];
    /** Pedem você, as denunciadas por último primeiro. */
    asks: CallCase[];
    /** Na lista agora, as mais próximas primeiro. */
    listed: ListedCall[];
    /** Decididas nos últimos 7 dias, as mais recentes primeiro. */
    done: CallCase[];
  };
  campus: {
    moderation: Moderation;
    /** Pedem você: no ar com denúncia e fora do ar pelas denúncias. */
    asks: Notice[];
    /** Decididos nos últimos 7 dias. */
    done: Notice[];
  };
  /** Os grupos de relatos abertos, os maiores primeiro. */
  reports: ReportGroup[];
  suggestions: { fresh: Suggestion[]; archived: Suggestion[] };
  /** Os banidos agora (vazio sem a identificação). */
  banned: Student[];
};

/** As denúncias (as mais novas primeiro) juntadas por chamada. */
export function callCases(
  reports: readonly CallReport[],
  listed: readonly ListedCall[],
  now: Date,
): CallCase[] {
  const byCall = new Map<string, CallReport[]>();
  for (const report of reports) {
    const list = byCall.get(report.callId);
    if (list) list.push(report);
    else byCall.set(report.callId, [report]);
  }
  const onList = new Map(listed.map(call => [call.id, call]));
  return [...byCall].map(([callId, list]) => {
    const latest = list[0];
    const hidden = list.some(report => report.hidden);
    const reviewed = list.flatMap(report =>
      report.reviewedAt ? [report.reviewedAt.getTime()] : [],
    );
    const alive =
      !hidden && latest.callExpiresAt !== null && latest.callExpiresAt > now;
    return {
      callId,
      reports: list,
      latest,
      pending: alive && list.some(report => !report.reviewedAt),
      hidden,
      hiddenBy: list.find(report => report.hiddenBy)?.hiddenBy ?? null,
      reviewedAt: reviewed.length ? new Date(Math.max(...reviewed)) : null,
      alive,
      listed: onList.get(callId) ?? null,
    };
  });
}

/** As chamadas decididas (tiradas ou mantidas) nos últimos 7 dias. */
export function decidedCases(cases: readonly CallCase[], now: Date) {
  const since = now.getTime() - DONE_WINDOW_MS;
  const at = (item: CallCase) =>
    (item.reviewedAt ?? item.latest.createdAt).getTime();
  return cases
    .filter(
      item =>
        (item.hidden || (item.reviewedAt && !item.pending)) &&
        at(item) >= since,
    )
    .sort((a, b) => at(b) - at(a));
}

/** Pede você no campus: no ar com denúncia, ou fora do ar pelas denúncias. */
export function campusAsks(moderation: Moderation, now: Date): Notice[] {
  return moderation.flagged
    .filter(
      notice =>
        notice.flags > 0 &&
        !notice.reviewedAt &&
        (isActive(notice, now) || notice.removedBy === 'flags'),
    )
    .sort(
      (a, b) =>
        Number(isActive(b, now)) - Number(isActive(a, now)) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
}

/** Quando a moderação decidiu (ou o aviso saiu do ar). */
export const decidedAt = (notice: Notice) =>
  notice.reviewedAt ?? notice.removedAt ?? notice.createdAt;

/** Os avisos que você decidiu (ou que saíram porque quem avisou foi banido), 7 dias. */
export function campusDone(moderation: Moderation, now: Date): Notice[] {
  const since = now.getTime() - DONE_WINDOW_MS;
  const seen = new Set<string>();
  return [...moderation.flagged, ...moderation.recent]
    .filter(notice => {
      if (seen.has(notice.id)) return false;
      seen.add(notice.id);
      return (
        (notice.reviewedAt !== null ||
          notice.removedBy === 'moderation' ||
          notice.removedBy === 'ban') &&
        decidedAt(notice).getTime() >= since
      );
    })
    .sort((a, b) => decidedAt(b).getTime() - decidedAt(a).getTime());
}

/** O que a barra lateral conta. */
export function sideCounts(desk: Desk, trouble: boolean): SideCounts {
  return {
    companion: desk.companion.asks.length,
    companionLive: desk.companion.asks.length > 0,
    campus: desk.campus.asks.length,
    campusLive: desk.campus.asks.some(notice => isActive(notice, desk.now)),
    reports: desk.reports.length,
    suggestions: desk.suggestions.fresh.length,
    trouble,
  };
}

/** O que a moderação sabe de um aluno pelo que está no quadro (30 dias). */
export type StudentFacts = {
  /** As chamadas em que ele estava e que foram denunciadas. */
  reported: number;
  /** As denúncias que ele fez. */
  reportsMade: number;
  /** Os avisos dele no campus que a moderação vê, e quantos saíram do ar. */
  notices: number;
  noticesRemoved: number;
};

export function studentFacts(desk: Desk) {
  const facts = new Map<string, StudentFacts>();
  const of = (id: string) => {
    let entry = facts.get(id);
    if (!entry) {
      entry = { reported: 0, reportsMade: 0, notices: 0, noticesRemoved: 0 };
      facts.set(id, entry);
    }
    return entry;
  };
  for (const item of desk.companion.cases) {
    const inside = new Set(
      item.reports.flatMap(report =>
        report.people.flatMap(person =>
          person.student ? [person.student] : [],
        ),
      ),
    );
    for (const id of inside) of(id).reported += 1;
    for (const report of item.reports)
      if (report.reporterStudent) of(report.reporterStudent).reportsMade += 1;
  }
  const seen = new Set<string>();
  for (const notice of [
    ...desk.campus.moderation.flagged,
    ...desk.campus.moderation.recent,
    ...desk.campus.moderation.live,
  ]) {
    if (seen.has(notice.id)) continue;
    seen.add(notice.id);
    const entry = of(notice.reporter);
    entry.notices += 1;
    if (notice.removedBy === 'flags' || notice.removedBy === 'moderation')
      entry.noticesRemoved += 1;
  }
  return (id: string): StudentFacts =>
    facts.get(id) ?? {
      reported: 0,
      reportsMade: 0,
      notices: 0,
      noticesRemoved: 0,
    };
}
