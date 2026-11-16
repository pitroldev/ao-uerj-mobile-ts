import type { StudentSessionApiPort } from '@root/modules/trust/application/ports';

/**
 * A identificação no servidor, na demo: sempre "desligada". Sem desafio, a
 * `StudentSession` desiste antes de atestar, então o aparelho nunca chama a
 * Play Integrity nem o App Attest, e o servidor nunca sabe da conta.
 */
export function createDemoStudentSessionApi(): StudentSessionApiPort {
  return {
    challenge: async () => null,
    create: async () => ({ created: false, refusal: 'unavailable' }),
    end: async () => undefined,
  };
}
