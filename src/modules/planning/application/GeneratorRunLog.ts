import type { GeneratorDiagnostic } from '@root/modules/support/application/ports';

/** Depois disso, a tentativa já não explica um relato novo. */
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * A última tentativa no gerador de grades, para ir junto no relato da tela.
 * Fica só na memória (fechar o app apaga) e presa à conta: outra conta no
 * mesmo aparelho não a vê.
 */
export class GeneratorRunLog {
  private entry: {
    scope: string;
    at: number;
    value: GeneratorDiagnostic;
  } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  /** Uma tentativa nova: esquece as contagens da anterior. */
  start(scope: string): void {
    this.entry = {
      scope,
      at: this.now(),
      value: { step: 0, outcome: 'NOT_RUN' },
    };
  }

  note(scope: string, patch: Partial<GeneratorDiagnostic>): void {
    if (this.entry?.scope !== scope) this.start(scope);
    this.entry = {
      scope,
      at: this.now(),
      value: { ...this.entry!.value, ...patch },
    };
  }

  read(scope: string | null | undefined): GeneratorDiagnostic | null {
    const entry = this.entry;
    if (!entry || !scope || entry.scope !== scope) return null;
    if (this.now() - entry.at > MAX_AGE) return null;
    return entry.value;
  }
}
