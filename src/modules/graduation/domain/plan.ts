/**
 * Plano até a formatura: as disciplinas que faltam distribuídas pelos
 * próximos períodos, respeitando os pré-requisitos, os créditos mínimos e o
 * limite de créditos do ritmo escolhido. Tudo aqui é cálculo puro; os dados
 * vêm do currículo, do histórico, da Síntese da Formação e da Pesquisa de
 * Disciplinas (os pré-requisitos).
 */

export type PlanSubjectKind =
  'MANDATORY' | 'RESTRICTED' | 'DEFINED' | 'UNIVERSAL' | 'ELECTIVE';

/** Uma disciplina que falta, ou uma vaga de eletiva a escolher. */
export type PlanSubject = {
  /** Código numérico da disciplina (o de `subjectKey`); nas vagas, "ER:1". */
  key: string;
  /** Código do portal ("FEN04-10401"); vazio nas vagas de eletiva. */
  id: string;
  name: string;
  credits: number;
  workload: number | null;
  kind: PlanSubjectKind;
  /** Período recomendado no currículo. */
  recommendedPeriod: number | null;
  /**
   * Créditos obrigatórios aprovados que ela exige (a trava do portal, como
   * "60 Créditos Obrigatórios", ou os créditos mínimos do currículo).
   */
  minimumCredits: number;
  /**
   * Pré-requisitos: cada grupo é um "ou" de códigos numéricos, e todos os
   * grupos valem ("e"). `null`: não lidos; o plano a trata como livre.
   */
  prerequisites: string[][] | null;
  /** Vaga de eletiva: o aluno escolhe a disciplina depois. */
  placeholder: boolean;
};

/** Créditos por período de cada ritmo. */
export const PACE_CREDITS = { light: 20, normal: 26, intense: 32 } as const;
export type Pace = keyof typeof PACE_CREDITS;

/** Gargalo: trava, direta ou indiretamente, ao menos esta quantidade. */
export const BOTTLENECK_MIN_DEPENDENTS = 3;

/** Teto de períodos do plano: mais que isso, o resto fica de fora. */
const MAX_PERIODS = 24;

export type PrerequisiteGraph = {
  /** Pré-requisitos sem alternativa que ainda faltam, por disciplina. */
  requires: ReadonlyMap<string, readonly string[]>;
  /** Quem cada disciplina trava, direta ou indiretamente. */
  dependents: ReadonlyMap<string, ReadonlySet<string>>;
  /** Disciplinas com um grupo que nenhuma das que faltam satisfaz. */
  unreachable: ReadonlySet<string>;
  /** A cadeia mais longa de pré-requisitos: o mínimo de períodos. */
  chain: readonly string[];
};

/**
 * O grafo das que faltam. Um grupo já cumprido não conta; um grupo com uma
 * só alternativa entre as que faltam vira dependência; com várias, qualquer
 * uma serve, e nenhuma delas trava a disciplina sozinha.
 */
export function prerequisiteGraph(
  subjects: readonly PlanSubject[],
  completed: ReadonlySet<string>,
): PrerequisiteGraph {
  const keys = new Set(subjects.map(subject => subject.key));
  // grupos ainda não cumpridos, com as alternativas que estão entre as que faltam
  const open = new Map(
    subjects.map(subject => [
      subject.key,
      (subject.prerequisites ?? [])
        .filter(group => group.length && !group.some(key => completed.has(key)))
        .map(group =>
          group.filter(key => keys.has(key) && key !== subject.key),
        ),
    ]),
  );
  // inalcançável: um grupo sem alternativa possível, também por tabela
  const unreachable = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    open.forEach((groups, key) => {
      if (unreachable.has(key)) return;
      if (
        groups.some(group => group.every(option => unreachable.has(option)))
      ) {
        unreachable.add(key);
        changed = true;
      }
    });
  }
  const requires = new Map<string, string[]>();
  open.forEach((groups, key) => {
    const needs: string[] = [];
    for (const group of groups) {
      const options = group.filter(option => !unreachable.has(option));
      if (options.length === 1 && !needs.includes(options[0])) {
        needs.push(options[0]);
      }
    }
    requires.set(key, needs);
  });

  const direct = new Map<string, string[]>(
    subjects.map(subject => [subject.key, []]),
  );
  requires.forEach((needs, key) =>
    needs.forEach(need => direct.get(need)?.push(key)),
  );
  const dependents = new Map<string, Set<string>>();
  const collect = (key: string, path: Set<string>): Set<string> => {
    const known = dependents.get(key);
    if (known) return known;
    const found = new Set<string>();
    // um ciclo no portal não pode travar o cálculo
    if (path.has(key)) return found;
    path.add(key);
    for (const next of direct.get(key) ?? []) {
      found.add(next);
      collect(next, path).forEach(item => found.add(item));
    }
    path.delete(key);
    dependents.set(key, found);
    return found;
  };
  subjects.forEach(subject => collect(subject.key, new Set()));

  const depth = new Map<string, number>();
  const parent = new Map<string, string>();
  const measure = (key: string, path: Set<string>): number => {
    const known = depth.get(key);
    if (known !== undefined) return known;
    if (path.has(key)) return 0;
    path.add(key);
    let best = 0;
    for (const need of requires.get(key) ?? []) {
      const value = measure(need, path);
      if (value > best) {
        best = value;
        parent.set(key, need);
      }
    }
    path.delete(key);
    depth.set(key, best + 1);
    return best + 1;
  };
  let end: string | null = null;
  for (const subject of subjects) {
    if (subject.placeholder) continue;
    const value = measure(subject.key, new Set());
    if (end === null || value > (depth.get(end) ?? 0)) end = subject.key;
  }
  const chain: string[] = [];
  for (let key = end; key !== null; key = parent.get(key) ?? null) {
    chain.unshift(key);
  }

  return { requires, dependents, unreachable, chain };
}

export function blocksOf(graph: PrerequisiteGraph, key: string): number {
  return graph.dependents.get(key)?.size ?? 0;
}

export function isBottleneck(graph: PrerequisiteGraph, key: string): boolean {
  return blocksOf(graph, key) >= BOTTLENECK_MIN_DEPENDENTS;
}

export type PlanOptions = {
  /** Aprovadas, isentas e em curso (as em curso contam como aprovadas). */
  completed: ReadonlySet<string>;
  /**
   * Créditos obrigatórios aprovados no começo do plano, com os do período em
   * curso: é o que as travas contam.
   */
  credits: number;
  /** Limite de créditos por período (o ritmo). */
  cap: number;
  /** Primeiro período do plano (índice) de cada disciplina adiada. */
  notBefore?: ReadonlyMap<string, number>;
};

export type PlannedPeriod = {
  index: number;
  subjects: PlanSubject[];
  credits: number;
  workload: number;
  /** Créditos obrigatórios aprovados no começo do período (para as travas). */
  creditsBefore: number;
};

export type GraduationPlan = {
  periods: PlannedPeriod[];
  /** Índice do período de cada disciplina do plano. */
  periodOf: ReadonlyMap<string, number>;
  /** Fora do plano: pré-requisito fora do currículo ou créditos que não chegam. */
  unplanned: PlanSubject[];
  graph: PrerequisiteGraph;
};

/**
 * A ordem de entrada: as que travam mais, o período recomendado, as
 * obrigatórias antes das eletivas, as de mais créditos e o nome.
 */
function priority(graph: PrerequisiteGraph) {
  const rank = (subject: PlanSubject) =>
    subject.placeholder ? 2 : subject.kind === 'MANDATORY' ? 0 : 1;
  return (a: PlanSubject, b: PlanSubject) =>
    blocksOf(graph, b.key) - blocksOf(graph, a.key) ||
    (a.recommendedPeriod ?? 99) - (b.recommendedPeriod ?? 99) ||
    rank(a) - rank(b) ||
    b.credits - a.credits ||
    a.name.localeCompare(b.name, 'pt-BR');
}

/**
 * O maior total de créditos que cabe em `room`, preferindo as que vêm antes
 * na ordem (soma de subconjuntos, reconstruída do início).
 */
function fill(candidates: readonly PlanSubject[], room: number): PlanSubject[] {
  if (room <= 0 || !candidates.length) return [];
  const row = () => Array.from({ length: room + 1 }, () => false);
  const reach = [...candidates.map(row), row()];
  reach[candidates.length][0] = true;
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const credits = candidates[i].credits;
    for (let total = 0; total <= room; total += 1) {
      reach[i][total] =
        reach[i + 1][total] ||
        (credits <= total && reach[i + 1][total - credits]);
    }
  }
  let target = room;
  while (target > 0 && !reach[0][target]) target -= 1;
  const chosen: PlanSubject[] = [];
  candidates.forEach((subject, i) => {
    if (subject.credits <= target && reach[i + 1][target - subject.credits]) {
      chosen.push(subject);
      target -= subject.credits;
    }
  });
  return chosen;
}

/** Distribui as que faltam pelos próximos períodos, a partir do índice 0. */
export function buildGraduationPlan(
  subjects: readonly PlanSubject[],
  options: PlanOptions,
): GraduationPlan {
  const { completed, cap } = options;
  const notBefore = options.notBefore ?? new Map<string, number>();
  const pending = subjects.filter(subject => !completed.has(subject.key));
  const graph = prerequisiteGraph(pending, completed);
  const order = priority(graph);
  const done = new Set(completed);
  const remaining = new Map(
    pending
      .filter(subject => !graph.unreachable.has(subject.key))
      .map(subject => [subject.key, subject]),
  );
  // cada grupo pede uma alternativa já cursada ou planejada antes
  const ready = (subject: PlanSubject, index: number, credits: number) =>
    (notBefore.get(subject.key) ?? 0) <= index &&
    credits >= subject.minimumCredits &&
    (subject.prerequisites ?? []).every(
      group => !group.length || group.some(key => done.has(key)),
    );

  const periods: PlannedPeriod[] = [];
  const periodOf = new Map<string, number>();
  let credits = options.credits;
  for (let index = 0; remaining.size && index < MAX_PERIODS; index += 1) {
    const available = [...remaining.values()]
      .filter(subject => ready(subject, index, credits))
      .sort(order);
    const waitingLater = [...remaining.values()].some(
      subject => (notBefore.get(subject.key) ?? 0) > index,
    );
    if (!available.length && !waitingLater) break;

    const chosen: PlanSubject[] = [];
    let used = 0;
    for (const subject of available.filter(
      item => blocksOf(graph, item.key) > 0,
    )) {
      // uma disciplina maior que o ritmo entra sozinha num período vazio
      if (used + subject.credits <= cap || !chosen.length) {
        chosen.push(subject);
        used += subject.credits;
      }
    }
    for (const subject of fill(
      available.filter(item => blocksOf(graph, item.key) === 0),
      cap - used,
    )) {
      chosen.push(subject);
      used += subject.credits;
    }
    if (!chosen.length && available.length) {
      chosen.push(available[0]);
      used = available[0].credits;
    }

    periods.push({
      index,
      subjects: chosen,
      credits: used,
      workload: chosen.reduce((sum, item) => sum + (item.workload ?? 0), 0),
      creditsBefore: credits,
    });
    for (const subject of chosen) {
      remaining.delete(subject.key);
      done.add(subject.key);
      periodOf.set(subject.key, index);
    }
    credits += chosen
      .filter(item => item.kind === 'MANDATORY')
      .reduce((sum, item) => sum + item.credits, 0);
  }

  return {
    periods,
    periodOf,
    unplanned: pending.filter(subject => !periodOf.has(subject.key)),
    graph,
  };
}

/** Folga em relação ao prazo da Síntese; `null` sem o prazo. */
export function deadlineSlack(
  plan: GraduationPlan,
  remainingPeriods: number | null,
): number | null {
  if (remainingPeriods === null) return null;
  return remainingPeriods - plan.periods.length;
}

/**
 * Vagas de eletiva para completar os créditos que faltam, no tamanho mais
 * comum das disciplinas daquele grupo (a última pode ser menor).
 */
export function electiveSlots(
  kind: PlanSubjectKind,
  missingCredits: number,
  slotCredits: number,
  name: string,
): PlanSubject[] {
  const size = Math.max(1, Math.round(slotCredits));
  const slots: PlanSubject[] = [];
  let left = Math.max(0, Math.round(missingCredits));
  for (let n = 1; left > 0; n += 1) {
    const credits = Math.min(size, left);
    slots.push({
      key: `${kind}:${n}`,
      id: '',
      name,
      credits,
      workload: null,
      kind,
      recommendedPeriod: null,
      minimumCredits: 0,
      prerequisites: [],
      placeholder: true,
    });
    left -= credits;
  }
  return slots;
}
