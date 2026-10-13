import type { Credentials } from '@root/modules/identity/domain/types';

/**
 * Modo demonstração (somente builds de desenvolvimento).
 *
 * Matrícula "demo" (ou "demo-<cenário>") com senha "demo" ativa os adaptadores
 * fictícios. Qualquer outra combinação segue para o Aluno Online real.
 */
const DEMO_PASSWORD = 'demo';

export const DEMO_SCENARIOS = [
  /** Período em andamento: grade, notas, RID, histórico, currículo e mural. */
  'padrao',
  /** Período de inscrição: sem grade e sem notas; o Início mostra o RID parcial. */
  'rid',
  /** Período ainda não iniciado: sem grade, notas nem RID. */
  'vazio',
  /** Aluno Online bloqueado: toda leitura acadêmica falha com POSSIBLY_BLOCKED. */
  'bloqueado',
  /** Portal com layout inesperado: toda leitura acadêmica falha. */
  'erro',
  /** Respostas lentas (30 s) para inspecionar os estados de carregamento. */
  'lento',
] as const;

export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export function isDemoScenario(value: string): value is DemoScenario {
  return (DEMO_SCENARIOS as readonly string[]).includes(value);
}

/** Returns the requested scenario, or null for every non-demo credential. */
export function demoScenarioOf(credentials: Credentials): DemoScenario | null {
  if (credentials.password !== DEMO_PASSWORD) return null;
  const match = /^demo(?:-([a-z]+))?$/i.exec(credentials.matricula.trim());
  if (!match) return null;
  const scenario = (match[1] ?? 'padrao').toLowerCase();
  return isDemoScenario(scenario) ? scenario : null;
}

export function demoCredentials(
  scenario: DemoScenario = 'padrao',
): Credentials {
  return {
    matricula: scenario === 'padrao' ? 'demo' : `demo-${scenario}`,
    password: DEMO_PASSWORD,
  };
}
