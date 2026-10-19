import type { UiTone } from '@components/ui/tones';
import {
  BOTTLENECK_MIN_DEPENDENTS,
  type PlanSubject,
} from '@root/modules/graduation/domain/plan';

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Trava 7 disciplinas" (quem depende dela, direta ou indiretamente). */
export function blocksText(blocks: number): string {
  return blocks
    ? `Trava ${plural(blocks, 'disciplina', 'disciplinas')}`
    : 'Não trava outras disciplinas';
}

/** Tom do gargalo: crítico a partir de 5 disciplinas travadas. */
export function blocksTone(blocks: number): Extract<UiTone, 'bad' | 'warn'> {
  return blocks >= BOTTLENECK_MIN_DEPENDENTS + 2 ? 'bad' : 'warn';
}

/** "FEN04-10401 · 4 créditos · 60 h", ou "a escolher · 4 créditos". */
export function subjectMeta(subject: PlanSubject): string {
  const credits = plural(subject.credits, 'crédito', 'créditos');
  if (subject.placeholder) return `a escolher · ${credits}`;
  const workload = subject.workload ? ` · ${subject.workload} h` : '';
  return `${subject.id} · ${credits}${workload}`;
}

/** O prazo da Síntese diante do plano. */
export function deadlineText(slack: number): string {
  if (slack > 0) {
    return `Cabe no prazo, com ${plural(slack, 'período', 'períodos')} de folga`;
  }
  if (slack === 0) return 'No limite do prazo: não sobra nenhum período';
  return `Passa do prazo máximo em ${plural(-slack, 'período', 'períodos')}`;
}

/**
 * A cadeia mais longa diante do tamanho do plano. Com adiamentos, o período a
 * mais é deles, não da carga.
 */
export function chainText(
  periods: number,
  chain: readonly string[],
  load: number,
  postponed = 0,
): string | null {
  if (chain.length < 2) return null;
  const names = chain.join(' → ');
  if (periods <= chain.length) {
    return `O plano já está no mínimo possível: ${plural(chain.length, 'período', 'períodos')}, pela cadeia ${names}.`;
  }
  const cause = postponed
    ? `Com ${postponed === 1 ? 'o adiamento' : 'os adiamentos'}`
    : `Com até ${plural(load, 'disciplina', 'disciplinas')} por período`;
  return `${cause} são ${plural(periods, 'período', 'períodos')}. O mínimo possível é ${chain.length}, pela cadeia ${names}.`;
}

/** Por que a disciplina está naquele período do plano. */
export function reasonText({
  subject,
  postponed,
  waitedForCredits,
  lastPrerequisite,
  bottleneck,
}: {
  subject: PlanSubject;
  postponed: boolean;
  /** Ela só entrou quando os créditos obrigatórios chegaram à trava. */
  waitedForCredits: boolean;
  /** O pré-requisito planejado mais tarde, com o período dele. */
  lastPrerequisite: { name: string; period: string } | null;
  bottleneck: boolean;
}): string {
  if (postponed) return 'Fica onde você a adiou; o resto do plano se ajustou.';
  if (waitedForCredits) {
    return `Entra quando você chega a ${subject.minimumCredits} créditos obrigatórios aprovados.`;
  }
  if (lastPrerequisite) {
    return `Entra depois de ${lastPrerequisite.name}, planejada para ${lastPrerequisite.period}.`;
  }
  if (bottleneck) return 'Vem logo porque trava outras disciplinas.';
  if (subject.placeholder) {
    return 'Eletiva: completa os créditos exigidos onde sobra espaço na carga do período.';
  }
  return 'Encaixada pelo período recomendado no currículo e pela carga escolhida.';
}

/** O efeito de adiar: o período seguinte e o novo fim do plano. */
export function postponeText(
  next: string,
  delta: number,
  end: string,
): { tone: Extract<UiTone, 'good' | 'warn'>; text: string } {
  if (delta > 0) {
    return {
      tone: 'warn',
      text: `Adiar para ${next} leva a formatura para ${end} (+${plural(delta, 'período', 'períodos')}).`,
    };
  }
  return {
    tone: 'good',
    text: `Adiar para ${next} não muda a formatura (${end}).`,
  };
}
