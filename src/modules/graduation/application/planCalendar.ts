import { periodAfter, planIndexOf } from '../domain/periods';
import type { PlanPreferences } from './PlanPreferencesStore';

const validPeriod = (value: string | null | undefined) =>
  value && /^\d{4}\.[12]$/.test(value) ? value : null;

/**
 * O período de matrícula pode estar à frente das aulas num calendário atrasado.
 * A correção é local ao plano; não muda a conta nem o prazo da Síntese.
 * Ao avançar o período do portal, a correção anterior deixa de valer.
 */
export function planCalendar({
  synthesisPeriod,
  accountPeriod,
  correction,
  remaining,
}: {
  synthesisPeriod: string | null | undefined;
  accountPeriod: string | null | undefined;
  correction: PlanPreferences['currentPeriod'];
  remaining: number | null;
}) {
  const detected = validPeriod(synthesisPeriod) ?? validPeriod(accountPeriod);
  const adjusted = Boolean(
    correction && (!detected || detected <= correction.detected),
  );
  const current = adjusted ? correction!.period : detected;
  // O prazo absoluto continua ancorado no período informado pela Síntese.
  const deadline =
    detected && remaining !== null ? periodAfter(detected, remaining) : null;
  const distance = current && deadline ? planIndexOf(current, deadline) : null;
  return {
    current,
    detected,
    adjusted,
    deadline,
    remaining: distance === null ? remaining : distance + 1,
  };
}
